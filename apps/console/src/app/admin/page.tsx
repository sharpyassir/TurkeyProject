'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AdminShell, Stat, fmtDate, fmtMoney } from '@/components/admin-shell';
import { StatusBadge } from '@/components/status-badge';

interface Overview {
  teams: Record<string, number>; teamsNewThisWeek: number; servers: Record<string, number>;
  hosts: { id: string; name: string; status: string; totalVcpu: number; totalMemoryMb: number; totalDiskGb: number; usedVcpu: number; usedMemoryMb: number; usedDiskGb: number; lastHeartbeatAt: string | null }[];
  pendingApprovals: number; openAbuseFlags: number; openInvoices: { count: number; totalMinor: number };
  monthToDate: Record<string, number>; paymentsThisMonth: Record<string, number>;
  recentTeams: { id: string; name: string; slug: string; country: string; currency: string; status: string; createdAt: string }[];
}

export default function AdminOverview() {
  const [o, setO] = useState<Overview | null>(null);
  useEffect(() => { api<Overview>('/admin/v1/overview').then(setO); }, []);
  if (!o) return <AdminShell title="Overview"><p className="text-sm text-neutral-500">Loading…</p></AdminShell>;
  const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
  const money = (r: Record<string, number>) => Object.entries(r).map(([c, m]) => fmtMoney(m, c)).join(' + ') || '—';
  return (
    <AdminShell title="Overview">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Teams" value={sum(o.teams)} sub={`${o.teamsNewThisWeek} new this week · ${o.teams.suspended ?? 0} suspended`} />
        <Stat label="Servers" value={sum(o.servers)} sub={`${o.servers.active ?? 0} active · ${o.servers.failed ?? 0} failed`} tone={(o.servers.failed ?? 0) > 0 ? 'warn' : undefined} />
        <Stat label="Usage this month" value={money(o.monthToDate)} sub={`payments received ${money(o.paymentsThisMonth)}`} />
        <Stat label="Open invoices" value={o.openInvoices.count} sub={o.openInvoices.count ? `${fmtMoney(o.openInvoices.totalMinor, 'TRY')} outstanding` : 'nothing outstanding'} tone={o.openInvoices.count ? 'warn' : undefined} />
        <Stat label="Pending approvals" value={o.pendingApprovals} sub="agent requests waiting on customers" />
        <Stat label="Open abuse flags" value={o.openAbuseFlags} tone={o.openAbuseFlags ? 'bad' : undefined} sub={o.openAbuseFlags ? 'review under Abuse' : 'all clear'} />
        <Stat label="Hosts" value={o.hosts.length} sub={`${o.hosts.filter((h) => h.status === 'active').length} active`} />
        <Stat label="Capacity used" value={o.hosts.length ? `${Math.round((o.hosts.reduce((a, h) => a + h.usedMemoryMb, 0) / Math.max(1, o.hosts.reduce((a, h) => a + h.totalMemoryMb, 0))) * 100)}%` : '—'} sub="memory across active hosts" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-0">
          <h2 className="border-b border-neutral-100 px-4 py-2 font-medium dark:border-neutral-800">Hosts</h2>
          <table className="w-full text-sm"><tbody>
            {o.hosts.length === 0 && <tr><td className="px-4 py-3 text-neutral-500">No hosts registered. Add one under Hosts.</td></tr>}
            {o.hosts.map((h) => (
              <tr key={h.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-4 py-2 font-medium">{h.name}</td><td className="px-4 py-2"><StatusBadge status={h.status} /></td>
                <td className="px-4 py-2 text-xs text-neutral-500">{h.usedVcpu}/{h.totalVcpu} vCPU · {Math.round(h.usedMemoryMb / 1024)}/{Math.round(h.totalMemoryMb / 1024)} GB · {h.usedDiskGb}/{h.totalDiskGb} GB</td>
                <td className="px-4 py-2 text-xs text-neutral-500">{h.lastHeartbeatAt ? `seen ${fmtDate(h.lastHeartbeatAt)}` : 'no heartbeat yet'}</td>
              </tr>
            ))}
          </tbody></table>
        </section>
        <section className="card p-0">
          <h2 className="border-b border-neutral-100 px-4 py-2 font-medium dark:border-neutral-800">Newest teams</h2>
          <table className="w-full text-sm"><tbody>
            {o.recentTeams.map((t) => (
              <tr key={t.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-4 py-2"><Link href={`/admin/teams/${t.id}`} className="font-medium hover:underline">{t.name}</Link> <span className="text-xs text-neutral-500">{t.slug}</span></td>
                <td className="px-4 py-2 text-xs text-neutral-500">{t.country} · {t.currency}</td><td className="px-4 py-2"><StatusBadge status={t.status} /></td>
                <td className="px-4 py-2 text-xs text-neutral-500">{fmtDate(t.createdAt)}</td>
              </tr>
            ))}
          </tbody></table>
        </section>
      </div>
    </AdminShell>
  );
}
