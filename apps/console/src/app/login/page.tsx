'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { api, ApiError, setToken } from '@/lib/api';
import { t } from '@/lib/i18n';
import { useShell } from '@/components/shell';

export default function LoginPage() {
  const { locale } = useShell();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    try {
      const body =
        mode === 'login'
          ? { email: f.get('email'), password: f.get('password') }
          : { email: f.get('email'), password: f.get('password'), name: f.get('name'), teamName: f.get('teamName'), locale };
      const res = await api<{ session: string }>(`/v1/auth/${mode}`, { method: 'POST', body: JSON.stringify(body) });
      setToken(res.session);
      router.replace('/servers');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="mb-6 text-2xl font-semibold">{t(locale, mode === 'login' ? 'login' : 'signup')}</h1>
      <form onSubmit={submit} className="card space-y-3">
        {mode === 'signup' && (
          <>
            <input className="input" name="name" placeholder={t(locale, 'name')} required />
            <input className="input" name="teamName" placeholder={t(locale, 'teamName')} required />
          </>
        )}
        <input className="input" name="email" type="email" placeholder={t(locale, 'email')} required autoComplete="email" />
        <input className="input" name="password" type="password" placeholder={t(locale, 'password')} required minLength={10} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full justify-center" disabled={busy}>{t(locale, mode === 'login' ? 'login' : 'signup')}</button>
        <button type="button" className="w-full text-center text-sm text-neutral-500" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {t(locale, mode === 'login' ? 'signup' : 'login')} →
        </button>
      </form>
    </div>
  );
}
