'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError, Server } from '@/lib/api';
import { useShell } from '@/components/shell';
import { StatusBadge } from '@/components/status-badge';
import type { Lb } from '../page';

/** One load balancer: IP, rules, node and target health, add or remove targets, delete. */
export default function LoadBalancerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { locale } = useShell();
  const [lb, setLb] = useState<Lb | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const [l, s] = await Promise.all([api<Lb>(`/v1/load-balancers/${id}`), api<{ data: Server[] }>('/v1/servers')]); setLb(l); setServers(s.data); }
    catch (err) { if (err instanceof ApiError && err.status === 404) router.replace('/load-balancers'); else setError(err instanceof ApiError ? err.message : String(err)); }
  }, [id, router]);
  useEffect(() => { load(); const h = setInterval(load, 5000); return () => clearInterval(h); }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setError(null);
    try { await fn(); await load(); } catch (err) { setError(err instanceof ApiError ? err.message : String(err)); } finally { setBusy(false); }
  }
  if (!lb) return <p className="text-sm text-neutral-500">{error ?? 'Loading…'}</p>;
  const free = servers.filter((s) => !lb.targets.some((t) => t.serverId === s.id) && ['active', 'off'].includes(s.status));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/load-balancers" className="text-sm text-neutral-500 hover:underline">← Load balancers</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{lb.name}</h1>
          <StatusBadge status={lb.status} />
          {lb.ip && <code className="rounded bg-neutral-100 px-2 py-0.5 text-sm dark:bg-neutral-800">{lb.ip}</code>}
          <span className="text-sm text-neutral-500">{lb.nodes} node{lb.nodes > 1 ? 's' : ''} · {lb.algorithm === 'least_conn' ? 'least connections' : 'round robin'} · config v{lb.configVersion}</span>
          <button className="btn-danger ms-auto" disabled={busy || lb.status === 'deleting'} onClick={() => confirm(`Delete load balancer ${lb.name}? Its IP is released; target servers are untouched.`) && run(() => api(`/v1/load-balancers/${lb.id}`, { method: 'DELETE' }))}>Delete</button>
        </div>
        {lb.statusMessage && <p className="mt-1 text-sm text-red-600">{lb.statusMessage}</p>}
      </div>
      {error && <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/30">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-2 text-sm">
          <h2 className="font-medium">Forwarding rules</h2>
          <table className="w-full"><tbody>
            {lb.forwardingRules.map((r, i) => <tr key={i} className="border-t border-neutral-100 first:border-0 dark:border-neutral-800"><td className="py-1.5">{r.entryProtocol.toUpperCase()} {r.entryPort}</td><td className="py-1.5 text-neutral-500">to</td><td className="py-1.5">{r.targetProtocol.toUpperCase()} {r.targetPort}</td></tr>)}
          </tbody></table>
          <p className="text-xs text-neutral-500">Health check: {lb.healthCheck.protocol.toUpperCase()} port {lb.healthCheck.port}{lb.healthCheck.path ? ` ${lb.healthCheck.path}` : ''} every {lb.healthCheck.intervalSeconds}s, {lb.healthCheck.unhealthyThreshold} failures mark a target down. {lb.redirectHttpToHttps ? 'HTTP redirects to HTTPS. ' : ''}{lb.stickySessions ? 'Sticky sessions on. ' : ''}{lb.tag ? `Servers tagged "${lb.tag}" join automatically.` : ''}</p>
        </section>
        <section className="card space-y-2 text-sm">
          <h2 className="font-medium">Nodes</h2>
          <table className="w-full"><tbody>
            {lb.nodeStatus.map((n) => <tr key={n.index} className="border-t border-neutral-100 first:border-0 dark:border-neutral-800"><td className="py-1.5">node {n.index}{n.index === 0 ? ' (primary)' : ''}</td><td className="py-1.5"><StatusBadge status={n.status} /></td><td className="py-1.5 text-neutral-500">config v{n.appliedVersion}{n.appliedVersion < lb.configVersion ? ' (rolling out)' : ''}</td><td className="py-1.5 text-xs text-neutral-500">{n.lastSeenAt ? `seen ${new Date(n.lastSeenAt).toLocaleTimeString(locale)}` : 'not reported yet'}</td></tr>)}
          </tbody></table>
        </section>
      </div>

      <section className="card space-y-3 text-sm">
        <h2 className="font-medium">Targets</h2>
        {lb.targets.length === 0 ? <p className="text-neutral-500">No targets. Add servers below; the load balancer answers 503 until one is healthy.</p> : (
          <table className="w-full"><tbody>
            {lb.targets.map((t) => (
              <tr key={t.serverId} className="border-t border-neutral-100 first:border-0 dark:border-neutral-800">
                <td className="py-2 font-medium"><Link href={`/servers/${t.serverId}`} className="hover:underline">{t.name}</Link></td>
                <td className="py-2"><StatusBadge status={t.status} /></td>
                <td className="py-2">{t.healthy === null ? <span className="text-neutral-500">health unknown</span> : t.healthy ? <span className="badge bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">healthy</span> : <span className="badge bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">unhealthy</span>}</td>
                <td className="py-2 text-end"><button className="btn-ghost" disabled={busy} onClick={() => run(() => api(`/v1/load-balancers/${lb.id}/servers/${t.serverId}`, { method: 'DELETE' }))}>Remove</button></td>
              </tr>
            ))}
          </tbody></table>
        )}
        {free.length > 0 && (
          <form className="flex flex-wrap items-center gap-2" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const ids = new FormData(e.currentTarget).getAll('serverIds').map(String); if (ids.length) run(() => api(`/v1/load-balancers/${lb.id}/servers`, { method: 'POST', body: JSON.stringify({ serverIds: ids }) })); }}>
            <select name="serverIds" className="input max-w-md" multiple size={Math.min(4, free.length)}>{free.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <button className="btn-primary" disabled={busy}>Add targets</button>
          </form>
        )}
      </section>
    </div>
  );
}
