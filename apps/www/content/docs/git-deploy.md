---
title: Deploy from GitHub
description: Connect a repository once. Every push to the branch deploys your app on its own server.
section: Start here
order: 3
---

Git Deploy takes a repository, creates a server, installs Docker, builds your app and keeps it running. After that, a webhook from GitHub redeploys on every push to the branch you chose.

## What your repository needs

One of these, at the root:

- a `Dockerfile`: the app is built and run from it, listening on the port you set (default 3000)
- a `docker-compose.yml` or `compose.yaml`: brought up as is
- neither: a Node, Python or Go project is detected and a matching Dockerfile is generated

Environment variables you enter are written to the server and passed to the container. Secrets never leave the server.

## From the console

Go to **Projects, Deploys** and choose **Deploy a repository**. Paste the repository URL, pick the branch, set the port and any variables, and confirm. Private repositories need a token with read access; it is stored on the server only.

The deploy shows `provisioning`, then `building`, then `running` with the public address. Logs from the build are on the deploy page.

## From the command line

```sh
pgcloud deploy https://github.com/you/app --branch main --port 8080 --env DATABASE_URL=...
pgcloud deploys ls
pgcloud deploys redeploy dep_123
```

## Automatic redeploys

Each deploy has a webhook address and a secret, shown on its page. Add it to the repository under **Settings, Webhooks** with content type `application/json` and the push event. Pushes to other branches are ignored. Every delivery is checked with the `X-Hub-Signature-256` header before anything runs.

If you would rather not touch repository settings, the CLI step in your CI works just as well: `pgcloud deploys redeploy ID` after your tests pass.

## Redeploy and roll back

**Redeploy** pulls the branch, rebuilds and restarts. To roll back, redeploy from a tag or an earlier commit by changing the branch on the deploy page. The server keeps its address through all of this.
