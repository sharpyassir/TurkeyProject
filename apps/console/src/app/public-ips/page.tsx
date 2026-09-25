'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { t } from '@/lib/i18n';
import { useShell } from '@/components/shell';

interface Ip { id: string; address: string; status: string; floating: boolean; serverId: string | null; reverseDns: string | null }

export default function PublicIpsPage() {
  const { locale } = useShell();
  const [ips, setIps] = useState<Ip[]>([]);
  useEffect(() => { api<{ data: Ip[] }>('/v1/public-ips').then((r) => setIps(r.data)); }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t(locale, 'publicIps')}</h1>
      <div className="card p-0">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-neutral-500"><tr><th className="px-4 py-2 text-start">IP</th><th className="px-4 py-2 text-start">{t(locale, 'status')}</th><th className="px-4 py-2 text-start">Server</th><th className="px-4 py-2 text-start">rDNS</th></tr></thead>
          <tbody>
            {ips.map((ip) => (
              <tr key={ip.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-4 py-2 font-mono">{ip.address}</td>
                <td className="px-4 py-2">{ip.status}{ip.floating ? ' · floating' : ''}</td>
                <td className="px-4 py-2 font-mono text-xs">{ip.serverId ?? '—'}</td>
                <td className="px-4 py-2">{ip.reverseDns ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
