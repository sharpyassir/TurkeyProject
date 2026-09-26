'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AdminShell, fmtDate } from '@/components/admin-shell';

interface Row { id: string; at: string; teamId: string | null; tokenId: string | null; action: string; resource: string | null; status: number; request: unknown; user: { email: string } | null }

export default function AdminAudit() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState('');
  useEffect(() => { api<{ data: Row[] }>('/admin/v1/audit?limit=300').then((r) => setRows(r.data)); }, []);
  const shown = rows.filter((r) => !filter || r.action.includes(filter) || (r.user?.email ?? '').includes(filter) || (r.resource ?? '').includes(filter));
  return (
    <AdminShell title="Audit log" actions={<input className="input w-64" placeholder="Filter by action, email or resource" value={filter} onChange={(e) => setFilter(e.target.value)} />}>
      <p className="text-sm text-neutral-500">Every API call and every domain event across all teams, newest first. Staff actions are prefixed with admin.</p>
      <section className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-neutral-500"><tr><th className="px-4 py-2 text-start">When</th><th className="px-4 py-2 text-start">Action</th><th className="px-4 py-2 text-start">Who</th><th className="px-4 py-2 text-start">Resource</th><th className="px-4 py-2 text-start">Details</th></tr></thead>
          <tbody>
            {shown.slice(0, 200).map((r) => (
              <tr key={r.id} className="border-t border-neutral-100 dark:border-neutral-800 align-top">
                <td className="px-4 py-1.5 whitespace-nowrap text-xs text-neutral-500">{fmtDate(r.at)}</td>
                <td className="px-4 py-1.5 font-mono text-xs">{r.action.startsWith('admin.') ? <span className="text-amber-700">{r.action}</span> : r.action}</td>
                <td className="px-4 py-1.5 text-xs">{r.user?.email ?? '—'}{r.tokenId && <span className="ms-1 badge bg-neutral-100 text-neutral-600 dark:bg-neutral-800">token</span>}</td>
                <td className="px-4 py-1.5 font-mono text-xs text-neutral-500">{r.resource ?? ''}</td>
                <td className="px-4 py-1.5"><pre className="max-w-lg truncate text-xs text-neutral-500">{r.request ? JSON.stringify(r.request) : ''}</pre></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AdminShell>
  );
}
