'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError, money, Price, Server } from '@/lib/api';
import { useShell } from '@/components/shell';
import { StatusBadge } from '@/components/status-badge';

export interface Rule { entryProtocol: 'http' | 'https' | 'tcp'; entryPort: number; targetProtocol: 'http' | 'tcp'; targetPort: number; certificateId?: string }
export interface Lb { id: string; name: string; status: string; statusMessage: string | null; ip: string | null; nodes: number; algorithm: string; forwardingRules: Rule[]; healthCheck: { protocol: string; port: number; path?: string; intervalSeconds: number; timeoutSeconds: number; healthyThreshold: number; unhealthyThreshold: number }; stickySessions: { type: string; cookieName?: string } | null; redirectHttpToHttps: boolean; proxyProtocol: boolean; tag: string | null; configVersion: number; nodeStatus: { index: number; status: string; appliedVersion: number; lastSeenAt: string | null }[]; targets: { serverId: string; name: string; status: string; healthy: boolean | null }[]; createdAt: string }
export interface Cert { id: string; name: string; type: 'custom' | 'letsencrypt'; domains: string[]; notAfter: string | null }

const SETTLED = ['active', 'failed'];

/** Load balancers: a public IP in front of servers, with rules, health checks and certificates. */
export default function LoadBalancersPage() {
  const { locale } = useShell();
  const [rows, setRows] = useState<Lb[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [currency, setCurrency] = useState<'USD' | 'TRY'>('USD');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState<Rule[]>([{ entryProtocol: 'http', entryPort: 80, targetProtocol: 'http', targetPort: 80 }]);

  const load = useCallback(async () => {
    const [l, s, c] = await Promise.all([api<{ data: Lb[] }>('/v1/load-balancers'), api<{ data: Server[] }>('/v1/servers'), api<{ data: Cert[] }>('/v1/certificates')]);
    setRows(l.data); setServers(s.data.filter((x) => ['active', 'off'].includes(x.status))); setCerts(c.data);
  }, []);
  useEffect(() => {
    load();
    api<{ currency: 'USD' | 'TRY' }>('/v1/billing/balance').then(async (b) => { setCurrency(b.currency); setPrices((await api<{ data: Price[] }>(`/v1/pricing?currency=${b.currency}`)).data); }).catch(() => undefined);
  }, [load]);
  useEffect(() => {
    if (!rows.some((r) => !SETTLED.includes(r.status))) return;
    const h = setInterval(load, 3000);
    return () => clearInterval(h);
  }, [rows, load]);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(null);
    const f = new FormData(e.currentTarget);
    const form = e.currentTarget;
    const body = {
      name: f.get('name'), nodes: Number(f.get('nodes') || 1), algorithm: f.get('algorithm'), forwardingRules: rules,
      redirectHttpToHttps: f.get('redirect') === 'on', stickySessions: { type: f.get('sticky') === 'on' ? 'cookie' : 'none' },
      healthCheck: { path: String(f.get('healthPath') || '/') },
      serverIds: f.getAll('serverIds').map(String).filter(Boolean), tag: String(f.get('tag') || '') || undefined,
    };
    try { await api('/v1/load-balancers', { method: 'POST', idempotent: true, body: JSON.stringify(body) }); form.reset(); setRules([{ entryProtocol: 'http', entryPort: 80, targetProtocol: 'http', targetPort: 80 }]); await load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : String(err)); } finally { setBusy(false); }
  }
  async function addCert(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(null);
    const f = new FormData(e.currentTarget);
    const form = e.currentTarget;
    const type = f.get('type') as 'custom' | 'letsencrypt';
    const body = type === 'letsencrypt' ? { name: f.get('cname'), type, domains: String(f.get('domains') ?? '').split(',').map((d) => d.trim()).filter(Boolean) } : { name: f.get('cname'), type, certPem: f.get('certPem'), keyPem: f.get('keyPem') };
    try { await api('/v1/certificates', { method: 'POST', body: JSON.stringify(body) }); form.reset(); await load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : String(err)); } finally { setBusy(false); }
  }
  const perNode = prices.find((p) => p.sku === 'lb_node')?.monthlyMinor ?? 0;
  const setRule = (i: number, patch: Partial<Rule>) => setRules(rules.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Load balancers</h1>
        <p className="text-sm text-neutral-500">A public IP with HAProxy behind it, spreading traffic over your servers with health checks, sticky sessions and TLS. {money(perNode, currency, locale)} per node per month; two or three nodes share the IP for high availability.</p>
      </div>
      {error && <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/30">{error}</p>}

      <div className="card p-0">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-neutral-500"><tr><th className="px-4 py-2 text-start">Name</th><th className="px-4 py-2 text-start">Status</th><th className="px-4 py-2 text-start">IP</th><th className="px-4 py-2 text-start">Rules</th><th className="px-4 py-2 text-start">Targets</th><th className="px-4 py-2 text-start">Nodes</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td className="px-4 py-3 text-neutral-500" colSpan={6}>No load balancers yet. Create one below and point your DNS at its IP.</td></tr>}
            {rows.map((lb) => (
              <tr key={lb.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-4 py-2 font-medium"><Link href={`/load-balancers/${lb.id}`} className="text-blue-600 hover:underline">{lb.name}</Link></td>
                <td className="px-4 py-2"><StatusBadge status={lb.status} />{lb.statusMessage && <div className="mt-1 max-w-[16rem] text-xs text-red-600">{lb.statusMessage}</div>}</td>
                <td className="px-4 py-2 font-mono">{lb.ip ?? ''}</td>
                <td className="px-4 py-2 text-xs">{lb.forwardingRules.map((r) => `${r.entryProtocol}:${r.entryPort} to ${r.targetPort}`).join(', ')}</td>
                <td className="px-4 py-2">{lb.targets.length} <span className="text-xs text-neutral-500">({lb.targets.filter((t) => t.healthy).length} healthy)</span></td>
                <td className="px-4 py-2">{lb.nodes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={create} className="card space-y-3">
        <h2 className="font-medium">New load balancer</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <input className="input" name="name" placeholder="Name, for example web" pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?" maxLength={64} required />
          <select className="input" name="nodes" defaultValue="1"><option value="1">1 node</option><option value="2">2 nodes (high availability)</option><option value="3">3 nodes</option></select>
          <select className="input" name="algorithm" defaultValue="round_robin"><option value="round_robin">Round robin</option><option value="least_conn">Least connections</option></select>
          <input className="input" name="healthPath" placeholder="Health check path (/)" />
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium">Forwarding rules</div>
          {rules.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <select className="input" style={{ width: '7rem' }} value={r.entryProtocol} onChange={(e) => setRule(i, { entryProtocol: e.target.value as Rule['entryProtocol'], targetProtocol: e.target.value === 'tcp' ? 'tcp' : r.targetProtocol, certificateId: e.target.value === 'https' ? r.certificateId : undefined })}><option value="http">HTTP</option><option value="https">HTTPS</option><option value="tcp">TCP</option></select>
              <input className="input" style={{ width: '6rem' }} type="number" min={1} max={65535} value={r.entryPort} onChange={(e) => setRule(i, { entryPort: Number(e.target.value) })} aria-label="Entry port" />
              <span className="text-neutral-500">to</span>
              <select className="input" style={{ width: '7rem' }} value={r.targetProtocol} onChange={(e) => setRule(i, { targetProtocol: e.target.value as Rule['targetProtocol'] })} disabled={r.entryProtocol === 'tcp'}><option value="http">HTTP</option><option value="tcp">TCP</option></select>
              <input className="input" style={{ width: '6rem' }} type="number" min={1} max={65535} value={r.targetPort} onChange={(e) => setRule(i, { targetPort: Number(e.target.value) })} aria-label="Target port" />
              {r.entryProtocol === 'https' && <select className="input" style={{ width: '16rem' }} value={r.certificateId ?? ''} onChange={(e) => setRule(i, { certificateId: e.target.value || undefined })} required><option value="">Certificate…</option>{certs.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}</select>}
              {rules.length > 1 && <button type="button" className="btn-ghost" onClick={() => setRules(rules.filter((_, k) => k !== i))}>Remove</button>}
            </div>
          ))}
          <button type="button" className="btn-ghost" onClick={() => setRules([...rules, { entryProtocol: 'https', entryPort: 443, targetProtocol: 'http', targetPort: rules[0]?.targetPort ?? 80 }])}>Add rule</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <select className="input" name="serverIds" multiple size={4}>{servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <div className="space-y-2 text-sm">
            <input className="input" name="tag" placeholder="Or a tag: every server with it is a target" />
            <label className="flex items-center gap-2"><input type="checkbox" name="redirect" /> Redirect HTTP to HTTPS</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="sticky" /> Sticky sessions (cookie)</label>
          </div>
        </div>
        <button className="btn-primary" disabled={busy}>Create load balancer</button>
      </form>

      <section className="card space-y-3">
        <h2 className="font-medium">Certificates</h2>
        {certs.length > 0 && (
          <table className="w-full text-sm"><tbody>
            {certs.map((c) => <tr key={c.id} className="border-t border-neutral-100 first:border-0 dark:border-neutral-800"><td className="py-2 font-medium">{c.name}</td><td className="py-2">{c.type === 'letsencrypt' ? "Let's Encrypt" : 'Uploaded'}</td><td className="py-2 text-neutral-500">{c.domains.join(', ')}</td><td className="py-2 text-xs text-neutral-500">{c.notAfter ? `expires ${new Date(c.notAfter).toLocaleDateString(locale)}` : ''}</td><td className="py-2 text-end"><button className="btn-danger" onClick={() => api(`/v1/certificates/${c.id}`, { method: 'DELETE' }).then(load).catch((err) => setError(err.message))}>Delete</button></td></tr>)}
          </tbody></table>
        )}
        <form onSubmit={addCert} className="grid gap-2 sm:grid-cols-4 text-sm">
          <input className="input" name="cname" placeholder="Certificate name" required />
          <select className="input" name="type" defaultValue="letsencrypt"><option value="letsencrypt">Let&apos;s Encrypt (free, automatic)</option><option value="custom">Upload PEM</option></select>
          <input className="input sm:col-span-2" name="domains" placeholder="Domains, comma separated (Let's Encrypt)" />
          <textarea className="input sm:col-span-2 font-mono text-xs" name="certPem" rows={3} placeholder="Certificate PEM (upload only)" />
          <textarea className="input sm:col-span-2 font-mono text-xs" name="keyPem" rows={3} placeholder="Private key PEM (upload only)" />
          <div className="sm:col-span-4 text-xs text-neutral-500">For Let&apos;s Encrypt, point the domains at the load balancer IP first; the nodes issue and renew the certificate on their own.</div>
          <button className="btn-primary sm:col-span-1" disabled={busy}>Add certificate</button>
        </form>
      </section>
    </div>
  );
}
