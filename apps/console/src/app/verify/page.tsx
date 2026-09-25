'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api, ApiError, getToken } from '@/lib/api';

function Verify() {
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<'working' | 'ok' | 'error'>('working');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) { setState('error'); setMessage('This link is missing its token.'); return; }
    api('/v1/auth/verify', { method: 'POST', body: JSON.stringify({ token }) })
      .then(() => setState('ok'))
      .catch((err) => { setState('error'); setMessage(err instanceof ApiError ? err.message : String(err)); });
  }, [token]);

  if (state === 'working') return <p className="card text-sm text-neutral-500">Confirming your email…</p>;
  if (state === 'ok') return (
    <div className="card space-y-3 text-sm">
      <p>Your email is confirmed. You can create servers now.</p>
      <Link href={getToken() ? '/servers' : '/login'} className="btn-primary inline-flex">Continue</Link>
    </div>
  );
  return (
    <div className="card space-y-3 text-sm">
      <p className="text-red-600">{message}</p>
      <p>Sign in and open <Link href="/security" className="text-blue-600 hover:underline">Security</Link> to request a new link.</p>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="mb-6 text-2xl font-semibold">Email confirmation</h1>
      <Suspense><Verify /></Suspense>
    </div>
  );
}
