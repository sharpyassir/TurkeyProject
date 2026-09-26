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

## Testing without a Proxmox node

`go test ./...` runs the agent end to end on a laptop or in CI. The harness in
`internal/agent/agent_test.go` starts an embedded NATS server, a simulated Proxmox API
(`internal/pvesim`) and one agent, then sends jobs over NATS exactly as the control plane
does and checks the replies and the simulated VM state.

What the simulator answers: next id, clone, config, resize, start, stop, shutdown, reboot,
delete, status, guest agent ping (after a boot delay), snapshot create and delete, firewall
options and rules, node and storage status, VM list, and task polling by UPID. It uses the
same JSON envelope and the same error texts as Proxmox, including `does not exist` on a
missing VM. `FailNext(op, n)` injects faults to test cleanup and retry classification.

Covered: create with cloud-init snippet, public network and attribution tags; wait for boot;
power actions; snapshot round trip; firewall replace with port range translation; resize and
the shrink refusal; delete idempotency; error codes (`bad_ref`, `unknown_job`,
`bad_image_ref`, `not_implemented`, `proxmox_500`, `job_failed`); duplicate job ids; the
heartbeat and per minute usage events; token rejection.

Not covered, and only a real node can show: token permissions, Ceph timing, SDN bridge
names, cloud-init inside the guest. Run the same jobs against the first node with
`PGCLOUD_SNIPPETS_DIR` unset before calling the data plane done.
