'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useShell } from '@/components/shell';
import { StatusBadge } from '@/components/status-badge';

interface Deploy { id: string; name: string; repoUrl: string; branch: string; port: number; status: string; url: string | null; serverStatus: string; lastCommit: string | null; lastDeployAt: string | null; createdAt: string }
interface Created extends Deploy { webhook: { url: string; secret: string } }

/** Git Deploy: link a repo, get a URL, push to redeploy. */
export default function DeploysPage() {
  const { locale } = useShell();
  const [rows, setRows] = useState<Deploy[]>([]);
  const [created, setCreated] = useState<Created | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<{ data: Deploy[] }>('/v1/deploys').then((r) => setRows(r.data)), []);
  useEffect(() => {
    load();
    const id = setInterval(() => { if (rows.some((d) => ['creating', 'deploying'].includes(d.status))) load(); }, 3000);
    return () => clearInterval(id);
  }, [load, rows]);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(null);
    const f = new FormData(e.currentTarget);
    const env: Record<string, string> = {};
    String(f.get('env') ?? '').split('\n').forEach((l) => { const [k, ...v] = l.split('='); if (k.trim()) env[k.trim()] = v.join('=').trim(); });
    try {
      const r = await api<Created>('/v1/deploys', { method: 'POST', idempotent: true, body: JSON.stringify({ repoUrl: f.get('repoUrl'), branch: f.get('branch') || 'main', port: Number(f.get('port') || 3000), size: f.get('size') || undefined, gitToken: f.get('gitToken') || undefined, env }) });
      setCreated(r); e.currentTarget.reset(); load();
    } catch (err) { setError(err instanceof ApiError ? err.message : String(err)); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Git Deploy</h1>
        <p className="text-sm text-neutral-500">Link a repository with a Dockerfile or docker-compose.yml. We build it on a server in Türkiye and redeploy on every push.</p>
      </div>

      {created && (
        <div className="card border-blue-300 text-sm dark:border-blue-800">
          <div className="font-medium">Add this webhook in GitHub → Settings → Webhooks so pushes redeploy (secret shown once):</div>
          <dl className="mt-2 grid gap-1 font-mono text-xs sm:grid-cols-[110px_1fr]">
            <dt className="text-neutral-500">Payload URL</dt><dd className="select-all break-all">{created.webhook.url}</dd>
            <dt className="text-neutral-500">Content type</dt><dd>application/json</dd>
            <dt className="text-neutral-500">Secret</dt><dd className="select-all break-all">{created.webhook.secret}</dd>
            <dt className="text-neutral-500">Events</dt><dd>push</dd>
          </dl>
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-neutral-500"><tr><th className="px-4 py-2 text-start">App</th><th className="px-4 py-2 text-start">Status</th><th className="px-4 py-2 text-start">URL</th><th className="px-4 py-2 text-start">Repo</th><th className="px-4 py-2 text-start">Last deploy</th><th /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td className="px-4 py-3 text-neutral-500" colSpan={6}>No deployments yet.</td></tr>}
            {rows.map((d) => (
              <tr key={d.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-4 py-2 font-medium">{d.name}</td>
                <td className="px-4 py-2"><StatusBadge status={d.status === 'live' ? 'active' : d.status} /></td>
                <td className="px-4 py-2 font-mono text-xs">{d.url ? <a className="text-blue-600" href={d.url} target="_blank" rel="noreferrer">{d.url}</a> : '—'}</td>
                <td className="px-4 py-2 text-xs text-neutral-500">{d.repoUrl.replace('https://github.com/', '')}@{d.branch}{d.lastCommit ? ` · ${d.lastCommit.slice(0, 7)}` : ''}</td>
                <td className="px-4 py-2 text-xs text-neutral-500">{d.lastDeployAt ? new Date(d.lastDeployAt).toLocaleString(locale) : '—'}</td>
                <td className="px-4 py-2 text-end"><button className="btn-ghost" disabled={d.serverStatus !== 'active'} onClick={() => api(`/v1/deploys/${d.id}/redeploy`, { method: 'POST', idempotent: true }).then(load)}>Redeploy</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={create} className="card space-y-3">
        <h2 className="font-medium">Deploy a repository</h2>
        <input className="input" name="repoUrl" type="url" placeholder="https://github.com/you/app" required />
        <div className="grid gap-3 sm:grid-cols-3">
          <input className="input" name="branch" placeholder="main" />
          <input className="input" name="port" type="number" placeholder="App port (3000)" min={1} max={65535} />
          <select className="input" name="size" defaultValue=""><option value="">s-1vcpu-2gb (default)</option><option>s-1vcpu-1gb</option><option>s-2vcpu-4gb</option><option>s-4vcpu-8gb</option></select>
        </div>
        <textarea className="input font-mono text-xs" name="env" rows={3} placeholder={'Environment variables, one per line\nDATABASE_URL=postgres://…'} />
        <input className="input" name="gitToken" type="password" placeholder="GitHub token for private repos (optional, never stored by us)" autoComplete="off" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Deploy'}</button>
        <p className="text-xs text-neutral-500">Or from your terminal: <code>pgcloud deploy https://github.com/you/app --wait</code></p>
      </form>
    </div>
  );
}
