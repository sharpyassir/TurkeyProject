'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { api, ApiError } from '@/lib/api';

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    if (f.get('password') !== f.get('confirm')) return setError('The two passwords do not match.');
    try {
      await api('/v1/auth/password/reset', { method: 'POST', body: JSON.stringify({ token, password: f.get('password') }) });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  if (!token) return <p className="card text-sm">This link is missing its token. Open the link from the email again or <Link href="/forgot-password" className="text-blue-600 hover:underline">request a new one</Link>.</p>;
  if (done) return <div className="card space-y-3 text-sm"><p>Your password has been changed.</p><Link href="/login" className="btn-primary inline-flex">Sign in</Link></div>;
  return (
    <form onSubmit={submit} className="card space-y-3">
      <input className="input" name="password" type="password" placeholder="New password (10 characters or more)" required minLength={10} autoComplete="new-password" />
      <input className="input" name="confirm" type="password" placeholder="Repeat the new password" required minLength={10} autoComplete="new-password" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full justify-center">Change password</button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="mb-6 text-2xl font-semibold">Choose a new password</h1>
      <Suspense><ResetForm /></Suspense>
    </div>
  );
}
