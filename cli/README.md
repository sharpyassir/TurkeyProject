# pgcloud CLI

One static Go binary, zero dependencies, same API as the console.

```sh
curl -fsSL https://get.pgcloud.example | sh        # macOS / Linux, amd64 / arm64
pgcloud login                                        # email + password, or paste a pgc_ token
```

```sh
pgcloud servers create web-1 --size s-2vcpu-4gb --image ubuntu-24-04 --wait
pgcloud ssh web-1
pgcloud deploy https://github.com/you/app --branch main --port 3000 --wait
pgcloud deploys ls
pgcloud tokens create claude --agent --cap 500      # agent token, ₺500/month cap
pgcloud --json servers ls | jq '.[].networks.v4[0].ipAddress'
```

- Config: `~/.config/pgcloud/config.json` (`PGCLOUD_TOKEN` / `PGCLOUD_API_URL` override).
- Every mutation sends an `Idempotency-Key`; retries are safe.
- `--json` on any command for scripts and agents.
- Windows: same binary, `pgcloud.exe`, via the releases page (winget/scoop later).

Build: `go build -ldflags "-X main.version=$(git describe --tags --always)" -o pgcloud .`
Releases: GitHub Actions cross-compiles `linux/darwin/windows × amd64/arm64` on tag push (`.github/workflows/release.yml`).
