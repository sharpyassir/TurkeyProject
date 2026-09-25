# Developer experience — the business hook

The doc's thesis: developers choose DigitalOcean for simplicity and documentation, so DX is
a product feature. This page lists every way a developer can get code onto pgcloud and what
state each path is in.

## Paths to a running app

| Path | How | State |
|---|---|---|
| **Console** | Create server / one-click app in the browser | ✅ |
| **CLI** (`pgcloud`) | Single Go binary; `curl … \| sh`; `pgcloud servers create … --wait`, `pgcloud ssh`, `pgcloud deploy` | ✅ (`cli/`) |
| **Git Deploy** | `pgcloud deploy https://github.com/you/app` → server clones + builds (Dockerfile / compose) → GitHub push webhook redeploys | ✅ (`apps/api/src/modules/deploy`) |
| **REST API** | `POST /v1/servers` etc., idempotency keys, cursor pagination, `/docs` | ✅ |
| **AI agents** | Agent token + MCP server (`packages/mcp-server`, `npx -y pgcloud-mcp`) | ✅ |
| Terraform provider | Go, generated from the OpenAPI spec | phase 2 |
| SDKs (Go / Python / JS) | Generated from `packages/openapi/openapi.yaml` | phase 2 |
| GitHub App ("Deploy to pgcloud" button, PR previews) | Replaces manual webhook setup; one-click connect | phase 2 |

## Git Deploy — how it works

```
pgcloud deploy https://github.com/you/app --branch main --port 3000
        │
        ▼
POST /v1/deploys ──► creates a normal server (ubuntu-24-04, tag git-deploy)
                     with cloud-init that: installs Docker → clones repo →
                     docker compose up / docker build+run (app on :80) →
                     starts pgcloud-deployd (:9009, redeploy hook)
        │
        ▼
GitHub → Settings → Webhooks → Payload URL /v1/deploys/<id>/hook + secret (shown once)
        │
   git push ──► GitHub POSTs (X-Hub-Signature-256) ──► control plane verifies HMAC,
                ignores other branches ──► POST http://<ip>:9009/redeploy (VM secret)
                ──► deploy.sh: git reset --hard origin/<branch> → rebuild → restart
```

Why on a plain server rather than a PaaS: it inherits quotas, spend caps, metering,
firewalls, snapshots and the workflow engine for free, and the developer keeps root
(`pgcloud ssh app`). App Platform-style buildpacks, zero-downtime swaps and PR previews
are the phase-2 upgrade on top of the same model.

Security notes: the GitHub secret is stored server-side and verified with a constant-time
compare; the VM secret is only in cloud-init and `/opt/pgcloud/vm.secret`; the redeploy
port is firewalled to the control-plane CIDR (`CONTROL_PLANE_CIDR`); private repos use a
token that never touches our database.

## CLI conventions (mirrors `doctl`)

- `pgcloud <resource> <verb>`; `ls` / `get` / `create` / `delete`; names resolve to ids.
- `--wait` blocks until a server is `active` and prints the `ssh` line.
- `--json` everywhere; errors carry the API's `code` and `details`.
- Login stores a session or token in `~/.config/pgcloud/config.json` (0600);
  `PGCLOUD_TOKEN` / `PGCLOUD_API_URL` override for CI.
- Every mutation sends an `Idempotency-Key`.
- Releases: tag → GitHub Actions → `pgcloud_<os>_<arch>.tar.gz` for linux/darwin
  (amd64/arm64) and a Windows zip; `cli/install.sh` is what `get.pgcloud.example` serves.

## What "developer friendly" still needs (ordered)

1. Docs site with copy-paste quickstarts in TR/EN/AR (the go-to-market growth engine).
2. GitHub App: connect a repo from the console, no webhook pasting; PR preview servers.
3. SDK generation from the OpenAPI spec; Terraform provider.
4. Status page and a public changelog.

## Account security

- **Email confirmation**: signup sends a link (24 hours). Servers cannot be created until the team owner
  confirms. `POST /v1/auth/verify/request` sends it again.
- **Password reset**: `POST /v1/auth/password/forgot` always answers 204; the link lasts one hour and every
  other outstanding link dies once one is used.
- **Two factor sign in**: standard TOTP (RFC 6238, six digits, 30 seconds) implemented on `node:crypto`, so any
  authenticator app works. Enrollment is setup, then confirm a code, then save ten one time recovery codes.
  With `REQUIRE_TOTP_FOR_OWNERS=true` a team owner's console session is limited to the account and two factor
  endpoints until it is on. API tokens are exempt because they are scoped, capped and revocable. The CLI asks for
  the code during `pgcloud login`.
- **Rate limits** live in `RateLimitGuard` (fixed windows in Redis, keyed by token after auth, by IP before).
  They degrade open if Redis is down so a cache outage never takes the API with it.
- **Mail** goes through `MailService`: `MAIL_PROVIDER=log` prints to the API log in development;
  `postmark` and `resend` are wired for production with `MAIL_API_KEY` and `MAIL_FROM`.
