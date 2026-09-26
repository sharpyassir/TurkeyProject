'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { t } from '@/lib/i18n';
import { useShell } from '@/components/shell';

function ResetForm() {
  const { locale } = useShell();
  const token = useSearchParams().get('token') ?? '';
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    if (f.get('password') !== f.get('confirm')) return setError(t(locale, 'passwordsDiffer'));
    try {
      await api('/v1/auth/password/reset', { method: 'POST', body: JSON.stringify({ token, password: f.get('password') }) });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  if (!token) return <p className="card text-sm">{t(locale, 'missingToken')} <Link href="/forgot-password" className="text-blue-600 hover:underline">{t(locale, 'requestNew')}</Link>.</p>;
  if (done) return <div className="card space-y-3 text-sm"><p>{t(locale, 'passwordChanged')}</p><Link href="/login" className="btn-primary inline-flex">{t(locale, 'login')}</Link></div>;
  return (
    <form onSubmit={submit} className="card space-y-3">
      <input className="input" name="password" type="password" placeholder={t(locale, 'newPassword')} required minLength={10} autoComplete="new-password" />
      <input className="input" name="confirm" type="password" placeholder={t(locale, 'repeatPassword')} required minLength={10} autoComplete="new-password" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full justify-center">{t(locale, 'changePassword')}</button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const { locale } = useShell();
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="mb-6 text-2xl font-semibold">{t(locale, 'newPasswordTitle')}</h1>
      <Suspense><ResetForm /></Suspense>
    </div>
  );
}
