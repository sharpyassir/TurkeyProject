'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { t } from '@/lib/i18n';
import { useShell } from '@/components/shell';

interface Rule { id: string; direction: string; protocol: string; ports: string | null; sources: string[]; destinations: string[] }
interface Firewall { id: string; name: string; rules: Rule[]; servers: { serverId: string }[] }

const PRESETS = [
  { direction: 'inbound', protocol: 'tcp', ports: '22', cidrs: ['0.0.0.0/0'] },
  { direction: 'inbound', protocol: 'tcp', ports: '80', cidrs: ['0.0.0.0/0'] },
  { direction: 'inbound', protocol: 'tcp', ports: '443', cidrs: ['0.0.0.0/0'] },
  { direction: 'outbound', protocol: 'any', cidrs: ['0.0.0.0/0'] },
];

export default function FirewallsPage() {
  const { locale } = useShell();
  const [list, setList] = useState<Firewall[]>([]);
  const load = useCallback(() => api<{ data: Firewall[] }>('/v1/firewalls').then((r) => setList(r.data)), []);
  useEffect(() => { load(); }, [load]);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await api('/v1/firewalls', { method: 'POST', body: JSON.stringify({ name: f.get('name'), rules: PRESETS }) });
    e.currentTarget.reset();
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t(locale, 'firewalls')}</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((fw) => (
          <div key={fw.id} className="card">
            <div className="font-medium">{fw.name}</div>
            <div className="text-xs text-neutral-500">{fw.rules.length} {t(locale, 'rules')} · {fw.servers.length} {t(locale, 'attachedServers')}</div>
            <ul className="mt-2 space-y-0.5 font-mono text-xs">
              {fw.rules.map((r) => <li key={r.id}>{r.direction === 'inbound' ? '←' : '→'} {r.protocol}{r.ports ? `:${r.ports}` : ''} {(r.direction === 'inbound' ? r.sources : r.destinations).join(', ')}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <form onSubmit={create} className="card flex items-center gap-3">
        <input className="input" name="name" placeholder="web" required />
        <button className="btn-primary whitespace-nowrap">{t(locale, 'newFirewall')}</button>
      </form>
    </div>
  );
}
