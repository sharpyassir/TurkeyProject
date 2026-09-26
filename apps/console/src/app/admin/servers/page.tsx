'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AdminShell, fmtDate } from '@/components/admin-shell';
import { StatusBadge } from '@/components/status-badge';

interface Row { id: string; name: string; status: string; statusMessage: string | null; createdAt: string; size: { id: string }; host: { name: string } | null; publicIps: { address: string }[]; project: { name: string; team: { id: string; name: string; slug: string } } }
const STATUSES = ['', 'new', 'provisioning', 'active', 'off', 'failed', 'deleting'];

export default function AdminServers() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState(''); const [status, setStatus] = useState('');
  const load = useCallback(() => api<{ data: Row[] }>(`/admin/v1/servers?q=${encodeURIComponent(q)}&status=${status}`).then((r) => setRows(r.data)), [q, status]);
  useEffect(() => { load(); }, [load]);
  return (
    <AdminShell title="Servers" actions={<form className="flex gap-2" onSubmit={(e: FormEvent) => { e.preventDefault(); load(); }}>
      <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{s || 'any status'}</option>)}</select>
      <input className="input w-56" placeholder="Name, id or team" value={q} onChange={(e) => setQ(e.target.value)} />
    </form>}>
      <section className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-neutral-500"><tr><th className="px-4 py-2 text-start">Server</th><th className="px-4 py-2 text-start">Status</th><th className="px-4 py-2 text-start">Team</th><th className="px-4 py-2 text-start">Size</th><th className="px-4 py-2 text-start">Host</th><th className="px-4 py-2 text-start">IP</th><th className="px-4 py-2 text-start">Created</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td className="px-4 py-3 text-neutral-500" colSpan={7}>No servers match.</td></tr>}
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-4 py-2"><div className="font-medium">{s.name}</div><div className="font-mono text-xs text-neutral-500">{s.id}</div></td>
                <td className="px-4 py-2"><StatusBadge status={s.status} />{s.statusMessage && <div className="text-xs text-amber-700">{s.statusMessage}</div>}</td>
                <td className="px-4 py-2"><Link href={`/admin/teams/${s.project.team.id}`} className="hover:underline">{s.project.team.name}</Link> <span className="text-xs text-neutral-500">/ {s.project.name}</span></td>
                <td className="px-4 py-2">{s.size.id}</td><td className="px-4 py-2 text-neutral-500">{s.host?.name ?? '—'}</td>
                <td className="px-4 py-2 font-mono text-xs">{s.publicIps[0]?.address ?? '—'}</td><td className="px-4 py-2 text-xs text-neutral-500">{fmtDate(s.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AdminShell>
  );
}
