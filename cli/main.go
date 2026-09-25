// pgcloud — the command-line client. One static binary, no dependencies, talks to the
// same public API as the console. Install: curl -fsSL https://get.pgcloud.example | sh
//
//	pgcloud login                       # email + password, or paste an API token
//	pgcloud servers create web-1 --size s-2vcpu-4gb --image ubuntu-24-04 --wait
//	pgcloud servers ls
//	pgcloud ssh web-1
//	pgcloud deploy https://github.com/you/app --branch main --port 3000
//	pgcloud deploys ls
//	pgcloud --json servers ls | jq .
package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"syscall"
	"text/tabwriter"
	"time"
)

var version = "dev"

type config struct {
	APIURL string `json:"api_url"`
	Token  string `json:"token"`
	Team   string `json:"team,omitempty"`
}

var (
	cfg      config
	jsonOut  bool
	project  string
	client   = &http.Client{Timeout: 60 * time.Second}
	stdout   = bufio.NewWriter(os.Stdout)
	exitCode = 0
)

func main() {
	defer stdout.Flush()
	args := parseGlobal(os.Args[1:])
	loadConfig()
	if len(args) == 0 {
		usage()
		return
	}
	cmd, rest := args[0], args[1:]
	var err error
	switch cmd {
	case "login":
		err = cmdLogin(rest)
	case "logout":
		err = os.Remove(configPath())
	case "whoami", "account":
		err = cmdGet("/v1/account", func(v map[string]any) {
			u, t := v["user"].(map[string]any), v["team"].(map[string]any)
			fmt.Fprintf(stdout, "%s (%s) — team %s [%s] — %s\n", u["email"], u["name"], t["name"], t["slug"], cfg.APIURL)
		})
	case "servers", "s":
		err = cmdServers(rest)
	case "ssh":
		err = cmdSSH(rest)
	case "deploy":
		err = cmdDeploy(rest)
	case "deploys", "d":
		err = cmdDeploys(rest)
	case "apps":
		err = cmdList("/v1/apps", nil, []string{"slug", "name", "category", "minSizeId", "version"})
	case "sizes":
		err = cmdList("/v1/sizes", nil, []string{"id", "vcpu", "memoryMb", "diskGb", "transferTb"})
	case "images":
		err = cmdList("/v1/images", nil, []string{"id", "kind", "name"})
	case "regions":
		err = cmdList("/v1/regions", nil, []string{"id", "name", "country"})
	case "pricing":
		err = cmdPricing(rest)
	case "ssh-keys", "keys":
		err = cmdSSHKeys(rest)
	case "tokens":
		err = cmdTokens(rest)
	case "firewalls":
		err = cmdList("/v1/firewalls", nil, []string{"id", "name"})
	case "billing":
		err = cmdGet("/v1/billing/balance", func(v map[string]any) {
			fmt.Fprintf(stdout, "currency: %s\ncredit: %s\nmonth to date: %s\nstatus: %s\n", v["currency"], money(v["creditMinor"], v["currency"]), money(v["monthToDateMinor"], v["currency"]), v["status"])
		})
	case "version":
		fmt.Fprintln(stdout, "pgcloud", version)
	case "help", "-h", "--help":
		usage()
	default:
		err = fmt.Errorf("unknown command %q (try `pgcloud help`)", cmd)
	}
	if err != nil {
		stdout.Flush()
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprint(stdout, `pgcloud — the developer cloud for Türkiye, from your terminal

USAGE  pgcloud [--json] [--project SLUG] <command> [args]

ACCOUNT   login · logout · whoami · billing · tokens create NAME [--agent --cap 500] · ssh-keys ls|add NAME FILE
SERVERS   servers ls | create NAME [--size s-2vcpu-4gb] [--image ubuntu-24-04|wordpress] [--key ID] [--wait]
                  | get ID | start|stop|reboot|delete ID | resize ID --size S | snapshot ID
          ssh NAME|ID [-- command]
DEPLOY    deploy REPO_URL [--branch main] [--port 3000] [--size S] [--env K=V ...] [--name N] [--wait]
          deploys ls | get ID | redeploy ID
CATALOG   apps · sizes · images · regions · pricing [--currency TRY|USD] · firewalls

FLAGS     --json           machine-readable output
          --project SLUG   project (default "default")
ENV       PGCLOUD_TOKEN, PGCLOUD_API_URL override ~/.config/pgcloud/config.json
`)
}

/* ───────────────────────── config & http ───────────────────────── */

func configPath() string {
	if d := os.Getenv("XDG_CONFIG_HOME"); d != "" {
		return filepath.Join(d, "pgcloud", "config.json")
	}
	h, _ := os.UserHomeDir()
	return filepath.Join(h, ".config", "pgcloud", "config.json")
}

func loadConfig() {
	cfg.APIURL = "http://localhost:4000"
	if b, err := os.ReadFile(configPath()); err == nil {
		_ = json.Unmarshal(b, &cfg)
	}
	if v := os.Getenv("PGCLOUD_API_URL"); v != "" {
		cfg.APIURL = v
	}
	if v := os.Getenv("PGCLOUD_TOKEN"); v != "" {
		cfg.Token = v
	}
}

func saveConfig() error {
	if err := os.MkdirAll(filepath.Dir(configPath()), 0o700); err != nil {
		return err
	}
	b, _ := json.MarshalIndent(cfg, "", "  ")
	return os.WriteFile(configPath(), b, 0o600)
}

func parseGlobal(args []string) []string {
	var rest []string
	for i := 0; i < len(args); i++ {
		switch {
		case args[i] == "--json":
			jsonOut = true
		case args[i] == "--project" && i+1 < len(args):
			project = args[i+1]
			i++
		case strings.HasPrefix(args[i], "--project="):
			project = strings.TrimPrefix(args[i], "--project=")
		default:
			rest = append(rest, args[i])
		}
	}
	return rest
}

type apiError struct {
	Status  int
	Code    string
	Message string
	Details map[string]any
}

func (e *apiError) Error() string {
	if len(e.Details) > 0 {
		d, _ := json.Marshal(e.Details)
		return fmt.Sprintf("%s: %s %s", e.Code, e.Message, d)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func call(method, path string, body any, out any) error {
	var rdr io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rdr = bytes.NewReader(b)
	}
	if project != "" && !strings.Contains(path, "project=") && (method == http.MethodGet) {
		sep := "?"
		if strings.Contains(path, "?") {
			sep = "&"
		}
		path += sep + "project=" + project
	}
	req, err := http.NewRequest(method, cfg.APIURL+path, rdr)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "pgcloud-cli/"+version)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Idempotency-Key", fmt.Sprintf("cli-%d", time.Now().UnixNano()))
	}
	if cfg.Token != "" {
		req.Header.Set("Authorization", "Bearer "+cfg.Token)
	}
	res, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("cannot reach %s: %w", cfg.APIURL, err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 400 {
		var env struct {
			Error apiError `json:"error"`
		}
		if json.Unmarshal(raw, &env) == nil && env.Error.Code != "" {
			env.Error.Status = res.StatusCode
			if res.StatusCode == 401 {
				return errors.New("not logged in — run `pgcloud login`")
			}
			return &env.Error
		}
		return fmt.Errorf("HTTP %d: %s", res.StatusCode, strings.TrimSpace(string(raw)))
	}
	if out != nil && len(raw) > 0 {
		return json.Unmarshal(raw, out)
	}
	return nil
}

/* ───────────────────────── output ───────────────────────── */

func emit(v any) {
	enc := json.NewEncoder(stdout)
	enc.SetIndent("", "  ")
	_ = enc.Encode(v)
}

func table(rows []map[string]any, cols []string) {
	w := tabwriter.NewWriter(stdout, 0, 4, 2, ' ', 0)
	fmt.Fprintln(w, strings.ToUpper(strings.Join(cols, "\t")))
	for _, r := range rows {
		cells := make([]string, len(cols))
		for i, c := range cols {
			cells[i] = cell(dig(r, c))
		}
		fmt.Fprintln(w, strings.Join(cells, "\t"))
	}
	w.Flush()
}

// dig resolves "a.b.c" and "a[0].b" paths in a decoded JSON object.
func dig(v any, path string) any {
	for _, part := range strings.Split(path, ".") {
		idx := -1
		if i := strings.Index(part, "["); i >= 0 {
			fmt.Sscanf(part[i:], "[%d]", &idx)
			part = part[:i]
		}
		m, ok := v.(map[string]any)
		if !ok {
			return nil
		}
		v = m[part]
		if idx >= 0 {
			arr, ok := v.([]any)
			if !ok || idx >= len(arr) {
				return nil
			}
			v = arr[idx]
		}
	}
	return v
}

func cell(v any) string {
	switch t := v.(type) {
	case nil:
		return "—"
	case float64:
		if t == float64(int64(t)) {
			return fmt.Sprintf("%d", int64(t))
		}
		return fmt.Sprintf("%.2f", t)
	case []any:
		parts := make([]string, len(t))
		for i, x := range t {
			parts[i] = cell(x)
		}
		return strings.Join(parts, ",")
	case map[string]any:
		if id, ok := t["id"]; ok {
			return cell(id)
		}
		b, _ := json.Marshal(t)
		return string(b)
	default:
		return fmt.Sprint(t)
	}
}

func money(minor any, currency any) string {
	f, _ := minor.(float64)
	sym := map[string]string{"TRY": "₺", "USD": "$"}[fmt.Sprint(currency)]
	return fmt.Sprintf("%s%.2f", sym, f/100)
}

func flag(args []string, name string) (string, []string) {
	for i := 0; i < len(args); i++ {
		if args[i] == name && i+1 < len(args) {
			return args[i+1], append(append([]string{}, args[:i]...), args[i+2:]...)
		}
		if strings.HasPrefix(args[i], name+"=") {
			return strings.TrimPrefix(args[i], name+"="), append(append([]string{}, args[:i]...), args[i+1:]...)
		}
	}
	return "", args
}

func has(args []string, name string) (bool, []string) {
	for i, a := range args {
		if a == name {
			return true, append(append([]string{}, args[:i]...), args[i+1:]...)
		}
	}
	return false, args
}

func multi(args []string, name string) ([]string, []string) {
	var vals []string
	for {
		v, rest := flag(args, name)
		if v == "" {
			return vals, rest
		}
		vals = append(vals, v)
		args = rest
	}
}

func prompt(label string, secret bool) string {
	fmt.Fprint(os.Stderr, label)
	if secret {
		if b, err := readPassword(); err == nil {
			fmt.Fprintln(os.Stderr)
			return strings.TrimSpace(string(b))
		}
	}
	s, _ := bufio.NewReader(os.Stdin).ReadString('\n')
	return strings.TrimSpace(s)
}

// readPassword disables echo on a POSIX terminal via stty; falls back to plain read.
func readPassword() ([]byte, error) {
	if fi, _ := os.Stdin.Stat(); fi.Mode()&os.ModeCharDevice == 0 {
		return nil, errors.New("not a tty")
	}
	_ = exec.Command("stty", "-F", "/dev/tty", "-echo").Run()
	defer exec.Command("stty", "-F", "/dev/tty", "echo").Run()
	s, err := bufio.NewReader(os.Stdin).ReadString('\n')
	return []byte(s), err
}

/* ───────────────────────── commands ───────────────────────── */

func cmdLogin(args []string) error {
	if u, rest := flag(args, "--api"); u != "" {
		cfg.APIURL = strings.TrimRight(u, "/")
		args = rest
	}
	if tok, _ := flag(args, "--token"); tok != "" {
		cfg.Token = tok
	} else {
		fmt.Fprintf(os.Stderr, "Sign in to %s (paste an API token as the email to use a token instead)\n", cfg.APIURL)
		email := prompt("Email or token: ", false)
		if strings.HasPrefix(email, "pgc_") {
			cfg.Token = email
		} else {
			pw := prompt("Password: ", true)
			var res struct {
				Session string `json:"session"`
				Team    struct {
					Slug string `json:"slug"`
				} `json:"team"`
			}
			cfg.Token = ""
			if err := call(http.MethodPost, "/v1/auth/login", map[string]string{"email": email, "password": pw}, &res); err != nil {
				return err
			}
			cfg.Token, cfg.Team = res.Session, res.Team.Slug
		}
	}
	var me map[string]any
	if err := call(http.MethodGet, "/v1/account", nil, &me); err != nil {
		return err
	}
	if err := saveConfig(); err != nil {
		return err
	}
	t := me["team"].(map[string]any)
	fmt.Fprintf(stdout, "✓ logged in as %s — team %s — saved to %s\n", me["user"].(map[string]any)["email"], t["slug"], configPath())
	return nil
}

func cmdGet(path string, show func(map[string]any)) error {
	var v map[string]any
	if err := call(http.MethodGet, path, nil, &v); err != nil {
		return err
	}
	if jsonOut {
		emit(v)
	} else {
		show(v)
	}
	return nil
}

func cmdList(path string, filter func(map[string]any) bool, cols []string) error {
	var res struct {
		Data []map[string]any `json:"data"`
	}
	if err := call(http.MethodGet, path, nil, &res); err != nil {
		return err
	}
	rows := res.Data
	if filter != nil {
		rows = rows[:0]
		for _, r := range res.Data {
			if filter(r) {
				rows = append(rows, r)
			}
		}
	}
	if jsonOut {
		emit(rows)
	} else {
		table(rows, cols)
	}
	return nil
}

var serverCols = []string{"name", "status", "networks.v4[0].ipAddress", "size.id", "image.name", "region.id", "id"}

func cmdServers(args []string) error {
	if len(args) == 0 {
		args = []string{"ls"}
	}
	sub, rest := args[0], args[1:]
	switch sub {
	case "ls", "list":
		return cmdList("/v1/servers", nil, serverCols)
	case "create":
		if len(rest) == 0 {
			return errors.New("usage: servers create NAME [--size S] [--image I] [--key ID] [--user-data FILE] [--wait]")
		}
		name := rest[0]
		size, rest := flag(rest[1:], "--size")
		image, rest := flag(rest, "--image")
		keys, rest := multi(rest, "--key")
		userData, rest := flag(rest, "--user-data")
		wait, _ := has(rest, "--wait")
		body := map[string]any{"name": name, "size": or(size, "s-1vcpu-1gb"), "image": or(image, "ubuntu-24-04")}
		if project != "" {
			body["project"] = project
		}
		if len(keys) > 0 {
			body["sshKeys"] = keys
		} else if ids := defaultKeys(); len(ids) > 0 {
			body["sshKeys"] = ids
		}
		if userData != "" {
			b, err := os.ReadFile(userData)
			if err != nil {
				return err
			}
			body["userData"] = string(b)
		}
		var s map[string]any
		if err := call(http.MethodPost, "/v1/servers", body, &s); err != nil {
			return err
		}
		if wait {
			return waitServer(s["id"].(string))
		}
		if jsonOut {
			emit(s)
		} else {
			fmt.Fprintf(stdout, "✓ %s created (%s) — status %s. Watch with: pgcloud servers get %s\n", s["name"], s["id"], s["status"], s["id"])
		}
		return nil
	case "get":
		id, err := resolveServer(rest)
		if err != nil {
			return err
		}
		return cmdGet("/v1/servers/"+id, func(s map[string]any) { table([]map[string]any{s}, serverCols) })
	case "start", "stop", "reboot", "snapshot", "resize", "rebuild":
		id, err := resolveServer(rest)
		if err != nil {
			return err
		}
		body := map[string]any{"type": sub}
		if v, _ := flag(rest, "--size"); v != "" {
			body["size"] = v
		}
		if v, _ := flag(rest, "--image"); v != "" {
			body["image"] = v
		}
		var a map[string]any
		if err := call(http.MethodPost, "/v1/servers/"+id+"/actions", body, &a); err != nil {
			return err
		}
		fmt.Fprintf(stdout, "✓ %s queued (action %s)\n", sub, a["id"])
		return nil
	case "delete", "rm":
		id, err := resolveServer(rest)
		if err != nil {
			return err
		}
		if y, _ := has(rest, "--yes"); !y && strings.ToLower(prompt(fmt.Sprintf("Delete server %s? [y/N] ", id), false)) != "y" {
			return errors.New("aborted")
		}
		if err := call(http.MethodDelete, "/v1/servers/"+id, nil, nil); err != nil {
			return err
		}
		fmt.Fprintln(stdout, "✓ delete queued")
		return nil
	}
	return fmt.Errorf("unknown servers subcommand %q", sub)
}

func or(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

// resolveServer accepts an id or a name.
func resolveServer(args []string) (string, error) {
	if len(args) == 0 || strings.HasPrefix(args[0], "--") {
		return "", errors.New("server name or id required")
	}
	q := args[0]
	var res struct {
		Data []map[string]any `json:"data"`
	}
	if err := call(http.MethodGet, "/v1/servers", nil, &res); err != nil {
		return "", err
	}
	for _, s := range res.Data {
		if s["id"] == q || s["name"] == q {
			return s["id"].(string), nil
		}
	}
	return "", fmt.Errorf("no server named %q", q)
}

func defaultKeys() []string {
	var res struct {
		Data []map[string]any `json:"data"`
	}
	if call(http.MethodGet, "/v1/ssh-keys", nil, &res) != nil {
		return nil
	}
	var ids []string
	for _, k := range res.Data {
		ids = append(ids, k["id"].(string))
	}
	return ids
}

func waitServer(id string) error {
	start := time.Now()
	for {
		var s map[string]any
		if err := call(http.MethodGet, "/v1/servers/"+id, nil, &s); err != nil {
			return err
		}
		st := fmt.Sprint(s["status"])
		if !jsonOut {
			fmt.Fprintf(os.Stderr, "\r%-14s %3.0fs", st, time.Since(start).Seconds())
		}
		if st == "active" || st == "failed" || st == "off" {
			if !jsonOut {
				fmt.Fprintln(os.Stderr)
				ip := dig(s, "networks.v4[0].ipAddress")
				fmt.Fprintf(stdout, "✓ %s is %s — %v\n", s["name"], st, ip)
				if st == "active" && ip != nil {
					fmt.Fprintf(stdout, "  ssh root@%v\n", ip)
				}
			} else {
				emit(s)
			}
			if st == "failed" {
				return fmt.Errorf("provisioning failed: %v", s["statusMessage"])
			}
			return nil
		}
		time.Sleep(2 * time.Second)
	}
}

func cmdSSH(args []string) error {
	id, err := resolveServer(args)
	if err != nil {
		return err
	}
	var s map[string]any
	if err := call(http.MethodGet, "/v1/servers/"+id, nil, &s); err != nil {
		return err
	}
	ip := dig(s, "networks.v4[0].ipAddress")
	if ip == nil {
		return errors.New("server has no public IP yet")
	}
	ssh, err := exec.LookPath("ssh")
	if err != nil {
		return errors.New("ssh not found in PATH")
	}
	argv := []string{"ssh", "root@" + fmt.Sprint(ip)}
	if i := indexOf(args, "--"); i >= 0 {
		argv = append(argv, args[i+1:]...)
	}
	stdout.Flush()
	return syscall.Exec(ssh, argv, os.Environ())
}

func indexOf(a []string, s string) int {
	for i, x := range a {
		if x == s {
			return i
		}
	}
	return -1
}

var deployCols = []string{"name", "status", "url", "branch", "lastCommit", "id"}

func cmdDeploy(args []string) error {
	if len(args) == 0 || strings.HasPrefix(args[0], "--") {
		return errors.New("usage: pgcloud deploy https://github.com/you/app [--branch main] [--port 3000] [--size S] [--env K=V] [--name N] [--wait]")
	}
	repo := args[0]
	branch, rest := flag(args[1:], "--branch")
	port, rest := flag(rest, "--port")
	size, rest := flag(rest, "--size")
	name, rest := flag(rest, "--name")
	token, rest := flag(rest, "--git-token")
	envs, rest := multi(rest, "--env")
	wait, _ := has(rest, "--wait")
	body := map[string]any{"repoUrl": repo}
	if branch != "" {
		body["branch"] = branch
	}
	if port != "" {
		var p int
		fmt.Sscanf(port, "%d", &p)
		body["port"] = p
	}
	if size != "" {
		body["size"] = size
	}
	if name != "" {
		body["name"] = name
	}
	if token != "" {
		body["gitToken"] = token
	}
	if project != "" {
		body["project"] = project
	}
	if len(envs) > 0 {
		m := map[string]string{}
		for _, e := range envs {
			k, v, _ := strings.Cut(e, "=")
			m[k] = v
		}
		body["env"] = m
	}
	if ids := defaultKeys(); len(ids) > 0 {
		body["sshKeys"] = ids
	}
	var d map[string]any
	if err := call(http.MethodPost, "/v1/deploys", body, &d); err != nil {
		return err
	}
	if jsonOut {
		emit(d)
	} else {
		wh := d["webhook"].(map[string]any)
		fmt.Fprintf(stdout, "✓ deployment %s created (%s)\n\n", d["name"], d["id"])
		fmt.Fprintf(stdout, "Redeploy on every push — add this webhook in GitHub → Settings → Webhooks:\n  Payload URL:   %s\n  Content type:  application/json\n  Secret:        %s   (shown once)\n  Events:        push\n\n", wh["url"], wh["secret"])
	}
	if wait {
		if err := waitServer(d["serverId"].(string)); err != nil {
			return err
		}
		fmt.Fprintf(stdout, "→ building on the server; follow with: pgcloud deploys get %s\n", d["id"])
	}
	return nil
}

func cmdDeploys(args []string) error {
	if len(args) == 0 {
		args = []string{"ls"}
	}
	switch args[0] {
	case "ls", "list":
		return cmdList("/v1/deploys", nil, deployCols)
	case "get":
		if len(args) < 2 {
			return errors.New("deploy id required")
		}
		return cmdGet("/v1/deploys/"+args[1], func(d map[string]any) { table([]map[string]any{d}, deployCols) })
	case "redeploy":
		if len(args) < 2 {
			return errors.New("deploy id required")
		}
		var r map[string]any
		if err := call(http.MethodPost, "/v1/deploys/"+args[1]+"/redeploy", map[string]any{}, &r); err != nil {
			return err
		}
		fmt.Fprintln(stdout, "✓ redeploy triggered")
		return nil
	}
	return fmt.Errorf("unknown deploys subcommand %q", args[0])
}

func cmdPricing(args []string) error {
	cur, _ := flag(args, "--currency")
	var res struct {
		Currency string           `json:"currency"`
		Data     []map[string]any `json:"data"`
	}
	if err := call(http.MethodGet, "/v1/pricing?currency="+or(cur, "TRY"), nil, &res); err != nil {
		return err
	}
	if jsonOut {
		emit(res)
		return nil
	}
	sort.Slice(res.Data, func(i, j int) bool {
		return res.Data[i]["monthlyMinor"].(float64) < res.Data[j]["monthlyMinor"].(float64)
	})
	w := tabwriter.NewWriter(stdout, 0, 4, 2, ' ', 0)
	fmt.Fprintln(w, "SKU\tMONTHLY\tHOURLY")
	for _, p := range res.Data {
		fmt.Fprintf(w, "%s\t%s\t%s\n", p["sku"], money(p["monthlyMinor"], res.Currency), money(p["hourlyMinor"], res.Currency))
	}
	w.Flush()
	return nil
}

func cmdSSHKeys(args []string) error {
	if len(args) == 0 || args[0] == "ls" {
		return cmdList("/v1/ssh-keys", nil, []string{"name", "fingerprint", "id"})
	}
	if args[0] == "add" {
		if len(args) < 3 {
			return errors.New("usage: ssh-keys add NAME ~/.ssh/id_ed25519.pub")
		}
		b, err := os.ReadFile(expand(args[2]))
		if err != nil {
			return err
		}
		var k map[string]any
		if err := call(http.MethodPost, "/v1/ssh-keys", map[string]string{"name": args[1], "publicKey": strings.TrimSpace(string(b))}, &k); err != nil {
			return err
		}
		fmt.Fprintf(stdout, "✓ added %s (%s)\n", k["name"], k["fingerprint"])
		return nil
	}
	return fmt.Errorf("unknown ssh-keys subcommand %q", args[0])
}

func expand(p string) string {
	if strings.HasPrefix(p, "~/") {
		h, _ := os.UserHomeDir()
		return filepath.Join(h, p[2:])
	}
	return p
}

func cmdTokens(args []string) error {
	if len(args) == 0 || args[0] == "ls" {
		return cmdList("/v1/tokens", nil, []string{"name", "prefix", "isAgent", "spendCapMinor", "scopes", "id"})
	}
	if args[0] == "create" && len(args) >= 2 {
		agent, rest := has(args[2:], "--agent")
		cap, rest := flag(rest, "--cap")
		scopes, rest := multi(rest, "--scope")
		if len(scopes) == 0 {
			scopes = []string{"servers:read", "servers:write", "apps:read", "network:read"}
		}
		body := map[string]any{"name": args[1], "scopes": scopes, "isAgent": agent}
		if cap != "" {
			var f float64
			fmt.Sscanf(cap, "%f", &f)
			body["spendCapMinor"] = int(f * 100)
			body["requireApprovalFor"] = []string{"servers:delete", "servers:resize-down"}
		}
		var t map[string]any
		if err := call(http.MethodPost, "/v1/tokens", body, &t); err != nil {
			return err
		}
		fmt.Fprintf(stdout, "✓ token %s created — copy it now, it is shown once:\n%s\n", args[1], t["token"])
		if agent {
			fmt.Fprintf(stdout, "\nAdd to Claude Code:  claude mcp add pgcloud -e PGCLOUD_TOKEN=%s -- pgcloud-mcp\n", t["token"])
		}
		return nil
	}
	if args[0] == "revoke" && len(args) >= 2 {
		return call(http.MethodDelete, "/v1/tokens/"+args[1], nil, nil)
	}
	return errors.New("usage: tokens ls | create NAME [--agent --cap 500 --scope S...] | revoke ID")
}
