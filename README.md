# pgcloud — AI-Native Developer Cloud

API-first control plane on top of Proxmox VE (KVM) + Ceph. The same API powers the
web console, CLI, Terraform, SDKs and AI agents.

> `pgcloud` is a working name (the brand/domain is still an open decision — see
> `docs/architecture.md`). It is used for package scopes, the CLI binary name and
> the NATS subject prefix, and is trivial to rename later.

## Layout

```
apps/
  api/          Control plane — NestJS + Prisma modular monolith (TypeScript)
  console/      Web console — Next.js (TR / AR / EN, RTL-ready)
  www/          Marketing site — Next.js (pgcloud.example), pricing pulled live from the API
cli/            `pgcloud` CLI — single Go binary (login, servers, ssh, deploy, tokens); `cli/install.sh`
agents/
  host-agent/   Go service on every Proxmox node: takes jobs from NATS, calls the
                Proxmox API, reports health + usage every minute
packages/
  openapi/      OpenAPI v1 spec — source of truth for SDKs, CLI and docs
infra/
  dev/          docker-compose for local development (Postgres+Timescale, Redis,
                NATS, Temporal)
docs/
  architecture.md   The architecture document this repo implements
  adr/              Architecture decision records
```

## Quick start (local)

```bash
# 1. infrastructure
docker compose -f infra/dev/docker-compose.yml up -d

# 2. control plane
pnpm install
cp .env.example .env
pnpm --filter @pgcloud/api prisma:migrate   # creates schema + Timescale hypertable
pnpm --filter @pgcloud/api seed             # region ist1, sizes, images, price book, dev user
pnpm --filter @pgcloud/api dev              # API on http://localhost:4000  (Swagger at /docs)
pnpm --filter @pgcloud/api worker           # Temporal worker (provisioning workflows)

# 3. a fake "host" so servers can actually be created without Proxmox
HYPERVISOR_DRIVER=fake pnpm --filter @pgcloud/api worker

# 4. console
pnpm --filter @pgcloud/console dev          # http://localhost:3000
pnpm --filter @pgcloud/www dev              # http://localhost:3001 (marketing site)

# 5. host agent (real node)
cd agents/host-agent && go build ./... && ./host-agent --config /etc/pgcloud/agent.yaml
```

Create a server with the seeded dev token:

```bash
curl -X POST localhost:4000/v1/servers \
  -H "Authorization: Bearer $PGCLOUD_TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"name":"web-1","size":"s-2vcpu-4gb","image":"ubuntu-24-04","region":"ist1","project":"default"}'
```

## Design principles (from the architecture doc)

1. **API-first** — every action exists in the public API before the console.
2. **Control plane ≠ data plane** — customer VMs keep running if the API is down.
3. **Swappable engine** — all hypervisor calls go through `HypervisorDriver`
   (`apps/api/src/drivers/`). Proxmox today, OpenStack / bare KVM later.
4. **Everything is a workflow** — provisioning, resize, delete run as durable Temporal
   workflows; never fire-and-forget.
5. **AI-native** — agents are first-class API clients with scoped tokens and spend caps.
6. **Metered from day one** — every resource emits usage events for hourly billing.
7. **Multi-region ready** — `ist1` is region one; the data model has regions from day one.

## Build phases

| Phase | Months | Scope |
|---|---|---|
| MVP | 1–3 | accounts, teams, SSH keys; servers (create/resize/reboot/delete); images + snapshots; public IPs + firewalls; 15 marketplace apps; hourly billing, TRY/USD invoices; API v1 + console; back-office; abuse checks |
| 2 | 4–9 | VPCs, volumes, backups, LBs, DNS; CLI, SDKs, Terraform; MCP server, agent-safe tokens, console assistant; webhooks; status page |
| 3 | 10–18 | managed DBs, object storage, Kubernetes; vendor marketplace; inference gateway; GPU servers; second region |

## Status

This repository implements the **MVP control plane**, verified end-to-end against the
fake driver (create → `provisioning` → `active` with public + private IP in ~6 s; stop /
start / resize / rebuild / snapshot / delete; metering → hourly rating → invoices):

| Area | State |
|---|---|
| IAM: signup/login, teams, projects, RBAC scopes, API tokens, **agent-safe tokens** (spend cap, approval rules), SSH keys | ✅ |
| Compute: servers, sizes, images, lifecycle actions as Temporal workflows, quotas | ✅ |
| **Git Deploy**: repo → server → build → GitHub push redeploys (`POST /v1/deploys`) | ✅ |
| **CLI** `pgcloud`: login, servers create/ssh/actions, deploy, tokens, `--json` | ✅ |
| Scheduler: least-loaded placement, anti-affinity, capacity from heartbeats | ✅ |
| Network: public IP pool, host-enforced firewalls | ✅ (VPCs, LBs, DNS: phase 2) |
| Storage: snapshots | ✅ (volumes, backups: phase 2) |
| Marketplace: 15 launch apps as image + cloud-init + variables | ✅ (vendor portal: phase 3) |
| Billing: per-minute metering, hourly rating with monthly cap, USD price book converted to TRY at a stored exchange rate (hourly refresh, admin override), invoices, credits, spend limits | ✅ (payment gateways, e-Fatura provider: integration points only) |
| Trust & safety: verification gate, abuse flags, suspension | ✅ (AI detection: phase 2) |
| Events: audit log, signed webhooks | ✅ |
| Back-office admin API | ✅ (admin UI: to do) |
| Host agent (Go) for Proxmox VE | ✅ builds; needs a real node to test |
| Console: login, servers, one-click apps, billing; EN/TR/AR with RTL | ✅ minimal |
| 2FA (TOTP), rate limiting, MCP server, GitHub App, Terraform, SDK generation | ⏳ |

### Local dev without Docker

`docker compose` is the easy path. Without it: install PostgreSQL 16 + Redis, download
`nats-server` and the `temporal` CLI (`temporal server start-dev --headless`), then run
the same commands as above. The Timescale migration is a no-op on plain Postgres (usage
events stay a regular table), so nothing else changes.
