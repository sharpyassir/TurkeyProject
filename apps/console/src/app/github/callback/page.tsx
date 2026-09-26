'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

/** GitHub sends the user here after installing the app: ?installation_id=…&state=…&setup_action=install */
function Callback() {
  const q = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const installationId = Number(q.get('installation_id'));
    const state = q.get('state') ?? '';
    if (!installationId || !state) { setError('This link is missing the installation id or state. Start again from Deploys.'); return; }
    api('/v1/github/installations', { method: 'POST', body: JSON.stringify({ installationId, state }) })
      .then(() => router.replace('/deploys?connected=1'))
      .catch((err) => setError(err instanceof ApiError ? err.message : String(err)));
  }, [q, router]);
  return (
    <div className="mx-auto mt-16 max-w-md">
      <h1 className="mb-4 text-2xl font-semibold">Connecting GitHub</h1>
      {error ? <div className="card space-y-3 text-sm"><p className="text-red-600">{error}</p><Link href="/deploys" className="btn-primary inline-flex">Back to Deploys</Link></div> : <p className="card text-sm text-neutral-500">Finishing the installation…</p>}
    </div>
  );
}

export default function Page() {
  return <Suspense><Callback /></Suspense>;
}
