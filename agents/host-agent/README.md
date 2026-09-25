# pgcloud host agent

A single static Go binary that runs on every Proxmox VE node.

```
control plane ──NATS request──▶ pgcloud.host.<hostId>.jobs ──▶ agent ──▶ local PVE API
control plane ◀──NATS publish── pgcloud.host.<hostId>.heartbeat (every minute)
control plane ◀──NATS publish── pgcloud.usage (usage.v1, per resource per minute)
```

- Jobs are request/reply; the agent de-duplicates on job id for one hour.
- Every result carries `retryable`, which drives the Temporal retry policy upstream.
- Boot completion is detected by the QEMU guest agent answering `ping` — golden images
  enable `qemu-guest-agent` as the last cloud-init step.
- cloud-init user-data is written to `/var/lib/vz/snippets/` and referenced via `cicustom`.
- Firewalls are applied on the host (`/qemu/<vmid>/firewall`), default policy DROP in.
- VMs are tagged `pgcloud;server-<id>;project-<id>` so usage is attributable offline.

Build: `go build -ldflags "-X main.version=$(git describe --tags --always)" -o host-agent .`

Node prerequisites (Ansible role to come): PVE API token with `PVEVMAdmin` + `PVEDatastoreUser` on the Ceph storage, `snippets` content enabled on `local`, SDN zone `customers` (VXLAN/EVPN), `vmbr0` with the public block routed.
