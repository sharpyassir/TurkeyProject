'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useShell } from '@/components/shell';
import { StatusBadge } from '@/components/status-badge';
import { t } from '@/lib/i18n';
import type { TicketSummary } from '@/lib/support';

interface Ticket extends TicketSummary { messages: { id: string; fromSupport: boolean; author: string; body: string; createdAt: string }[] }

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const { locale } = useShell();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<Ticket>(`/v1/support/tickets/${id}`).then(setTicket), [id]);
  useEffect(() => { load().catch((e) => setError(String(e))); }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setError(null);
    try { await fn(); await load(); } catch (e) { setError(e instanceof ApiError ? e.message : String(e)); } finally { setBusy(false); }
  }
  async function reply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = String(new FormData(form).get('body') ?? '');
    await run(async () => { await api(`/v1/support/tickets/${id}/messages`, { method: 'POST', body: JSON.stringify({ body }) }); form.reset(); });
  }

  if (!ticket) return <p className="text-sm text-neutral-500">{error ?? '…'}</p>;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/support" className="text-sm text-neutral-500 hover:underline">← {t(locale, 'support')}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">#{ticket.number} {ticket.subject}</h1>
        <StatusBadge status={ticket.status} />
        <span className="text-sm text-neutral-500">{t(locale, `prio_${ticket.priority}` as Parameters<typeof t>[1])}{ticket.resource && <> · <code className="font-mono text-xs">{ticket.resource}</code></>}</span>
        {ticket.status !== 'closed' && <button className="btn-ghost ms-auto" disabled={busy} onClick={() => run(() => api(`/v1/support/tickets/${id}/close`, { method: 'POST' }))}>{t(locale, 'closeTicket')}</button>}
      </div>
      <p className="text-xs text-neutral-500">
        {ticket.firstRespondedAt ? `${t(locale, 'answeredAt')} ${new Date(ticket.firstRespondedAt).toLocaleString(locale)}` : ticket.firstResponseDueAt ? `${t(locale, 'responseTarget')}: ${new Date(ticket.firstResponseDueAt).toLocaleString(locale)}` : ''}
      </p>
      {error && <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/30">{error}</p>}

      <div className="space-y-3">
        {ticket.messages.map((m) => (
          <div key={m.id} className={`card ${m.fromSupport ? 'border-blue-200 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-950/20' : ''}`}>
            <div className="mb-1 flex items-center gap-2 text-xs text-neutral-500"><span className="font-medium text-neutral-800 dark:text-neutral-200">{m.author}</span>{m.fromSupport && <span className="badge bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">{t(locale, 'supportTeam')}</span>}<span className="ms-auto">{new Date(m.createdAt).toLocaleString(locale)}</span></div>
            <p className="whitespace-pre-wrap text-sm">{m.body}</p>
          </div>
        ))}
      </div>

      <form onSubmit={reply} className="card space-y-2">
        <textarea className="input min-h-28" name="body" required placeholder={t(locale, ticket.status === 'closed' ? 'reopenPlaceholder' : 'replyPlaceholder')} />
        <div className="flex gap-2"><button className="btn-primary" disabled={busy}>{t(locale, ticket.status === 'closed' ? 'reopenTicket' : 'sendReply')}</button></div>
      </form>
    </div>
  );
}
