---
title: Managed databases
description: PostgreSQL clusters we run for you, with failover, backups and pooling.
section: Guides
order: 19
---

## What you get

A managed database is a PostgreSQL cluster on nodes we own, patch and replace. One node for
development, or three nodes with automatic failover for production: the nodes elect a primary
between themselves, and the cluster address follows it, so your application reconnects to the
same host after a failover. Every cluster has TLS, a connection pooler, nightly backups to
object storage with continuous archiving, and the pgvector extension. Valkey and MySQL follow
the same design and are next.

Pricing is per node per month, twice the price of a server of the same size, backups and the
address included.

## Create a cluster

From the console under **Managed databases**, from the CLI, or the API:

```
pgcloud databases create app-db --size s-1vcpu-2gb --nodes 3 --trusted 203.0.113.0/24 --wait
```

```
POST /v1/databases
{ "name": "app-db", "engine": "postgres", "size": "s-1vcpu-2gb", "nodes": 3, "trustedSources": ["203.0.113.0/24"] }
```

The size is any server size with at least 1 GB of memory. The cluster is `active` after a few
minutes, and `GET /v1/databases/{id}` returns the connection details: host, private host, port
5432, the pooler on 6432, an admin user, an `app` user, a `defaultdb` database and ready made
connection strings. Connect with any PostgreSQL client:

```
psql "postgresql://app:PASSWORD@HOST:5432/defaultdb?sslmode=require"
```

Use the private host from servers in the same project; it never leaves our network. Use the
pooler port for applications that open many short lived connections.

## Users and databases

Add users and databases from the cluster page, the CLI, or the API. Passwords are generated
and shown once; reset one when it is lost. Removing a database from the cluster keeps the data
on disk until you drop it yourself, so a slip is recoverable.

```
pgcloud databases users ID add reporting
pgcloud databases dbs ID add analytics
```

## Trusted sources

By default any address may reach the database port with the password over TLS. Set trusted
sources to the addresses and networks that should be allowed; everything else is dropped by
the host firewall before it reaches the database.

```
pgcloud databases trusted ID 203.0.113.0/24,198.51.100.7
```

## Backups and recovery

A full backup runs every night at the hour you choose (02:00 UTC by default) and is kept for
seven days, and the write ahead log is archived continuously, so recovery to any point in the
last seven days is possible. Take a backup before a risky migration with **Back up now** or
`pgcloud databases backups ID now`. Restores are done by support for now; a self service
restore to a new cluster is planned.

## Failover and maintenance

With three nodes, a failed primary is replaced by a replica within about thirty seconds and
the address moves with it; a `database.failover` event tells your webhooks. Minor version
updates are applied to replicas first and then to the primary through a switchover.

## Terraform, SDKs and agents

Terraform manages clusters with `pgcloud_database`; `password` and `uri` are sensitive. The
SDKs expose `databases` with users, databases, backups and `waitUntilActive`. Agent tokens
need `databases:read` and `databases:write`; the MCP server exposes `list_databases`,
`create_database` and `database_admin`.

## Limits

| Limit | Value |
| --- | --- |
| Nodes | 1 or 3 |
| Users per cluster | 50 |
| Databases per cluster | 100 |
| Trusted sources | 50 |
| Engines | PostgreSQL 16 today; Valkey 8 and MySQL 8.0 next |
