// Package client is the thin HTTP client the provider uses. It mirrors the CLI: bearer
// token, JSON, an Idempotency-Key on every write, and API errors surfaced with their code.
package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

type Client struct {
	BaseURL string
	Token   string
	HTTP    *http.Client
}

type APIError struct {
	Status  int
	Code    string
	Message string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("pgcloud %s (%d): %s", e.Code, e.Status, e.Message)
}

func IsNotFound(err error) bool {
	e, ok := err.(*APIError)
	return ok && e.Status == 404
}

func New(baseURL, token string) *Client {
	return &Client{BaseURL: strings.TrimSuffix(strings.TrimRight(baseURL, "/"), "/v1"), Token: token, HTTP: &http.Client{Timeout: 60 * time.Second}}
}

func (c *Client) Do(ctx context.Context, method, path string, body, out interface{}) error {
	var rdr io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rdr = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.BaseURL+path, rdr)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "terraform-provider-pgcloud/0.1.0")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Idempotency-Key", uuid.NewString())
	}
	res, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 400 {
		var env struct {
			Error struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			} `json:"error"`
		}
		_ = json.Unmarshal(raw, &env)
		if env.Error.Code == "" {
			env.Error.Code, env.Error.Message = "http_error", strings.TrimSpace(string(raw))
		}
		return &APIError{Status: res.StatusCode, Code: env.Error.Code, Message: env.Error.Message}
	}
	if out != nil && len(raw) > 0 {
		return json.Unmarshal(raw, out)
	}
	return nil
}

// ---- shapes the provider reads ----

type Server struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	Status        string  `json:"status"`
	StatusMessage *string `json:"statusMessage"`
	Region        struct {
		ID string `json:"id"`
	} `json:"region"`
	Size struct {
		ID string `json:"id"`
	} `json:"size"`
	Image struct {
		ID string `json:"id"`
	} `json:"image"`
	Networks struct {
		V4 []struct {
			IPAddress string `json:"ipAddress"`
		} `json:"v4"`
		Private []struct {
			IPAddress string `json:"ipAddress"`
		} `json:"private"`
	} `json:"networks"`
	Firewalls      []string `json:"firewalls"`
	BackupsEnabled bool     `json:"backupsEnabled"`
	Tags           []string `json:"tags"`
	ProjectID      string   `json:"projectId"`
}

// WaitServer polls until the server settles. Failed provisioning is an error.
func (c *Client) WaitServer(ctx context.Context, id string, timeout time.Duration) (*Server, error) {
	deadline := time.Now().Add(timeout)
	for {
		var s Server
		if err := c.Do(ctx, http.MethodGet, "/v1/servers/"+id, nil, &s); err != nil {
			return nil, err
		}
		switch s.Status {
		case "active", "off":
			return &s, nil
		case "failed":
			msg := "provisioning failed"
			if s.StatusMessage != nil {
				msg = *s.StatusMessage
			}
			return &s, fmt.Errorf("server %s: %s", id, msg)
		}
		if time.Now().After(deadline) {
			return &s, fmt.Errorf("server %s still %s after %s", id, s.Status, timeout)
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(3 * time.Second):
		}
	}
}

// WaitGone polls until the server no longer exists.
func (c *Client) WaitGone(ctx context.Context, id string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		var s Server
		err := c.Do(ctx, http.MethodGet, "/v1/servers/"+id, nil, &s)
		if IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(3 * time.Second):
		}
	}
	return fmt.Errorf("server %s still exists after %s", id, timeout)
}

type Volume struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	SizeGb        int     `json:"sizeGb"`
	Status        string  `json:"status"`
	StatusMessage *string `json:"statusMessage"`
	ServerID      *string `json:"serverId"`
	Device        *string `json:"device"`
	RegionID      string  `json:"regionId"`
}

