'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError, money, Price, Size } from '@/lib/api';
import { useShell } from '@/components/shell';
import { StatusBadge } from '@/components/status-badge';

export interface DbCluster { id: string; name: string; engine: string; version: string; status: string; statusMessage: string | null; nodes: number; size: { id: string; vcpu: number; memoryMb: number; diskGb: number }; port: number; poolerPort: number | null; trustedSources: string[]; backupHourUtc: number; configVersion: number; connection: { host: string | null; privateHost: string | null; port: number; database: string; user?: string; password?: string; ssl?: boolean; uri?: string | null; privateUri?: string | null; appUri?: string | null }; users: { id: string; name: string; password?: string; createdAt: string }[]; databases: { id: string; name: string; createdAt: string }[]; nodeStatus: { index: number; status: string; role: string; appliedVersion: number; lagBytes: number | null; lastSeenAt: string | null }[]; createdAt: string }
interface Engine { engine: string; versions: string[]; available: boolean }

const SETTLED = ['active', 'failed'];
export const ENGINE_LABEL: Record<string, string> = { postgres: 'PostgreSQL', valkey: 'Valkey', mysql: 'MySQL' };

/** Managed databases: clusters we run, with users, databases, backups and failover. */
export default function DatabasesPage() {
  const { locale } = useShell();
  const [rows, setRows] = useState<DbCluster[]>([]);
  const [engines, setEngines] = useState<Engine[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [currency, setCurrency] = useState<'USD' | 'SAR'>('USD');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState('s-1vcpu-2gb');
  const [nodes, setNodes] = useState(1);

  const load = useCallback(() => api<{ data: DbCluster[] }>('/v1/databases').then((r) => setRows(r.data)), []);
  useEffect(() => {
    load();
    api<{ data: Engine[] }>('/v1/databases/engines').then((r) => setEngines(r.data));
    api<{ data: Size[] }>('/v1/sizes').then((r) => setSizes(r.data.filter((s) => s.memoryMb >= 1024)));
    api<{ currency: 'USD' | 'SAR' }>('/v1/billing/balance').then(async (b) => { setCurrency(b.currency); setPrices((await api<{ data: Price[] }>(`/v1/pricing?currency=${b.currency}`)).data); }).catch(() => undefined);
  }, [load]);
  useEffect(() => {
    if (!rows.some((r) => !SETTLED.includes(r.status))) return;
    const h = setInterval(load, 4000);
    return () => clearInterval(h);
  }, [rows, load]);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(null);
    const f = new FormData(e.currentTarget); const form = e.currentTarget;
    const body = { name: String(f.get('name')).trim(), engine: f.get('engine'), size, nodes, trustedSources: String(f.get('trusted') ?? '').split(',').map((x) => x.trim()).filter(Boolean) };
    try { await api('/v1/databases', { method: 'POST', idempotent: true, body: JSON.stringify(body) }); form.reset(); await load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : String(err)); } finally { setBusy(false); }
  }
  const nodePrice = (sizeId: string) => prices.find((p) => p.sku === `db-${sizeId}`)?.monthlyMinor ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Managed databases</h1>
        <p className="text-sm text-neutral-500">PostgreSQL clusters we run for you: automatic failover with three nodes, nightly backups to object storage, connection pooling, TLS, and users and databases managed from here. Priced per node per month.</p>
      </div>
      {error && <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/30">{error}</p>}

      <div className="card p-0">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-neutral-500"><tr><th className="px-4 py-2 text-start">Name</th><th className="px-4 py-2 text-start">Engine</th><th className="px-4 py-2 text-start">Status</th><th className="px-4 py-2 text-start">Nodes</th><th className="px-4 py-2 text-start">Size</th><th className="px-4 py-2 text-start">Host</th><th className="px-4 py-2 text-start">Monthly</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td className="px-4 py-3 text-neutral-500" colSpan={7}>No databases yet.</td></tr>}
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-4 py-2 font-medium"><Link href={`/databases/${c.id}`} className="text-blue-600 hover:underline">{c.name}</Link></td>
                <td className="px-4 py-2">{ENGINE_LABEL[c.engine] ?? c.engine} {c.version}</td>
                <td className="px-4 py-2"><StatusBadge status={c.status} />{c.statusMessage && <div className="mt-1 max-w-[16rem] text-xs text-red-600">{c.statusMessage}</div>}</td>
                <td className="px-4 py-2">{c.nodes}{c.nodes > 1 ? ' (HA)' : ''}</td>
                <td className="px-4 py-2">{c.size.vcpu} vCPU · {c.size.memoryMb / 1024} GB</td>
                <td className="px-4 py-2 font-mono text-xs">{c.connection.host ?? ''}</td>
                <td className="px-4 py-2">{money(nodePrice(c.size.id) * c.nodes, currency, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={create} className="card space-y-3">
        <h2 className="font-medium">New database cluster</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <input className="input" name="name" placeholder="Name, for example app-db" pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?" maxLength={40} required />
          <select className="input" name="engine" defaultValue="postgres">{engines.map((e) => <option key={e.engine} value={e.engine} disabled={!e.available}>{ENGINE_LABEL[e.engine] ?? e.engine} {e.versions[0]}{e.available ? '' : ' (soon)'}</option>)}</select>
          <select className="input" value={size} onChange={(e) => setSize(e.target.value)}>{sizes.map((s) => <option key={s.id} value={s.id}>{s.vcpu} vCPU · {s.memoryMb / 1024} GB · {s.diskGb} GB · {money(nodePrice(s.id), currency, locale)}/node</option>)}</select>
          <select className="input" value={nodes} onChange={(e) => setNodes(Number(e.target.value))}><option value={1}>1 node</option><option value={3}>3 nodes, automatic failover</option></select>
        </div>
        <input className="input" name="trusted" placeholder="Trusted sources, comma separated CIDRs (empty allows any address with the password over TLS)" />
        <div className="flex items-center gap-4 text-sm text-neutral-500"><span>{money(nodePrice(size) * nodes, currency, locale)} per month</span><button className="btn-primary" disabled={busy}>Create cluster</button></div>
      </form>
    </div>
  );
}
