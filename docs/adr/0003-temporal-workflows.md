# ADR 0003 — Lifecycle operations are Temporal workflows

**Status**: accepted · **Date**: 2026-09-25

## Context

"Everything is a workflow": create, resize, rebuild, delete must be durable and
retryable, roll back cleanly, and never bill a broken server.

## Decision

- API handlers validate, persist the resource in state `new`, return `202`, and start a
  Temporal workflow. They never call the driver.
- Workflows live in `apps/api/src/workflows/`; side effects live in activities.
- Every activity is idempotent (safe to retry) and keyed by the resource ID.
- Compensation: `createServer` releases the IP, deletes the VM and marks the server
  `failed` if any step fails after retries; billing starts only after the VM is `running`.
- Workflow ID = `<operation>-<resourceId>` so duplicate starts are rejected by Temporal.

## Consequences

- Provisioning survives API restarts; state is visible in the Temporal UI.
- The `worker` process must run alongside `api`.