// WaitVolume polls until the volume is available or attached. A failed transition is an error
// that carries the API's status message.
func (c *Client) WaitVolume(ctx context.Context, id string, timeout time.Duration) (*Volume, error) {
	deadline := time.Now().Add(timeout)
	for {
		var v Volume
		if err := c.Do(ctx, http.MethodGet, "/v1/volumes/"+id, nil, &v); err != nil {
			return nil, err
		}
		switch v.Status {
		case "available", "attached":
			if v.StatusMessage != nil && *v.StatusMessage != "" {
				return &v, fmt.Errorf("volume %s: %s", id, *v.StatusMessage)
			}
			return &v, nil
		case "failed":
			msg := "provisioning failed"
			if v.StatusMessage != nil {
				msg = *v.StatusMessage
			}
			return &v, fmt.Errorf("volume %s: %s", id, msg)
		}
		if time.Now().After(deadline) {
			return &v, fmt.Errorf("volume %s still %s after %s", id, v.Status, timeout)
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(2 * time.Second):
		}
	}
}

type LoadBalancer struct {
	ID                  string  `json:"id"`
	Name                string  `json:"name"`
	Status              string  `json:"status"`
	StatusMessage       *string `json:"statusMessage"`
	IP                  *string `json:"ip"`
	RegionID            string  `json:"regionId"`
	Algorithm           string  `json:"algorithm"`
	Nodes               int     `json:"nodes"`
	RedirectHTTPToHTTPS bool    `json:"redirectHttpToHttps"`
	Tag                 *string `json:"tag"`
	StickySessions      *struct {
		Type string `json:"type"`
	} `json:"stickySessions"`
	HealthCheck struct {
		Path string `json:"path"`
	} `json:"healthCheck"`
	ForwardingRules []struct {
		EntryProtocol  string `json:"entryProtocol"`
		EntryPort      int    `json:"entryPort"`
		TargetProtocol string `json:"targetProtocol"`
		TargetPort     int    `json:"targetPort"`
		CertificateID  string `json:"certificateId"`
	} `json:"forwardingRules"`
	Targets []struct {
		ServerID string `json:"serverId"`
	} `json:"targets"`
}

// WaitLoadBalancer polls until the load balancer is active. Failed provisioning is an error.
func (c *Client) WaitLoadBalancer(ctx context.Context, id string, timeout time.Duration) (*LoadBalancer, error) {
	deadline := time.Now().Add(timeout)
	for {
		var lb LoadBalancer
		if err := c.Do(ctx, http.MethodGet, "/v1/load-balancers/"+id, nil, &lb); err != nil {
			return nil, err
		}
		switch lb.Status {
		case "active":
			return &lb, nil
		case "failed":
			msg := "provisioning failed"
			if lb.StatusMessage != nil {
				msg = *lb.StatusMessage
			}
			return &lb, fmt.Errorf("load balancer %s: %s", id, msg)
		}
		if time.Now().After(deadline) {
			return &lb, fmt.Errorf("load balancer %s still %s after %s", id, lb.Status, timeout)
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(3 * time.Second):
		}
	}
}

type DnsRecord struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Type     string `json:"type"`
	Content  string `json:"content"`
	TTL      int    `json:"ttl"`
	Priority *int   `json:"priority"`
}

type Domain struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Status      string      `json:"status"`
	Nameservers []string    `json:"nameservers"`
	Records     []DnsRecord `json:"records"`
}

type FirewallRule struct {
	Direction string   `json:"direction"`
	Protocol  string   `json:"protocol"`
	Ports     *string  `json:"ports,omitempty"`
	Cidrs     []string `json:"cidrs"`
}

type Firewall struct {
	ID    string         `json:"id"`
	Name  string         `json:"name"`
	Rules []FirewallRule `json:"rules"`
}

type SshKey struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Fingerprint string `json:"fingerprint"`
	PublicKey   string `json:"publicKey"`
}

type Size struct {
	ID         string  `json:"id"`
	Vcpu       int64   `json:"vcpu"`
	MemoryMb   int64   `json:"memoryMb"`
	DiskGb     int64   `json:"diskGb"`
	TransferTb float64 `json:"transferTb"`
}

type Image struct {
	ID   string `json:"id"`
	Kind string `json:"kind"`
	Name string `json:"name"`
}
