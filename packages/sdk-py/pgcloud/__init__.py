"""pgcloud Python SDK.

    from pgcloud import Pgcloud
    pg = Pgcloud(token=os.environ["PGCLOUD_TOKEN"])
    server = pg.servers.create(name="web-1", size="s-1vcpu-1gb", image="ubuntu-24-04")
    server = pg.servers.wait_until_active(server["id"])
    print(server["networks"]["v4"][0]["ipAddress"])

No dependencies: urllib only. Every write sends an Idempotency-Key. Errors raise PgcloudError.
"""
from __future__ import annotations

import json
import os
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional

__all__ = ["Pgcloud", "PgcloudError"]
__version__ = "0.1.0"


class PgcloudError(Exception):
    def __init__(self, status: int, code: str, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(f"{code} ({status}): {message}")
        self.status, self.code, self.message, self.details = status, code, message, details or {}

    @property
    def needs_approval(self) -> bool:
        """True when a person must approve the request in the console; details['approvalId'] says which."""
        return self.code == "approval_required"


class Pgcloud:
    def __init__(self, token: str, base_url: Optional[str] = None, project: Optional[str] = None, timeout: float = 30.0, opener=None):
        if not token:
            raise ValueError("token is required")
        self.token = token
        self.base = (base_url or os.environ.get("PGCLOUD_API_URL") or "https://api.pgcloud.example").rstrip("/").removesuffix("/v1")
        self.project = project
        self.timeout = timeout
        self._open = opener or urllib.request.urlopen
        self.account = _Account(self)
        self.catalog = _Catalog(self)
        self.servers = _Servers(self)
        self.deploys = _Deploys(self)
        self.firewalls = _Firewalls(self)
        self.snapshots = _Snapshots(self)
        self.billing = _Billing(self)
        self.approvals = _Approvals(self)
        self.alerts = _Alerts(self)

    def request(self, method: str, path: str, body: Any = None, query: Optional[Dict[str, Any]] = None) -> Any:
        url = self.base + path
        q = {k: v for k, v in (query or {}).items() if v is not None}
        if q:
            url += "?" + urllib.parse.urlencode(q)
        headers = {"Authorization": f"Bearer {self.token}", "Accept": "application/json", "User-Agent": f"pgcloud-sdk-py/{__version__}"}
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
            headers["Idempotency-Key"] = str(uuid.uuid4())
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with self._open(req, timeout=self.timeout) as res:
                raw = res.read()
        except urllib.error.HTTPError as e:
            raw = e.read()
            try:
                err = json.loads(raw).get("error") or {}
            except ValueError:
                err = {}
            raise PgcloudError(e.code, err.get("code", "http_error"), err.get("message", str(e)), err.get("details")) from None
        return json.loads(raw) if raw else None


class _Res:
    def __init__(self, c: Pgcloud):
        self.c = c


class _Account(_Res):
    def me(self):
        return self.c.request("GET", "/v1/account")

    def tokens(self):
        return self.c.request("GET", "/v1/tokens")["data"]

    def create_token(self, name: str, scopes: list, is_agent: bool = False, spend_cap_minor: Optional[int] = None, require_approval_for: Optional[list] = None, **kw):
        body = {"name": name, "scopes": scopes, "isAgent": is_agent, "spendCapMinor": spend_cap_minor, "requireApprovalFor": require_approval_for, **kw}
        return self.c.request("POST", "/v1/tokens", {k: v for k, v in body.items() if v is not None})

    def ssh_keys(self):
        return self.c.request("GET", "/v1/ssh-keys")["data"]

    def add_ssh_key(self, name: str, public_key: str):
        return self.c.request("POST", "/v1/ssh-keys", {"name": name, "publicKey": public_key})


class _Catalog(_Res):
    def sizes(self):
        return self.c.request("GET", "/v1/sizes")["data"]

    def images(self, kind: Optional[str] = None):
        return self.c.request("GET", "/v1/images", query={"kind": kind})["data"]

    def regions(self):
        return self.c.request("GET", "/v1/regions")["data"]

    def pricing(self, currency: str = "USD"):
        return self.c.request("GET", "/v1/pricing", query={"currency": currency})


class _Servers(_Res):
    def list(self, **query):
        return self.c.request("GET", "/v1/servers", query={"project": self.c.project, **query})["data"]

    def get(self, id: str):
        return self.c.request("GET", f"/v1/servers/{id}")

    def create(self, name: str, size: str, image: str, **kw):
        return self.c.request("POST", "/v1/servers", {"project": self.c.project, "name": name, "size": size, "image": image, **kw})

    def action(self, id: str, type: str, **kw):
        return self.c.request("POST", f"/v1/servers/{id}/actions", {"type": type, **kw})

    def actions(self, id: str):
        return self.c.request("GET", f"/v1/servers/{id}/actions")["data"]

    def delete(self, id: str):
        return self.c.request("DELETE", f"/v1/servers/{id}")

    def metrics(self, id: str, period: str = "1h"):
        """CPU, memory, network and disk series: minute resolution up to 24h, hourly for 7d and 30d."""
        return self.c.request("GET", f"/v1/servers/{id}/metrics", query={"period": period})

    def wait_until_active(self, id: str, timeout: float = 180.0, interval: float = 3.0):
        """Polls until the server is active or off. Raises PgcloudError on failed or timeout."""
        until = time.time() + timeout
        while True:
            s = self.get(id)
            if s["status"] in ("active", "off"):
                return s
            if s["status"] == "failed":
                raise PgcloudError(500, "server_failed", s.get("statusMessage") or "Server provisioning failed")
            if time.time() > until:
                raise PgcloudError(504, "timeout", f"Server {id} is still {s['status']}")
            time.sleep(interval)


class _Deploys(_Res):
    def list(self):
        return self.c.request("GET", "/v1/deploys", query={"project": self.c.project})["data"]

    def get(self, id: str):
        return self.c.request("GET", f"/v1/deploys/{id}")

    def create(self, repo_url: Optional[str] = None, installation_id: Optional[str] = None, repo: Optional[str] = None, branch: str = "main", port: int = 3000, **kw):
        body = {"project": self.c.project, "repoUrl": repo_url, "installationId": installation_id, "repo": repo, "branch": branch, "port": port, **kw}
        return self.c.request("POST", "/v1/deploys", {k: v for k, v in body.items() if v is not None})

    def redeploy(self, id: str):
        return self.c.request("POST", f"/v1/deploys/{id}/redeploy", {})

    def logs(self, id: str):
        return self.c.request("GET", f"/v1/deploys/{id}/logs")


class _Firewalls(_Res):
    def list(self):
        return self.c.request("GET", "/v1/firewalls")["data"]

    def get(self, id: str):
        return self.c.request("GET", f"/v1/firewalls/{id}")

    def create(self, name: str, rules: list):
        return self.c.request("POST", "/v1/firewalls", {"project": self.c.project, "name": name, "rules": rules})

    def attach(self, id: str, server_id: str):
        return self.c.request("POST", f"/v1/firewalls/{id}/servers", {"serverId": server_id})

    def detach(self, id: str, server_id: str):
        return self.c.request("DELETE", f"/v1/firewalls/{id}/servers/{server_id}")

    def delete(self, id: str):
        return self.c.request("DELETE", f"/v1/firewalls/{id}")


class _Snapshots(_Res):
    def list(self):
        return self.c.request("GET", "/v1/snapshots")["data"]

    def delete(self, id: str):
        return self.c.request("DELETE", f"/v1/snapshots/{id}")


class _Billing(_Res):
    def balance(self):
        return self.c.request("GET", "/v1/billing/balance")

    def usage(self, **query):
        return self.c.request("GET", "/v1/billing/usage", query={"project": self.c.project, **query})["data"]

    def invoices(self):
        return self.c.request("GET", "/v1/billing/invoices")["data"]

    def topup(self, amount_minor: int):
        return self.c.request("POST", "/v1/billing/topup", {"amountMinor": amount_minor})

    def pay_invoice(self, id: str):
        return self.c.request("POST", f"/v1/billing/invoices/{id}/pay", {})


class _Alerts(_Res):
    def list(self):
        return self.c.request("GET", "/v1/alerts")["data"]

    def get(self, id: str):
        return self.c.request("GET", f"/v1/alerts/{id}")

    def create(self, name: str, metric: str, threshold: float, comparator: str = "above", window_minutes: int = 5, server_ids=None, tags=None, emails=None):
        return self.c.request("POST", "/v1/alerts", {"name": name, "metric": metric, "threshold": threshold, "comparator": comparator, "windowMinutes": window_minutes, "serverIds": server_ids or [], "tags": tags or [], "emails": emails or []})

    def update(self, id: str, **fields):
        return self.c.request("PATCH", f"/v1/alerts/{id}", fields)

    def delete(self, id: str):
        return self.c.request("DELETE", f"/v1/alerts/{id}")

    def incidents(self, open: bool = False):
        return self.c.request("GET", "/v1/alerts/incidents", query={"open": "true" if open else None})["data"]


class _Approvals(_Res):
    def list(self, status: Optional[str] = None):
        return self.c.request("GET", "/v1/approvals", query={"status": status})

    def get(self, id: str):
        return self.c.request("GET", f"/v1/approvals/{id}")

    def approve(self, id: str):
        return self.c.request("POST", f"/v1/approvals/{id}/approve", {})

    def deny(self, id: str, reason: Optional[str] = None):
        return self.c.request("POST", f"/v1/approvals/{id}/deny", {"reason": reason} if reason else {})

    def wait(self, id: str, timeout: float = 600.0):
        until = time.time() + timeout
        while True:
            a = self.get(id)
            if a["status"] != "pending" or time.time() > until:
                return a
            time.sleep(5)
