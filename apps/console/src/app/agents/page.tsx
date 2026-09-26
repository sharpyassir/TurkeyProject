'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError, money } from '@/lib/api';
import { t } from '@/lib/i18n';
import { useShell } from '@/components/shell';

interface Token { id: string; name: string; prefix: string; scopes: string[]; isAgent: boolean; spendCapMinor: number | null; spentThisMonthMinor: number; requireApprovalFor: string[]; lastUsedAt: string | null; createdAt: string }

const SCOPES = ['servers:read', 'servers:write', 'servers:delete', 'snapshots:read', 'snapshots:write', 'network:read', 'network:write', 'apps:read', 'billing:read'];
const APPROVALS = ['servers:delete', 'servers:resize-down', 'servers:rebuild'];

/**
 * The AI-native surface: tokens for Claude, Cursor, n8n or any agent, with a monthly spend
 * cap and a list of actions that must wait for a human. (DO tokens have scopes only.)
 */
export default function AgentsPage() {
  const { locale } = useShell();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [currency, setCurrency] = useState<'USD' | 'SAR'>('USD');
  const [issued, setIssued] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [tk, bal] = await Promise.all([api<{ data: Token[] }>('/v1/tokens'), api<{ currency: 'USD' | 'SAR' }>('/v1/billing/balance')]);
    setTokens(tk.data.filter((x) => x.isAgent));
    setCurrency(bal.currency);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const cap = Number(f.get('cap'));
    try {
      const r = await api<{ token: string }>('/v1/tokens', {
        method: 'POST',
        body: JSON.stringify({ name: f.get('name'), isAgent: true, scopes: f.getAll('scope'), spendCapMinor: cap > 0 ? Math.round(cap * 100) : undefined, requireApprovalFor: f.getAll('approve') }),
      });
      setIssued(r.token);
      e.currentTarget.reset();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  async function revoke(id: string) {
    await api(`/v1/tokens/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t(locale, 'agentTokens')}</h1>

      {issued && (
        <div className="card border-blue-300 dark:border-blue-800">
          <div className="text-sm font-medium">{t(locale, 'tokenShownOnce')}</div>
          <code className="mt-2 block select-all break-all rounded bg-neutral-100 p-2 text-xs dark:bg-neutral-800">{issued}</code>
          <p className="mt-2 text-xs text-neutral-500">MCP / SDK: <code>Authorization: Bearer {issued.slice(0, 12)}…</code></p>
        </div>
      )}

      <div className="card p-0">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-neutral-500">
            <tr><th className="px-4 py-2 text-start">{t(locale, 'name')}</th><th className="px-4 py-2 text-start">{t(locale, 'scopes')}</th><th className="px-4 py-2 text-start">{t(locale, 'spendCap')}</th><th className="px-4 py-2 text-start">{t(locale, 'requireApproval')}</th><th /></tr>
          </thead>
          <tbody>
            {tokens.length === 0 && <tr><td className="px-4 py-3 text-neutral-500" colSpan={5}>—</td></tr>}
            {tokens.map((tk) => (
              <tr key={tk.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-4 py-2"><div className="font-medium">{tk.name}</div><div className="font-mono text-xs text-neutral-500">{tk.prefix}…</div></td>
                <td className="px-4 py-2 text-xs">{tk.scopes.join(', ')}</td>
                <td className="px-4 py-2">{tk.spendCapMinor != null ? `${money(tk.spentThisMonthMinor, currency, locale)} / ${money(tk.spendCapMinor, currency, locale)}` : '∞'}</td>
                <td className="px-4 py-2 text-xs">{tk.requireApprovalFor.join(', ') || '—'}</td>
                <td className="px-4 py-2 text-end"><button className="btn-danger" onClick={() => revoke(tk.id)}>{t(locale, 'revoke')}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={create} className="card space-y-4">
        <h2 className="font-medium">{t(locale, 'newAgentToken')}</h2>
        <input className="input" name="name" placeholder="claude-code" required />
        <div>
          <div className="mb-1 text-xs text-neutral-500">{t(locale, 'scopes')}</div>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {SCOPES.map((s) => <label key={s} className="flex items-center gap-2 text-sm"><input type="checkbox" name="scope" value={s} defaultChecked={s.endsWith(':read') || s === 'servers:write'} /> {s}</label>)}
          </div>
        </div>
        <label className="block text-sm">
          <span className="text-neutral-500">{t(locale, 'spendCap')} ({currency})</span>
          <input className="input mt-1" name="cap" type="number" min={0} step={1} defaultValue={100} />
        </label>
        <div>
          <div className="mb-1 text-xs text-neutral-500">{t(locale, 'requireApproval')}</div>
          <div className="flex flex-wrap gap-3">
            {APPROVALS.map((a) => <label key={a} className="flex items-center gap-2 text-sm"><input type="checkbox" name="approve" value={a} defaultChecked /> {a}</label>)}
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary">{t(locale, 'newAgentToken')}</button>
      </form>
    </div>
  );
}
