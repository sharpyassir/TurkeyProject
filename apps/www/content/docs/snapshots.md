---
title: Snapshots and backups
description: Copy a whole disk on demand, or let us do it every day.
section: Guides
order: 14
---

## Snapshots

A snapshot is a copy of the whole disk at that moment. Take one from the server's **Snapshots** tab, with `pgcloud servers snapshot web-1`, or with the `snapshot` action in the API. Snapshots are stored separately from the server, so they survive its deletion, and are charged per GB per month.

A snapshot taken while the server runs can miss data that was only in memory. For a database, stop the server first or use the database's own dump tool alongside.

Create a new server from a snapshot by choosing it as the image. The new server gets a fresh address.

## Backups

Turn on backups when you create a server, or later from its page, with `pgcloud servers backups ID on`, or `PATCH /v1/servers/{id}` with `backups: true`. We take a snapshot every night at 02:10 UTC and keep the last seven; they show in the snapshot list marked as daily backups and can be used like any snapshot. Backups cost 20 percent of the server price, and the backup snapshots themselves are not charged as snapshot storage.

## Retention

Snapshots stay until you delete them. Backups roll over after seven days. Deleting a server keeps its snapshots and stops its backups.
