# ADR 0001 — Control plane is a modular monolith

**Status**: accepted · **Date**: 2026-09-25

## Context

The MVP is built by 1–2 engineers in ~3 months. The architecture lists ten control
plane modules (IAM, compute, scheduler, network, storage, marketplace, billing,
trust & safety, back-office, events).

## Decision

One NestJS application (`apps/api`) with one module per bounded context under
`src/modules/`. Modules communicate only through their exported service classes and
through domain events (`EventsService.emit`), never by reaching into another module's
Prisma tables directly. Each module owns its own Prisma models (grouped by comment in
`schema.prisma`).

Two processes run from the same codebase:

- `api` — HTTP server (public API + admin API)
- `worker` — Temporal worker executing provisioning workflows

## Consequences

- Splitting a module into its own service later means moving a directory and swapping
  in-process calls for HTTP/NATS; the boundaries already exist.
- One deploy unit, one database, simple local dev.
