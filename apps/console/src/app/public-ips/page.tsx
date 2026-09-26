'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { t } from '@/lib/i18n';
import { useShell } from '@/components/shell';

interface Ip { id: string; address: string; status: string; floating: boolean; serverId: string | null; reverseDns: string | null }

export default function PublicIpsPage() {
  const { locale } = useShell();
  const [ips, setIps] = useState<Ip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => api<{ data: Ip[] }>('/v1/public-ips').then((r) => setIps(r.data)), []);
  useEffect(() => { load(); }, [load]);
  function setRdns(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault(); setError(null);
    const name = String(new FormData(e.currentTarget).get('name') ?? '').trim();
    api(`/v1/public-ips/${id}/reverse-dns`, { method: 'PUT', body: JSON.stringify({ name: name || null }) }).then(load).catch((err) => setError(err instanceof ApiError ? err.message : String(err)));
  }
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t(locale, 'publicIps')}</h1>
      {error && <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/30">{error}</p>}
      <div className="card p-0">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-neutral-500"><tr><th className="px-4 py-2 text-start">IP</th><th className="px-4 py-2 text-start">{t(locale, 'status')}</th><th className="px-4 py-2 text-start">Server</th><th className="px-4 py-2 text-start">rDNS</th></tr></thead>
          <tbody>
            {ips.map((ip) => (
              <tr key={ip.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-4 py-2 font-mono">{ip.address}</td>
                <td className="px-4 py-2">{ip.status}{ip.floating ? ' · floating' : ''}</td>
                <td className="px-4 py-2 font-mono text-xs">{ip.serverId ?? '—'}</td>
                <td className="px-4 py-2"><form onSubmit={(e) => setRdns(e, ip.id)} className="flex gap-1"><input name="name" className="input py-1 text-xs" style={{ width: '14rem' }} defaultValue={ip.reverseDns ?? ''} placeholder="mail.example.com" /><button className="btn-ghost">Set</button></form></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
