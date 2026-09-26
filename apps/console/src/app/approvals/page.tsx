'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useShell } from '@/components/shell';
import { t, tf } from '@/lib/i18n';
import { StatusBadge } from '@/components/status-badge';

interface Approval {
  id: string; kind: string; summary: string; status: string; resourceId: string | null; resourceName: string | null;
  payload: Record<string, unknown>; reason: string | null; expiresAt: string; createdAt: string; decidedAt: string | null;
  token: { name: string; prefix: string } | null; decidedBy: { name: string; email: string } | null;
}

export default function ApprovalsPage() {
  const { locale } = useShell();
  const [rows, setRows] = useState<Approval[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => api<{ data: Approval[] }>('/v1/approvals').then((r) => setRows(r.data)), []);
  useEffect(() => { load(); const h = setInterval(load, 15000); return () => clearInterval(h); }, [load]);

  async function decide(a: Approval, decision: 'approve' | 'deny') {
    let reason: string | undefined;
    if (decision === 'deny') { const r = prompt(t(locale, 'denyReasonPrompt')); if (r === null) return; reason = r || undefined; }
    if (decision === 'approve' && !confirm(tf(locale, 'approveConfirm')(a.summary))) return;
    setBusy(a.id); setError(null);
    try { await api(`/v1/approvals/${a.id}/${decision}`, { method: 'POST', body: JSON.stringify(reason ? { reason } : {}) }); await load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : String(err)); await load(); }
    finally { setBusy(null); }
  }

  const pending = rows?.filter((r) => r.status === 'pending') ?? [];
  const history = rows?.filter((r) => r.status !== 'pending') ?? [];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t(locale, 'approvalQueue')}</h1>
        <p className="mt-1 text-sm text-neutral-500">{t(locale, 'approvalsLead')} <Link href="/agents" className="text-blue-600 hover:underline">{t(locale, 'agentAccess')}</Link>.</p>
      </div>
      {error && <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/30">{error}</p>}

      <section className="space-y-3">
        <h2 className="font-medium">{t(locale, 'waitingForYou')} {pending.length > 0 && <span className="badge bg-amber-100 text-amber-800">{pending.length}</span>}</h2>
        {rows && pending.length === 0 && <p className="card text-sm text-neutral-500">{t(locale, 'nothingWaiting')}</p>}
        {pending.map((a) => (
          <div key={a.id} className="card space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{a.summary}</span>
              <span className="badge bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">{a.kind}</span>
            </div>
            <p className="text-sm text-neutral-500">
              {t(locale, 'requestedByToken')} <span className="font-mono">{a.token?.name ?? t(locale, 'deletedToken')}</span> {new Date(a.createdAt).toLocaleString(locale)}.
              {t(locale, 'expires')} {new Date(a.expiresAt).toLocaleString(locale)}.
              {a.resourceId && <> {t(locale, 'server')} <Link href={`/servers/${a.resourceId}`} className="text-blue-600 hover:underline">{a.resourceName ?? a.resourceId}</Link>.</>}
            </p>
            {Object.keys(a.payload).length > 0 && <pre className="overflow-x-auto rounded bg-neutral-100 p-2 text-xs dark:bg-neutral-800">{JSON.stringify(a.payload, null, 2)}</pre>}
            <div className="flex gap-2">
              <button className="btn-primary" disabled={busy === a.id} onClick={() => decide(a, 'approve')}>{t(locale, 'approveRun')}</button>
              <button className="btn-danger" disabled={busy === a.id} onClick={() => decide(a, 'deny')}>{t(locale, 'deny')}</button>
            </div>
          </div>
        ))}
      </section>

      {history.length > 0 && (
        <section className="card p-0 text-sm">
          <h2 className="border-b border-neutral-100 px-4 py-2 font-medium dark:border-neutral-800">{t(locale, 'history')}</h2>
          <table className="w-full">
            <tbody>
              {history.map((a) => (
                <tr key={a.id} className="border-t border-neutral-100 first:border-0 dark:border-neutral-800">
                  <td className="px-4 py-2">{a.summary}</td>
                  <td className="px-4 py-2"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-2 text-neutral-500">{a.decidedBy ? a.decidedBy.name : ''} {a.decidedAt ? new Date(a.decidedAt).toLocaleString(locale) : ''}</td>
                  <td className="px-4 py-2 text-neutral-500">{a.reason ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
