/**
 * cloud-init for a Git Deploy server. Installs Docker, clones the repo, builds and runs it
 * (docker-compose.yml wins over a Dockerfile), publishes the app on :80, and installs
 * `pgcloud-deployd`: a tiny HTTP hook on :9009 that re-pulls and rebuilds when the control
 * plane forwards a GitHub push. Everything is plain bash + python3 so it runs on any image.
 */
export interface DeployInit {
  repoUrl: string;
  branch: string;
  port: number;
  vmSecret: string;
  envVars: Record<string, string>;
  /** Optional token for private repos (GitHub fine-grained PAT or deploy token). */
  gitToken?: string;
}

export function renderDeployCloudInit(d: DeployInit): string {
  const cloneUrl = d.gitToken ? d.repoUrl.replace('https://', `https://x-access-token:${d.gitToken}@`) : d.repoUrl;
  const envFile = Object.entries(d.envVars).map(([k, v]) => `${k}=${v.replace(/\n/g, '')}`).join('\n');
  return `#cloud-config
package_update: true
packages: [docker.io, docker-compose-v2, git, python3, ca-certificates]
write_files:
  - path: /opt/pgcloud/app.env
    permissions: '0600'
    content: |
${indent(envFile || '# no env vars', 6)}
  - path: /opt/pgcloud/deploy.sh
    permissions: '0755'
    content: |
      #!/usr/bin/env bash
      # Clone or update the repo, then build and run it. Idempotent; safe to re-run on every push.
      set -euo pipefail
      REPO='${cloneUrl}'
      BRANCH='${d.branch}'
      PORT='${d.port}'
      DIR=/srv/app
      LOG=/var/log/pgcloud-deploy.log
      exec >>"$LOG" 2>&1
      echo "=== deploy $(date -Is) ==="
      if [ -d "$DIR/.git" ]; then
        git -C "$DIR" fetch --depth 1 origin "$BRANCH" && git -C "$DIR" reset --hard "origin/$BRANCH"
      else
        git clone --depth 1 --branch "$BRANCH" "$REPO" "$DIR"
      fi
      cd "$DIR"
      git rev-parse HEAD > /opt/pgcloud/last-commit
      cp /opt/pgcloud/app.env .env 2>/dev/null || true
      if [ -f docker-compose.yml ] || [ -f compose.yml ] || [ -f docker-compose.yaml ]; then
        docker compose pull --ignore-buildable 2>/dev/null || true
        docker compose up -d --build --remove-orphans
      elif [ -f Dockerfile ]; then
        docker build -t pgcloud-app .
        docker rm -f pgcloud-app 2>/dev/null || true
        docker run -d --name pgcloud-app --restart unless-stopped --env-file /opt/pgcloud/app.env -p 80:"$PORT" pgcloud-app
      else
        echo "no Dockerfile or docker-compose.yml found in $DIR" >&2
        echo failed > /opt/pgcloud/status
        exit 1
      fi
      echo live > /opt/pgcloud/status
      echo "=== done $(date -Is) ==="
  - path: /opt/pgcloud/deployd.py
    permissions: '0755'
    content: |
      #!/usr/bin/env python3
      # Redeploy hook. The control plane POSTs /redeploy with X-Pgcloud-Secret after a GitHub push.
      import http.server, subprocess, os, json
      SECRET = open('/opt/pgcloud/vm.secret').read().strip()
      class H(http.server.BaseHTTPRequestHandler):
          def log_message(self, *a): pass
          def do_GET(self):
              if self.path != '/status': return self._send(404, {})
              st = open('/opt/pgcloud/status').read().strip() if os.path.exists('/opt/pgcloud/status') else 'deploying'
              commit = open('/opt/pgcloud/last-commit').read().strip() if os.path.exists('/opt/pgcloud/last-commit') else None
              self._send(200, {'status': st, 'commit': commit})
          def do_POST(self):
              if self.headers.get('X-Pgcloud-Secret') != SECRET: return self._send(401, {'error': 'unauthorized'})
              if self.path != '/redeploy': return self._send(404, {})
              open('/opt/pgcloud/status', 'w').write('deploying')
              subprocess.Popen(['/opt/pgcloud/deploy.sh'])
              self._send(202, {'status': 'deploying'})
          def _send(self, code, body):
              b = json.dumps(body).encode(); self.send_response(code); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
      http.server.ThreadingHTTPServer(('0.0.0.0', 9009), H).serve_forever()
  - path: /opt/pgcloud/vm.secret
    permissions: '0600'
    content: '${d.vmSecret}'
  - path: /etc/systemd/system/pgcloud-deployd.service
    content: |
      [Unit]
      Description=pgcloud redeploy hook
      After=network-online.target docker.service
      [Service]
      ExecStart=/opt/pgcloud/deployd.py
      Restart=always
      [Install]
      WantedBy=multi-user.target
runcmd:
  - systemctl enable --now docker
  - systemctl enable --now pgcloud-deployd
  - echo deploying > /opt/pgcloud/status
  - /opt/pgcloud/deploy.sh || true
`;
}

function indent(s: string, n: number) {
  return s.split('\n').map((l) => ' '.repeat(n) + l).join('\n');
}
