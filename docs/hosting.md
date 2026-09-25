# Hosting the control plane

This page answers one question: what do we run ourselves, and where. Everything in this repo is
ours to host. There is no managed platform underneath, so there are no platform environment
variables. Settings and secrets live in one file on the management host, rendered by Ansible.

## What runs where

| Piece | Runs on | How |
|---|---|---|
| API (`apps/api`, `node dist/main.js`) | management host | container, behind Caddy at `api.<domain>` |
| Worker (`apps/api`, `node dist/worker.js`) | management host | container, Temporal task queue |
| Console (`apps/console`) | management host | container, `console.<domain>` |
| Website (`apps/www`) | management host | container, `<domain>` |
| Postgres with TimescaleDB, Redis, NATS, Temporal | management host | containers with named volumes |
| Caddy | management host | container, ports 80 and 443, Let's Encrypt |
| Nightly backups | management host | container writing `/var/backups/pgcloud`, optional S3 copy |
| Host agent (`agents/host-agent`) | every Proxmox node | static binary under systemd, talks to NATS over the management network |
| Customer servers | Proxmox nodes | virtual machines on Ceph, created by the host agent |
| CLI, MCP server | the developer's machine | GitHub release binaries, npm package |

The management host is the only machine with a public address besides the customer IP blocks.
Proxmox nodes sit on the management network and reach the host through NATS on port 4222.

## Phase 0: one rented box

Goal: a public demo and the first design partners, before our own hardware is racked.

1. Rent one dedicated server with a public IP (8 cores, 32 GB, NVMe is plenty). Install Ubuntu 24.04.
2. Point DNS: `<domain>`, `www.<domain>`, `console.<domain>`, `api.<domain>` to that address.
3. Fill `infra/ansible/inventory.ini`, `group_vars/all.yml` and the vault. Set `hypervisor_driver: fake`
   if there is no Proxmox yet, or install Proxmox on the same box and point the agent at it.
4. `ansible-playbook -i inventory.ini site.yml --ask-vault-pass`. The role installs Docker, copies the
   compose bundle to `/opt/pgcloud`, writes `/etc/pgcloud/pgcloud.env`, opens the firewall and starts everything.
5. Add the GitHub secrets (`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `NEXT_PUBLIC_API_URL`).
   From then on every push to `main` builds images and rolls the host.

Everything is on one machine, so a disk failure means restoring from the nightly dump. Acceptable for a demo,
not for paying customers. Move to phase 1 before charging money.

## Phase 1: our own cluster

Three management virtual machines on the Proxmox cluster itself, each running part of the bundle:

| VM | Services |
|---|---|
| `mgmt-app` | Caddy, API, worker, console, website |
| `mgmt-data` | Postgres (with streaming replica on a second node), Redis, NATS |
| `mgmt-workflow` | Temporal and its UI |

The compose file already separates these by service name, so splitting is a matter of running a subset on
each VM and pointing `DATABASE_URL`, `REDIS_URL`, `NATS_URL` and `TEMPORAL_ADDRESS` at the data VMs
(they are plain environment variables in `pgcloud.env`). Backups go to object storage off the cluster.
Secrets move from the Ansible vault to OpenBao with agent templates when more than two people deploy.

## Images and releases

`.github/workflows/deploy.yml` builds `pgcloud-api`, `pgcloud-console` and `pgcloud-www` on every push to
`main` and pushes them to GitHub Container Registry tagged with the short commit sha and `latest`; a `v*`
tag adds the version. The deploy job then runs `/opt/pgcloud/deploy.sh <tag>` over SSH, which pulls, runs
`prisma migrate deploy` in a one shot container, restarts the services and checks `/healthz`.

To roll back: `sudo /opt/pgcloud/deploy.sh <previous sha>`. Migrations are forward only, so a rollback
across a migration needs a restore or a follow up migration.

## The settings file

`/etc/pgcloud/pgcloud.env` holds every setting the API reads plus what compose needs (domain, image tag,
Postgres password, NATS token). `infra/prod/pgcloud.env.example` shows the shape. Ansible renders it from
`group_vars/all.yml` and the vault; do not edit it by hand on the host.

Production values to set deliberately: `REQUIRE_TOTP_FOR_OWNERS=true`, a real `MAIL_PROVIDER` with its key,
`CONSOLE_URL` for the links in emails, and `HYPERVISOR_DRIVER=proxmox` with the control plane token.

## Backups and restore

The backup container dumps Postgres every night at 02:15 UTC to `/var/backups/pgcloud`, keeps
`BACKUP_KEEP_DAYS` days, and copies to `BACKUP_S3_URL` when set. Restore on a fresh host:

```sh
ansible-playbook -i inventory.ini site.yml --limit management --ask-vault-pass
cd /opt/pgcloud && docker compose --env-file /etc/pgcloud/pgcloud.env stop api worker
gunzip -c /var/backups/pgcloud/pgcloud-YYYYMMDD-0215.sql.gz | docker compose --env-file /etc/pgcloud/pgcloud.env exec -T postgres psql -U pgcloud pgcloud
docker compose --env-file /etc/pgcloud/pgcloud.env start api worker
```

Redis holds only locks, rate limit counters and idempotency keys; losing it is harmless. NATS JetStream
holds in flight host agent jobs; the worker retries them. Temporal state lives in Postgres.

## Operations

- **Logs**: `docker compose logs -f api worker` on the host. JSON file logging is capped at 100 MB per service.
- **Temporal UI**: `ssh -L 8080:127.0.0.1:8080 ops@<host>` then open `http://localhost:8080`. It is never public.
- **Health**: Caddy answers `https://api.<domain>/healthz`. Point an external uptime check at it.
- **Firewall**: ufw allows 22, 80, 443 to the world and 4222 only from the management network.
- **Adding a Proxmox node**: create the `Host` row through the admin API, put its id in the inventory, run
  the playbook with `--limit pve_nodes`. The agent starts sending heartbeats within a minute.
