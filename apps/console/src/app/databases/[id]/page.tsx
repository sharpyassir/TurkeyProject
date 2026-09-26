'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useShell } from '@/components/shell';
import { StatusBadge } from '@/components/status-badge';
import { ENGINE_LABEL, fmtBytes } from '@/lib/format';
import type { DbCluster } from '../page';

interface Backup { id: string; kind: string; status: string; sizeBytes: number | null; label: string | null; startedAt: string; completedAt: string | null; error: string | null }

/** One cluster: connection details, users, databases, trusted sources, backups and nodes. */
export default function DatabasePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { locale } = useShell();
  const [c, setC] = useState<DbCluster | null>(null);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [created, setCreated] = useState<{ name: string; password: string } | null>(null);

  const load = useCallback(async () => {
    try { const [d, b] = await Promise.all([api<DbCluster>(`/v1/databases/${id}`), api<{ data: Backup[] }>(`/v1/databases/${id}/backups`)]); setC(d); setBackups(b.data); }
    catch (err) { if (err instanceof ApiError && err.status === 404) router.replace('/databases'); else setError(err instanceof ApiError ? err.message : String(err)); }
  }, [id, router]);
  useEffect(() => { load(); const h = setInterval(load, 6000); return () => clearInterval(h); }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setError(null);
    try { await fn(); await load(); } catch (err) { setError(err instanceof ApiError ? err.message : String(err)); } finally { setBusy(false); }
  }
  if (!c) return <p className="text-sm text-neutral-500">{error ?? 'Loading…'}</p>;
  const conn = c.connection;
  const mask = (s: string | null | undefined) => (s ? (reveal ? s : s.replace(/:[^:@/]+@/, ':••••••••@')) : '');
  const primary = c.nodeStatus.find((n) => n.role === 'primary');

  return (
    <div className="space-y-6">
      <div>
        <Link href="/databases" className="text-sm text-neutral-500 hover:underline">← Managed databases</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{c.name}</h1>
          <StatusBadge status={c.status} />
          <span className="text-sm text-neutral-500">{ENGINE_LABEL[c.engine] ?? c.engine} {c.version} · {c.nodes} node{c.nodes > 1 ? 's' : ''} · {c.size.vcpu} vCPU {c.size.memoryMb / 1024} GB · config v{c.configVersion}</span>
          <button className="btn-danger ms-auto" disabled={busy || c.status === 'deleting'} onClick={() => confirm(`Delete cluster ${c.name} and all its data? Backups expire after seven days.`) && run(() => api(`/v1/databases/${id}`, { method: 'DELETE' }).then(() => router.replace('/databases')))}>Delete cluster</button>
        </div>
        {c.statusMessage && <p className="mt-1 text-sm text-red-600">{c.statusMessage}</p>}
      </div>
      {error && <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/30">{error}</p>}

      <section className="card space-y-2 text-sm">
        <div className="flex items-center gap-3"><h2 className="font-medium">Connection</h2><button className="btn-ghost ms-auto" onClick={() => setReveal(!reveal)}>{reveal ? 'Hide secrets' : 'Show secrets'}</button></div>
        <table className="w-full"><tbody>
          <tr><td className="py-1 text-neutral-500 w-40">Host</td><td className="py-1 font-mono">{conn.host ?? 'pending'}</td></tr>
          <tr><td className="py-1 text-neutral-500">Private host</td><td className="py-1 font-mono">{conn.privateHost ?? 'pending'}</td></tr>
          <tr><td className="py-1 text-neutral-500">Port</td><td className="py-1 font-mono">{conn.port}{c.poolerPort ? ` (pooler ${c.poolerPort})` : ''}</td></tr>
          <tr><td className="py-1 text-neutral-500">Admin user</td><td className="py-1 font-mono">{conn.user} / {reveal ? conn.password : '••••••••'}</td></tr>
          {conn.database && <tr><td className="py-1 text-neutral-500">Database</td><td className="py-1 font-mono">{conn.database}</td></tr>}
          <tr><td className="py-1 text-neutral-500">Connection string</td><td className="py-1 font-mono break-all text-xs">{mask(conn.uri)}</td></tr>
          <tr><td className="py-1 text-neutral-500">Private network</td><td className="py-1 font-mono break-all text-xs">{mask(conn.privateUri)}</td></tr>
        </tbody></table>
        <p className="text-xs text-neutral-500">TLS is required{c.engine === 'valkey' ? ' on port 6380' : ''}. {c.poolerPort ? 'Use the pooler port for many short lived connections. ' : ''}The host address follows the primary on failover.</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-2 text-sm">
          <h2 className="font-medium">Users</h2>
          {created && <div className="rounded border border-green-200 bg-green-50 p-2 text-xs dark:bg-green-950/30">Password for <b>{created.name}</b>, shown once: <code>{created.password}</code> <button className="btn-ghost" onClick={() => setCreated(null)}>Done</button></div>}
          <table className="w-full"><tbody>
            {c.users.map((u) => <tr key={u.id} className="border-t border-neutral-100 first:border-0 dark:border-neutral-800"><td className="py-1.5 font-mono">{u.name}</td><td className="py-1.5 font-mono text-xs text-neutral-500">{reveal ? u.password : '••••••••'}</td><td className="py-1.5 text-end whitespace-nowrap"><button className="btn-ghost me-1" disabled={busy} onClick={() => run(() => api<{ name: string; password: string }>(`/v1/databases/${id}/users/${u.id}/reset-password`, { method: 'POST' }).then(setCreated))}>Reset password</button><button className="btn-danger" disabled={busy} onClick={() => confirm(`Delete user ${u.name}?`) && run(() => api(`/v1/databases/${id}/users/${u.id}`, { method: 'DELETE' }))}>Delete</button></td></tr>)}
          </tbody></table>
          <form className="flex gap-2" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const name = String(new FormData(e.currentTarget).get('name')); const form = e.currentTarget; run(() => api<{ name: string; password: string }>(`/v1/databases/${id}/users`, { method: 'POST', body: JSON.stringify({ name }) }).then((u) => { setCreated(u); form.reset(); })); }}>
            <input className="input" name="name" placeholder="New user name" pattern="[a-z_][a-z0-9_]*" required /><button className="btn-primary" disabled={busy}>Add user</button>
          </form>
        </section>
        {c.engine !== 'valkey' && <section className="card space-y-2 text-sm">
          <h2 className="font-medium">Databases</h2>
          <table className="w-full"><tbody>
            {c.databases.map((d) => <tr key={d.id} className="border-t border-neutral-100 first:border-0 dark:border-neutral-800"><td className="py-1.5 font-mono">{d.name}</td><td className="py-1.5 text-end"><button className="btn-danger" disabled={busy || c.databases.length === 1} onClick={() => confirm(`Remove database ${d.name} from this cluster? The data stays until you drop it.`) && run(() => api(`/v1/databases/${id}/dbs/${d.id}`, { method: 'DELETE' }))}>Remove</button></td></tr>)}
          </tbody></table>
          <form className="flex gap-2" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const name = String(new FormData(e.currentTarget).get('name')); const form = e.currentTarget; run(() => api(`/v1/databases/${id}/dbs`, { method: 'POST', body: JSON.stringify({ name }) }).then(() => form.reset())); }}>
            <input className="input" name="name" placeholder="New database name" pattern="[a-z_][a-z0-9_]*" required /><button className="btn-primary" disabled={busy}>Add database</button>
          </form>
        </section>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-2 text-sm">
          <h2 className="font-medium">Trusted sources</h2>
          <p className="text-xs text-neutral-500">Only these addresses may reach the database port. Empty allows any address; the password and TLS still apply.</p>
          <form className="flex gap-2" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const list = String(new FormData(e.currentTarget).get('trusted') ?? '').split(',').map((x) => x.trim()).filter(Boolean); run(() => api(`/v1/databases/${id}`, { method: 'PATCH', body: JSON.stringify({ trustedSources: list }) })); }}>
            <input className="input" name="trusted" defaultValue={c.trustedSources.join(', ')} placeholder="203.0.113.0/24, 198.51.100.7" /><button className="btn-primary" disabled={busy}>Save</button>
          </form>
        </section>
        <section className="card space-y-2 text-sm">
          <h2 className="font-medium">Nodes</h2>
          <table className="w-full"><tbody>
            {c.nodeStatus.map((n) => <tr key={n.index} className="border-t border-neutral-100 first:border-0 dark:border-neutral-800"><td className="py-1.5">node {n.index}</td><td className="py-1.5"><StatusBadge status={n.status} /></td><td className="py-1.5">{n.role === 'primary' ? <span className="badge bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">primary</span> : n.role === 'replica' ? `replica${n.lagBytes != null ? `, lag ${fmtBytes(n.lagBytes)}` : ''}` : 'role unknown'}</td><td className="py-1.5 text-xs text-neutral-500">v{n.appliedVersion}{n.appliedVersion < c.configVersion ? ' (rolling out)' : ''}{n.lastSeenAt ? ` · seen ${new Date(n.lastSeenAt).toLocaleTimeString(locale)}` : ' · not reported yet'}</td></tr>)}
          </tbody></table>
          {!primary && c.nodes > 1 && <p className="text-xs text-neutral-500">The primary is elected by the nodes; the host address moves with it.</p>}
        </section>
      </div>

      <section className="card space-y-2 text-sm">
        <div className="flex items-center gap-3"><h2 className="font-medium">Backups</h2><span className="text-xs text-neutral-500">nightly at {String(c.backupHourUtc).padStart(2, '0')}:00 UTC, kept seven days, point in time recovery from the archive</span><button className="btn-primary ms-auto" disabled={busy} onClick={() => run(() => api(`/v1/databases/${id}/backups`, { method: 'POST' }))}>Back up now</button></div>
        {backups.length === 0 ? <p className="text-neutral-500">No backups yet.</p> : (
          <table className="w-full"><tbody>
            {backups.map((b) => <tr key={b.id} className="border-t border-neutral-100 first:border-0 dark:border-neutral-800"><td className="py-1.5">{b.label ?? b.id}</td><td className="py-1.5">{b.kind}</td><td className="py-1.5"><StatusBadge status={b.status === 'completed' ? 'active' : b.status === 'failed' ? 'failed' : 'pending'} /></td><td className="py-1.5">{b.sizeBytes != null ? fmtBytes(b.sizeBytes) : ''}</td><td className="py-1.5 text-xs text-neutral-500">{new Date(b.startedAt).toLocaleString(locale)}{b.error ? ` · ${b.error}` : ''}</td></tr>)}
          </tbody></table>
        )}
      </section>
    </div>
  );
}
