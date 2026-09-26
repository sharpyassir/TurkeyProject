'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AdminShell, fmtDate } from '@/components/admin-shell';

interface Flag { id: string; kind: string; score: number; source: string; evidence: Record<string, unknown>; serverId: string | null; createdAt: string; team: { id: string; name: string; slug: string } }

export default function AdminAbuse() {
  const [rows, setRows] = useState<Flag[]>([]);
  const load = useCallback(() => api<{ data: Flag[] }>('/admin/v1/abuse').then((r) => setRows(r.data)), []);
  useEffect(() => { load(); }, [load]);
  const resolve = (f: Flag, resolution: string) => api(`/admin/v1/abuse/${f.id}/resolve`, { method: 'POST', body: JSON.stringify({ resolution }) }).then(load);
  return (
    <AdminShell title="Abuse flags">
      <p className="text-sm text-neutral-500">Raised by payment failures, abuse reports and the AI ops checks. Scores of 90 and above suspend the team automatically; everything else waits here.</p>
      <section className="card p-0">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-neutral-500"><tr><th className="px-4 py-2 text-start">Score</th><th className="px-4 py-2 text-start">Kind</th><th className="px-4 py-2 text-start">Team</th><th className="px-4 py-2 text-start">Evidence</th><th className="px-4 py-2 text-start">Raised</th><th /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td className="px-4 py-3 text-neutral-500" colSpan={6}>No open flags.</td></tr>}
            {rows.map((f) => (
              <tr key={f.id} className="border-t border-neutral-100 dark:border-neutral-800 align-top">
                <td className="px-4 py-2"><span className={`badge ${f.score >= 70 ? 'bg-red-100 text-red-800' : f.score >= 40 ? 'bg-amber-100 text-amber-800' : 'bg-neutral-100 text-neutral-700'}`}>{f.score}</span></td>
                <td className="px-4 py-2">{f.kind} <span className="text-xs text-neutral-500">{f.source}</span></td>
                <td className="px-4 py-2"><Link href={`/admin/teams/${f.team.id}`} className="hover:underline">{f.team.name}</Link>{f.serverId && <div className="font-mono text-xs text-neutral-500">{f.serverId}</div>}</td>
                <td className="px-4 py-2"><pre className="max-w-md overflow-x-auto text-xs text-neutral-600">{JSON.stringify(f.evidence)}</pre></td>
                <td className="px-4 py-2 text-xs text-neutral-500">{fmtDate(f.createdAt)}</td>
                <td className="px-4 py-2 text-end whitespace-nowrap">
                  <button className="btn-ghost me-1" onClick={() => resolve(f, 'false_positive')}>False positive</button>
                  <button className="btn-ghost me-1" onClick={() => resolve(f, 'warned')}>Warned</button>
                  <button className="btn-danger" onClick={() => confirm(`Suspend ${f.team.name}?`) && resolve(f, 'suspended')}>Suspend</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AdminShell>
  );
}
