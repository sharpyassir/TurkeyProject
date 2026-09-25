'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useShell } from '@/components/shell';

interface Entry { id: string; at: string; action: string; resource: string | null; userId: string | null; tokenId: string | null; request: Record<string, unknown> | null }

/** Every API call by every user, token and agent. The audit trail ISO 27001 buyers ask for. */
export default function AuditPage() {
  const { locale } = useShell();
  const [rows, setRows] = useState<Entry[]>([]);
  useEffect(() => { api<{ data: Entry[] }>('/v1/audit').then((r) => setRows(r.data)); }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Audit Log</h1>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-neutral-500"><tr><th className="px-4 py-2 text-start">Time</th><th className="px-4 py-2 text-start">Action</th><th className="px-4 py-2 text-start">Resource</th><th className="px-4 py-2 text-start">Actor</th><th className="px-4 py-2 text-start">Details</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-neutral-100 align-top dark:border-neutral-800">
                <td className="px-4 py-2 whitespace-nowrap text-neutral-500">{new Date(r.at).toLocaleString(locale)}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.action}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.resource ?? '—'}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.tokenId ? `token ${r.tokenId.slice(-6)}` : r.userId ? `user ${r.userId.slice(-6)}` : 'system'}</td>
                <td className="px-4 py-2 font-mono text-xs text-neutral-500">{r.request ? JSON.stringify(r.request).slice(0, 120) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
