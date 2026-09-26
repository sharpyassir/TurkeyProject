---
title: Command line
description: Install Progrid on your computer and manage everything from the terminal.
section: Start here
order: 2
---

The `pgcloud` command is a single binary for Linux, macOS and Windows with no dependencies.

## Install

```sh
curl -fsSL https://get.progrid.sa | sh
```

On Windows, download the zip from the releases page and put `pgcloud.exe` on your `PATH`.

## Sign in

```sh
pgcloud login
```

Enter your email and password. If two factor sign in is on, you are asked for the code from your authenticator app. The session is saved in `~/.config/pgcloud/config.json`. You can also paste an API token instead of an email to use that token.

## Your first server

```sh
pgcloud servers create web-1 --size s-1vcpu-1gb --image ubuntu-24-04 --wait
pgcloud servers ls
pgcloud ssh web-1
```

`--wait` blocks until the server is active and prints its address. Every create call sends an idempotency key, so a retried command never makes two servers.

## Everyday commands

| Task | Command |
|---|---|
| List sizes with prices | `pgcloud sizes` |
| List images and one click apps | `pgcloud images` |
| Stop, start, reboot | `pgcloud servers stop web-1`, `start`, `reboot` |
| Resize | `pgcloud servers resize web-1 --size s-2vcpu-4gb` |
| Take a snapshot | `pgcloud servers snapshot web-1` |
| Delete | `pgcloud servers delete web-1` |
| Deploy a repository | `pgcloud deploy https://github.com/you/app --branch main` |
| See spend | `pgcloud billing` |
| Create an agent token | `pgcloud tokens create claude --agent --cap 15` |
| Review agent requests | `pgcloud approvals ls`, `approve ID`, `deny ID --reason TEXT` |

Add `--json` to any command to get the raw API response, which is handy in scripts:

```sh
pgcloud servers ls --json | jq -r '.data[] | select(.status=="active") | .networks.v4[0].ipAddress'
```

## Scripting and CI

In CI, set `PGCLOUD_TOKEN` to an API token and `PGCLOUD_API_URL` if you use a different endpoint. The CLI reads those before the config file, so no login step is needed.

```yaml
- run: curl -fsSL https://get.progrid.sa | sh
- run: pgcloud deploy https://github.com/${{ github.repository }} --branch ${{ github.ref_name }}
  env:
    PGCLOUD_TOKEN: ${{ secrets.PGCLOUD_TOKEN }}
```
