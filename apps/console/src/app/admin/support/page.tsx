'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { AdminShell, fmtDate } from '@/components/admin-shell';
import { StatusBadge } from '@/components/status-badge';

interface Row { id: string; number: number; subject: string; status: string; priority: string; plan: string; resource: string | null; firstResponseDueAt: string | null; firstRespondedAt: string | null; lastCustomerAt: string; updatedAt: string; messageCount: number; overdue: boolean; team: { id: string; name: string; slug: string; supportPlan: string } | null }
interface Ticket extends Row { messages: { id: string; fromSupport: boolean; author: string; body: string; createdAt: string }[]; team: { id: string; name: string; slug: string; supportPlan: string; currency: string; country: string; members: { user: { email: string; name: string } }[] } | null }

const PRIO_TONE: Record<string, string> = { urgent: 'text-red-700', high: 'text-amber-700', normal: '', low: 'text-neutral-500' };

/** The support queue, oldest due first, with the thread and reply box for the selected ticket. */
export default function AdminSupport() {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<'open' | 'answered' | 'closed' | 'all'>('open');
  const [rows, setRows] = useState<Row[]>([]);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = params?.id;

  const load = useCallback(async () => {
    const r = await api<{ data: Row[] }>(`/admin/v1/support/tickets?status=${status}&limit=100`);
    setRows(r.data);
    if (selected) setTicket(await api<Ticket>(`/admin/v1/support/tickets/${selected}`));
  }, [status, selected]);
  useEffect(() => { load().catch((e) => setMsg(String(e))); }, [load]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg(ok); await load(); } catch (e) { setMsg(e instanceof ApiError ? e.message : String(e)); } finally { setBusy(false); }
  }
  async function reply(e: FormEvent<HTMLFormElement>, close: boolean) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = String(new FormData(form).get('body') ?? '');
    await run(async () => { await api(`/admin/v1/support/tickets/${selected}/reply`, { method: 'POST', body: JSON.stringify({ body, close }) }); form.reset(); }, close ? 'Answered and closed.' : 'Answered.');
  }

  return (
    <AdminShell title="Support queue" actions={<select className="input w-auto py-1" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="open">Waiting on us</option><option value="answered">Waiting on customer</option><option value="closed">Closed</option><option value="all">All</option></select>}>
      {msg && <p className="rounded border border-neutral-200 bg-neutral-50 p-2 text-sm dark:border-neutral-800 dark:bg-neutral-900">{msg}</p>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-xs text-neutral-500"><tr><th className="px-3 py-2 text-start">#</th><th className="px-3 py-2 text-start">Subject</th><th className="px-3 py-2 text-start">Team</th><th className="px-3 py-2 text-start">Priority</th><th className="px-3 py-2 text-start">Due</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-3 text-neutral-500">Nothing here.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className={`cursor-pointer border-t border-neutral-100 dark:border-neutral-800 ${selected === r.id ? 'bg-neutral-50 dark:bg-neutral-900' : ''}`} onClick={() => router.push(`/admin/support/${r.id}`)}>
                  <td className="px-3 py-2 text-neutral-500">{r.number}</td>
                  <td className="px-3 py-2"><span className="font-medium">{r.subject}</span>{r.resource && <div className="font-mono text-xs text-neutral-500">{r.resource}</div>}</td>
                  <td className="px-3 py-2">{r.team ? <Link href={`/admin/teams/${r.team.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>{r.team.name}</Link> : '—'}<div className="text-xs text-neutral-500">{r.plan}</div></td>
                  <td className={`px-3 py-2 ${PRIO_TONE[r.priority] ?? ''}`}>{r.priority}</td>
                  <td className={`px-3 py-2 text-xs ${r.overdue ? 'font-medium text-red-700' : 'text-neutral-500'}`}>{r.firstRespondedAt ? 'answered' : r.firstResponseDueAt ? (r.overdue ? 'overdue ' : '') + fmtDate(r.firstResponseDueAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3">
          {!ticket && <p className="text-sm text-neutral-500">Pick a ticket.</p>}
          {ticket && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-medium">#{ticket.number} {ticket.subject}</h2>
                <StatusBadge status={ticket.status} />
                <span className={`text-sm ${PRIO_TONE[ticket.priority] ?? ''}`}>{ticket.priority}</span>
                {ticket.status !== 'closed' && <button className="btn-ghost ms-auto" disabled={busy} onClick={() => run(() => api(`/admin/v1/support/tickets/${ticket.id}/close`, { method: 'POST' }), 'Closed.')}>Close without reply</button>}
              </div>
              {ticket.team && <p className="text-xs text-neutral-500">{ticket.team.name} · plan {ticket.team.supportPlan} · {ticket.team.country} · {ticket.team.members.map((m) => m.user.email).join(', ')}{ticket.firstResponseDueAt && <> · first response due {fmtDate(ticket.firstResponseDueAt)}</>}</p>}
              {ticket.messages.map((m) => (
                <div key={m.id} className={`card ${m.fromSupport ? 'border-blue-200 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-950/20' : ''}`}>
                  <div className="mb-1 flex items-center gap-2 text-xs text-neutral-500"><span className="font-medium text-neutral-800 dark:text-neutral-200">{m.author}</span><span className="ms-auto">{fmtDate(m.createdAt)}</span></div>
                  <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                </div>
              ))}
              <form onSubmit={(e) => reply(e, false)} className="card space-y-2">
                <textarea className="input min-h-28" name="body" required placeholder="Answer goes to the team owners and whoever opened the ticket." />
                <div className="flex gap-2">
                  <button className="btn-primary" disabled={busy}>Answer</button>
                  <button type="button" className="btn-ghost" disabled={busy} onClick={(e) => { const form = (e.currentTarget as HTMLButtonElement).form!; if (form.reportValidity()) reply({ preventDefault() {}, currentTarget: form } as unknown as FormEvent<HTMLFormElement>, true); }}>Answer and close</button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
