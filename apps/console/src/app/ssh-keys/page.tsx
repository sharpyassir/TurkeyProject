'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { t } from '@/lib/i18n';
import { useShell } from '@/components/shell';

interface Key { id: string; name: string; fingerprint: string; createdAt: string }

export default function SshKeysPage() {
  const { locale } = useShell();
  const [keys, setKeys] = useState<Key[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => api<{ data: Key[] }>('/v1/ssh-keys').then((r) => setKeys(r.data)), []);
  useEffect(() => { load(); }, [load]);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const f = new FormData(e.currentTarget);
    try {
      await api('/v1/ssh-keys', { method: 'POST', body: JSON.stringify({ name: f.get('name'), publicKey: f.get('publicKey') }) });
      e.currentTarget.reset(); load();
    } catch (err) { setError(err instanceof ApiError ? err.message : String(err)); }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">SSH Keys</h1>
      <div className="card p-0">
        <table className="w-full text-sm">
          <tbody>
            {keys.length === 0 && <tr><td className="px-4 py-3 text-neutral-500">—</td></tr>}
            {keys.map((k) => (
              <tr key={k.id} className="border-t border-neutral-100 first:border-0 dark:border-neutral-800">
                <td className="px-4 py-2 font-medium">{k.name}</td>
                <td className="px-4 py-2 font-mono text-xs text-neutral-500">{k.fingerprint}</td>
                <td className="px-4 py-2 text-end"><button className="btn-danger" onClick={() => api(`/v1/ssh-keys/${k.id}`, { method: 'DELETE' }).then(load)}>{t(locale, 'delete')}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form onSubmit={create} className="card space-y-3">
        <input className="input" name="name" placeholder="laptop" required />
        <textarea className="input font-mono text-xs" name="publicKey" rows={3} placeholder="ssh-ed25519 AAAA… user@host" required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary">Add SSH key</button>
      </form>
    </div>
  );
}
