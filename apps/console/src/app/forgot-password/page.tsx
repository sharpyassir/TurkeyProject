'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { t } from '@/lib/i18n';
import { useShell } from '@/components/shell';

export default function ForgotPasswordPage() {
  const { locale } = useShell();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const email = new FormData(e.currentTarget).get('email');
    try {
      await api('/v1/auth/password/forgot', { method: 'POST', body: JSON.stringify({ email }) });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="mb-2 text-2xl font-semibold">{t(locale, 'resetTitle')}</h1>
      <p className="mb-6 text-sm text-neutral-500">{t(locale, 'resetLead')}</p>
      {sent ? (
        <div className="card space-y-3 text-sm">
          <p>{t(locale, 'resetSent')}</p>
          <Link href="/login" className="text-blue-600 hover:underline">{t(locale, 'backToSignIn')}</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="card space-y-3">
          <input className="input" name="email" type="email" placeholder={t(locale, 'email')} required autoComplete="email" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full justify-center">{t(locale, 'sendResetLink')}</button>
          <Link href="/login" className="block text-center text-sm text-neutral-500">{t(locale, 'backToSignIn')}</Link>
        </form>
      )}
    </div>
  );
}
