'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useShell } from '@/components/shell';
import { StatusBadge } from '@/components/status-badge';

export interface Zone { id: string; name: string; status: string; statusMessage: string | null; serial: number; synced: boolean; nameservers: string[]; recordCount: number; createdAt: string }

/** DNS: hosted zones. Free; point the domain's nameservers at ours. */
export default function DnsPage() {
  const { locale } = useShell();
  const [zones, setZones] = useState<Zone[]>([]);
  const [nameservers, setNameservers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<{ data: Zone[]; nameservers: string[] }>('/v1/domains').then((r) => { setZones(r.data); setNameservers(r.nameservers); }), []);
  useEffect(() => { load(); }, [load]);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(null);
    const f = new FormData(e.currentTarget); const form = e.currentTarget;
    const body: Record<string, unknown> = { name: String(f.get('name')).trim().toLowerCase() };
    if (f.get('ip')) body.ip = String(f.get('ip')).trim();
    try { await api('/v1/domains', { method: 'POST', body: JSON.stringify(body) }); form.reset(); await load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : String(err)); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">DNS</h1>
        <p className="text-sm text-neutral-500">Host your domains here for free. Add a domain, then set its nameservers at your registrar to {nameservers.join(' and ')}.</p>
      </div>
      {error && <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/30">{error}</p>}
      <div className="card p-0">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-neutral-500"><tr><th className="px-4 py-2 text-start">Domain</th><th className="px-4 py-2 text-start">Status</th><th className="px-4 py-2 text-start">Records</th><th className="px-4 py-2 text-start">Added</th></tr></thead>
          <tbody>
            {zones.length === 0 && <tr><td className="px-4 py-3 text-neutral-500" colSpan={4}>No domains yet.</td></tr>}
            {zones.map((z) => (
              <tr key={z.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-4 py-2 font-medium"><Link href={`/dns/${z.name}`} className="text-blue-600 hover:underline">{z.name}</Link></td>
                <td className="px-4 py-2"><StatusBadge status={z.synced ? 'active' : z.status === 'error' ? 'failed' : 'pending'} />{z.statusMessage && <div className="mt-1 text-xs text-red-600">{z.statusMessage}</div>}</td>
                <td className="px-4 py-2">{z.recordCount}</td>
                <td className="px-4 py-2 text-neutral-500">{new Date(z.createdAt).toLocaleDateString(locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form onSubmit={create} className="card space-y-3">
        <h2 className="font-medium">Add a domain</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <input className="input" name="name" placeholder="example.com" required />
          <input className="input" name="ip" placeholder="Point it at an IP now (optional)" />
          <button className="btn-primary" disabled={busy}>Add domain</button>
        </div>
      </form>
    </div>
  );
}
