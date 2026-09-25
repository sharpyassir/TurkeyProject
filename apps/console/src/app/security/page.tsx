'use client';

import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

interface Me { user: { email: string; totpEnabled: boolean; emailVerified: boolean }; role: string }

function SecurityPage() {
  const welcome = useSearchParams().get('welcome') === '1';
  const [me, setMe] = useState<Me | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(() => api<Me>('/v1/account').then(setMe), []);
  useEffect(() => { load(); }, [load]);

  async function call<T>(fn: () => Promise<T>) {
    setError(null); setNotice(null);
    try { return await fn(); } catch (err) { setError(err instanceof ApiError ? err.message : String(err)); }
  }

  async function enable(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = new FormData(e.currentTarget).get('code');
    const res = await call(() => api<{ recoveryCodes: string[] }>('/v1/auth/totp/enable', { method: 'POST', body: JSON.stringify({ code }) }));
    if (res) { setRecovery(res.recoveryCodes); setSetup(null); load(); }
  }

  async function disable(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = new FormData(e.currentTarget).get('code');
    if (await call(() => api('/v1/auth/totp/disable', { method: 'POST', body: JSON.stringify({ code }) }))) { setNotice('Two factor sign in is off.'); load(); }
  }

  if (!me) return <p className="text-sm text-neutral-500">Loading…</p>;
  const qr = setup ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(setup.otpauthUrl)}` : null;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Security</h1>
      {welcome && <div className="card border-blue-200 bg-blue-50 text-sm dark:bg-blue-950/30">Welcome. Confirm your email from the message we just sent, and set up two factor sign in below to protect your account.</div>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-green-700">{notice}</p>}

      <section className="card space-y-2">
        <h2 className="font-medium">Email</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{me.user.email} {me.user.emailVerified ? <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">confirmed</span> : <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">not confirmed</span>}</p>
        {!me.user.emailVerified && (
          <div className="text-sm">
            <p className="mb-2 text-neutral-500">You need a confirmed email before you can create servers.</p>
            <button className="btn-ghost" onClick={() => call(() => api('/v1/auth/verify/request', { method: 'POST' })).then(() => setNotice('We sent you a new confirmation link.'))}>Send the link again</button>
          </div>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-medium">Two factor sign in</h2>
        {me.user.totpEnabled ? (
          <>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">On. Sign in asks for a code from your authenticator app.</p>
            <form onSubmit={disable} className="flex gap-2">
              <input className="input max-w-[12rem]" name="code" inputMode="numeric" placeholder="Code to turn off" required autoComplete="one-time-code" />
              <button className="btn-danger">Turn off</button>
            </form>
          </>
        ) : setup ? (
          <div className="space-y-3 text-sm">
            <p>1. Scan this code with Google Authenticator, 1Password, Authy or any TOTP app.</p>
            <div className="flex flex-wrap items-start gap-4">
              {qr && <img src={qr} alt="QR code for your authenticator app" width={180} height={180} className="rounded bg-white p-1" />}
              <div className="space-y-1">
                <p className="text-neutral-500">Or type the key by hand:</p>
                <code className="block break-all rounded bg-neutral-100 p-2 font-mono text-xs dark:bg-neutral-800">{setup.secret}</code>
              </div>
            </div>
            <p>2. Enter the six digit code the app shows to confirm.</p>
            <form onSubmit={enable} className="flex gap-2">
              <input className="input max-w-[12rem]" name="code" inputMode="numeric" placeholder="123456" required autoFocus autoComplete="one-time-code" />
              <button className="btn-primary">Confirm</button>
            </form>
          </div>
        ) : (
          <>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">Off. {me.role === 'owner' ? 'Team owners are required to turn this on.' : 'We recommend turning this on.'}</p>
            <button className="btn-primary" onClick={() => call(() => api<{ secret: string; otpauthUrl: string }>('/v1/auth/totp/setup', { method: 'POST' })).then((r) => r && setSetup(r))}>Set up</button>
          </>
        )}
        {recovery && (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
            <p className="mb-2 font-medium">Save these recovery codes now. They are shown only once. Each one signs you in a single time if you lose your device.</p>
            <pre className="grid grid-cols-2 gap-x-6 font-mono text-xs">{recovery.join('\n')}</pre>
          </div>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="font-medium">API rate limits</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">Each token or session may make 600 requests per minute. Sign in attempts are limited to 10 per minute per address. Responses over the limit return status 429 with a Retry-After header.</p>
      </section>
    </div>
  );
}

export default function Page() {
  return <Suspense><SecurityPage /></Suspense>;
}
