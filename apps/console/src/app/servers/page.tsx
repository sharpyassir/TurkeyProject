'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, Server } from '@/lib/api';
import { t } from '@/lib/i18n';
import { useShell } from '@/components/shell';
import { StatusBadge } from '@/components/status-badge';

export default function ServersPage() {
  const { locale } = useShell();
  const [servers, setServers] = useState<Server[] | null>(null);
  const [pending, setPending] = useState(0);

  const load = useCallback(async () => {
    const res = await api<{ data: Server[] }>('/v1/servers');
    setServers(res.data);
  }, []);

  // Poll while anything is transitioning so the user watches provisioning live.
  useEffect(() => { api<{ pending: number }>('/v1/approvals?status=pending').then((r) => setPending(r.pending)).catch(() => undefined); }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (servers?.some((s) => !['active', 'off', 'failed'].includes(s.status))) load();
    }, 2000);
    return () => clearInterval(id);
  }, [load, servers]);

  async function action(s: Server, type: 'start' | 'stop' | 'reboot' | 'delete') {
    if (type === 'delete' && !confirm(t(locale, 'confirmDelete'))) return;
    if (type === 'delete') await api(`/v1/servers/${s.id}`, { method: 'DELETE', idempotent: true });
    else await api(`/v1/servers/${s.id}/actions`, { method: 'POST', body: JSON.stringify({ type }), idempotent: true });
    load();
  }

  return (
    <div>
      <div className="mb-4 flex items-center">
        <h1 className="text-xl font-semibold">{t(locale, 'servers')}</h1>
        <Link href="/servers/new" className="btn-primary ms-auto">{t(locale, 'create')}</Link>
      </div>
      {pending > 0 && <Link href="/approvals" className="mb-4 block rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-200">{pending} agent {pending === 1 ? 'request is' : 'requests are'} waiting for your approval →</Link>}
      {servers && servers.length === 0 && <p className="card text-neutral-500">{t(locale, 'noServers')}</p>}
      {servers && servers.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-start text-xs uppercase text-neutral-500">
              <tr>
                {(['name', 'status', 'ip', 'size', 'image', 'created', 'actions'] as const).map((k) => (
                  <th key={k} className="px-4 py-2 text-start">{t(locale, k)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {servers.map((s) => (
                <tr key={s.id} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="px-4 py-2 font-medium"><Link href={`/servers/${s.id}`} className="hover:underline">{s.name}</Link></td>
                  <td className="px-4 py-2"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-2 font-mono">{s.networks.v4[0]?.ipAddress ?? '—'}</td>
                  <td className="px-4 py-2">{s.size.id}</td>
                  <td className="px-4 py-2">{s.image.name}</td>
                  <td className="px-4 py-2 text-neutral-500">{new Date(s.createdAt).toLocaleString(locale)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {s.status === 'active' && <button className="btn-ghost me-1" onClick={() => action(s, 'stop')}>{t(locale, 'stop')}</button>}
                    {s.status === 'active' && <button className="btn-ghost me-1" onClick={() => action(s, 'reboot')}>{t(locale, 'reboot')}</button>}
                    {s.status === 'off' && <button className="btn-ghost me-1" onClick={() => action(s, 'start')}>{t(locale, 'start')}</button>}
                    {['active', 'off', 'failed'].includes(s.status) && <button className="btn-danger" onClick={() => action(s, 'delete')}>{t(locale, 'delete')}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
