'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { t } from '@/lib/i18n';
import { useShell } from '@/components/shell';
import { StatusBadge } from '@/components/status-badge';

interface Snap { id: string; name: string; status: string; sizeGb: number; serverId: string | null; createdAt: string }

export default function SnapshotsPage() {
  const { locale } = useShell();
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const load = useCallback(() => api<{ data: Snap[] }>('/v1/snapshots').then((r) => setSnaps(r.data)), []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t(locale, 'snapshots')}</h1>
      <div className="card p-0">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-neutral-500"><tr><th className="px-4 py-2 text-start">{t(locale, 'name')}</th><th className="px-4 py-2 text-start">{t(locale, 'status')}</th><th className="px-4 py-2 text-start">GB</th><th className="px-4 py-2 text-start">{t(locale, 'created')}</th><th /></tr></thead>
          <tbody>
            {snaps.length === 0 && <tr><td className="px-4 py-3 text-neutral-500" colSpan={5}>—</td></tr>}
            {snaps.map((s) => (
              <tr key={s.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-4 py-2 font-medium">{s.name}</td>
                <td className="px-4 py-2"><StatusBadge status={s.status} /></td>
                <td className="px-4 py-2">{s.sizeGb.toFixed(1)}</td>
                <td className="px-4 py-2 text-neutral-500">{new Date(s.createdAt).toLocaleString(locale)}</td>
                <td className="px-4 py-2 text-end">{s.status === 'available' && <button className="btn-danger" onClick={() => api(`/v1/snapshots/${s.id}`, { method: 'DELETE' }).then(load)}>{t(locale, 'delete')}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
