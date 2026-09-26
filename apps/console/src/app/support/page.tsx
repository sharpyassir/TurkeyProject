'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError, money } from '@/lib/api';
import { useShell } from '@/components/shell';
import { StatusBadge } from '@/components/status-badge';
import { t, tf } from '@/lib/i18n';
import { PRIORITIES, targetLabel, type Current, type SupportPlan, type TicketSummary } from '@/lib/support';

export default function SupportPage() {
  const { locale } = useShell();
  const [plans, setPlans] = useState<SupportPlan[]>([]);
  const [current, setCurrent] = useState<Current | null>(null);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    const cur = await api<Current>('/v1/support/plan');
    setCurrent(cur);
    const [p, tk] = await Promise.all([
      api<{ data: SupportPlan[] }>(`/v1/support/plans?currency=${cur.details?.currency ?? 'USD'}`),
      api<{ data: TicketSummary[] }>(`/v1/support/tickets?status=${filter === 'open' ? 'all' : filter}`),
    ]);
    setPlans(p.data);
    setTickets(filter === 'open' ? tk.data.filter((x) => x.status !== 'closed') : tk.data);
  }, [filter]);
  useEffect(() => { load().catch((e) => setError(String(e))); }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setError(null);
    try { await fn(); await load(); } catch (e) { setError(e instanceof ApiError ? e.message : String(e)); } finally { setBusy(false); }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = { subject: f.get('subject'), body: f.get('body'), priority: f.get('priority'), ...(f.get('resource') ? { resource: f.get('resource') } : {}) };
    await run(async () => { await api('/v1/support/tickets', { method: 'POST', body: JSON.stringify(body) }); setShowNew(false); });
  }

  const planOf = (id: string) => plans.find((p) => p.id === id);
  const allowed = current ? PRIORITIES.filter((p) => (planOf(current.plan)?.targets[p] ?? null) !== null) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{t(locale, 'support')}</h1>
        <button className="btn-primary ms-auto" onClick={() => setShowNew((v) => !v)}>{t(locale, 'newTicket')}</button>
      </div>
      {error && <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/30">{error}</p>}

      {showNew && (
        <form onSubmit={submit} className="card space-y-3">
          <label className="block text-sm"><span className="text-neutral-500">{t(locale, 'subject')}</span><input className="input mt-1" name="subject" required minLength={3} maxLength={140} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm"><span className="text-neutral-500">{t(locale, 'priority')}</span>
              <select className="input mt-1" name="priority" defaultValue="normal">
                {PRIORITIES.map((p) => <option key={p} value={p} disabled={!allowed.includes(p)}>{t(locale, `prio_${p}` as Parameters<typeof t>[1])}{allowed.includes(p) ? '' : ` (${t(locale, 'notOnPlan')})`}</option>)}
              </select>
            </label>
            <label className="block text-sm"><span className="text-neutral-500">{t(locale, 'aboutResource')}</span><input className="input mt-1" name="resource" placeholder="server:cm…" pattern="[a-z_]+:[A-Za-z0-9_-]+" /></label>
          </div>
          <label className="block text-sm"><span className="text-neutral-500">{t(locale, 'message')}</span><textarea className="input mt-1 min-h-32" name="body" required /></label>
          <p className="text-xs text-neutral-500">{t(locale, 'ticketNote')}</p>
          <div className="flex gap-2"><button className="btn-primary" disabled={busy}>{t(locale, 'openTicket')}</button><button type="button" className="btn-ghost" onClick={() => setShowNew(false)}>{t(locale, 'cancel')}</button></div>
        </form>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="font-medium">{t(locale, 'tickets')}</h2>
          <div className="ms-auto flex gap-1 text-sm">
            {(['all', 'open', 'closed'] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={`rounded px-2 py-1 ${filter === f ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'text-neutral-600'}`}>{t(locale, `filter_${f}` as Parameters<typeof t>[1])}</button>)}
          </div>
        </div>
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-start text-xs text-neutral-500"><tr><th className="px-4 py-2 text-start">#</th><th className="px-4 py-2 text-start">{t(locale, 'subject')}</th><th className="px-4 py-2 text-start">{t(locale, 'status')}</th><th className="px-4 py-2 text-start">{t(locale, 'priority')}</th><th className="px-4 py-2 text-start">{t(locale, 'responseTarget')}</th><th className="px-4 py-2 text-start">{t(locale, 'updated')}</th></tr></thead>
            <tbody>
              {tickets.length === 0 && <tr><td colSpan={6} className="px-4 py-3 text-neutral-500">{t(locale, 'noTickets')}</td></tr>}
              {tickets.map((tk) => (
                <tr key={tk.id} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="px-4 py-2 text-neutral-500">{tk.number}</td>
                  <td className="px-4 py-2"><Link href={`/support/${tk.id}`} className="font-medium hover:underline">{tk.subject}</Link>{tk.resource && <span className="ms-2 font-mono text-xs text-neutral-500">{tk.resource}</span>}</td>
                  <td className="px-4 py-2"><StatusBadge status={tk.status} /></td>
                  <td className="px-4 py-2">{t(locale, `prio_${tk.priority}` as Parameters<typeof t>[1])}</td>
                  <td className="px-4 py-2 text-neutral-500">{tk.firstRespondedAt ? t(locale, 'answeredAt') + ' ' + new Date(tk.firstRespondedAt).toLocaleString(locale) : tk.firstResponseDueAt ? t(locale, 'by') + ' ' + new Date(tk.firstResponseDueAt).toLocaleString(locale) : '—'}</td>
                  <td className="px-4 py-2 text-neutral-500">{new Date(tk.updatedAt).toLocaleString(locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">{t(locale, 'supportPlan')}</h2>
        <p className="text-sm text-neutral-500">{t(locale, 'supportPlanNote')}</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((p) => {
            const active = current?.plan === p.id;
            return (
              <div key={p.id} className={`card flex flex-col gap-2 ${active ? 'border-blue-500' : ''}`}>
                <div className="flex items-baseline gap-2"><span className="font-medium">{p.name}</span>{active && <span className="badge bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">{t(locale, 'currentPlan')}</span>}</div>
                <div className="text-2xl font-semibold">{p.monthlyMinor === 0 ? t(locale, 'freeWord') : <>{money(p.monthlyMinor, p.currency, locale)}<span className="text-sm font-normal text-neutral-500">{t(locale, 'perMonth')}</span></>}</div>
                <p className="text-sm text-neutral-600 dark:text-neutral-300">{p.summary}</p>
                <ul className="space-y-1 text-sm">
                  {PRIORITIES.map((pr) => <li key={pr} className="flex justify-between"><span className="text-neutral-500">{t(locale, `prio_${pr}` as Parameters<typeof t>[1])}</span><span>{targetLabel(p.targets[pr], locale)}</span></li>)}
                </ul>
                <ul className="list-disc space-y-1 ps-4 text-xs text-neutral-500">{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
                <div className="mt-auto pt-2">
                  {!active && <button className="btn-ghost w-full" disabled={busy} onClick={() => run(() => api('/v1/support/plan', { method: 'PUT', body: JSON.stringify({ plan: p.id }) }))}>{plans.findIndex((x) => x.id === p.id) > plans.findIndex((x) => x.id === current?.plan) ? t(locale, 'upgrade') : t(locale, 'switchTo')}</button>}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-neutral-500">{tf(locale, 'supportBillingNote')(current?.openTickets ?? 0, planOf(current?.plan ?? 'free')?.maxOpen ?? 3)}</p>
      </section>
    </div>
  );
}
