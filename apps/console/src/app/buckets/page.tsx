'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError, money, Price } from '@/lib/api';
import { useShell } from '@/components/shell';
import { StatusBadge } from '@/components/status-badge';
import { fmtBytes } from '@/lib/format';

export interface Bucket { id: string; name: string; status: string; statusMessage: string | null; regionId: string; public: boolean; sizeBytes: number; objectCount: number; usageUpdatedAt: string | null; endpoint: string; url: string; createdAt: string }
interface Key { id: string; name: string; accessKey: string; createdAt: string; lastUsedAt: string | null }
interface NewKey extends Key { secretKey: string; endpoint: string; region: string }


/** Object storage: S3 compatible buckets and access keys. */
export default function BucketsPage() {
  const { locale } = useShell();
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [keys, setKeys] = useState<Key[]>([]);
  const [meta, setMeta] = useState<{ endpoint: string; region: string }>({ endpoint: '', region: '' });
  const [created, setCreated] = useState<NewKey | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [currency, setCurrency] = useState<'USD' | 'SAR'>('USD');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [b, k] = await Promise.all([api<{ data: Bucket[]; endpoint: string; region: string }>('/v1/buckets'), api<{ data: Key[] }>('/v1/storage-keys')]);
    setBuckets(b.data); setKeys(k.data); setMeta({ endpoint: b.endpoint, region: b.region });
  }, []);
  useEffect(() => {
    load();
    api<{ currency: 'USD' | 'SAR' }>('/v1/billing/balance').then(async (b) => { setCurrency(b.currency); setPrices((await api<{ data: Price[] }>(`/v1/pricing?currency=${b.currency}`)).data); }).catch(() => undefined);
  }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setError(null);
    try { await fn(); await load(); } catch (err) { setError(err instanceof ApiError ? err.message : String(err)); } finally { setBusy(false); }
  }
  const createBucket = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); const form = e.currentTarget; run(() => api('/v1/buckets', { method: 'POST', body: JSON.stringify({ name: String(f.get('name')).trim(), public: f.get('public') === 'on' }) }).then(() => form.reset())); };
  const createKey = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); const form = e.currentTarget; run(() => api<NewKey>('/v1/storage-keys', { method: 'POST', body: JSON.stringify({ name: String(f.get('kname')).trim() }) }).then((k) => { setCreated(k); form.reset(); })); };
  const perGb = prices.find((p) => p.sku === 'storage_gb')?.monthlyMinor ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Object storage</h1>
        <p className="text-sm text-neutral-500">S3 compatible buckets on our Ceph cluster. Any S3 client works: endpoint <code>{meta.endpoint}</code>, region <code>{meta.region}</code>. {money(perGb, currency, locale)} per GB per month, measured every ten minutes.</p>
      </div>
      {error && <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/30">{error}</p>}

      <div className="card p-0">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-neutral-500"><tr><th className="px-4 py-2 text-start">Bucket</th><th className="px-4 py-2 text-start">Status</th><th className="px-4 py-2 text-start">Access</th><th className="px-4 py-2 text-start">Size</th><th className="px-4 py-2 text-start">Objects</th><th className="px-4 py-2 text-start">Created</th></tr></thead>
          <tbody>
            {buckets.length === 0 && <tr><td className="px-4 py-3 text-neutral-500" colSpan={6}>No buckets yet.</td></tr>}
            {buckets.map((b) => (
              <tr key={b.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-4 py-2 font-medium"><Link href={`/buckets/${b.name}`} className="text-blue-600 hover:underline">{b.name}</Link></td>
                <td className="px-4 py-2"><StatusBadge status={b.status} /></td>
                <td className="px-4 py-2">{b.public ? <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">public read</span> : 'private'}</td>
                <td className="px-4 py-2">{fmtBytes(b.sizeBytes)}</td><td className="px-4 py-2">{b.objectCount}</td>
                <td className="px-4 py-2 text-neutral-500">{new Date(b.createdAt).toLocaleDateString(locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form onSubmit={createBucket} className="card flex flex-wrap items-center gap-3">
        <h2 className="font-medium">New bucket</h2>
        <input className="input" style={{ width: '18rem' }} name="name" placeholder="Name, globally unique, for example acme-assets" pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?" minLength={3} maxLength={63} required />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="public" /> Public read</label>
        <button className="btn-primary" disabled={busy}>Create bucket</button>
      </form>

      <section className="card space-y-3">
        <h2 className="font-medium">Access keys</h2>
        <p className="text-sm text-neutral-500">Keys work for every bucket in the project. The secret is shown once.</p>
        {created && (
          <div className="rounded border border-green-200 bg-green-50 p-3 text-sm dark:bg-green-950/30">
            <div className="font-medium">Key &quot;{created.name}&quot; created. Copy the secret now.</div>
            <pre className="mt-2 overflow-auto text-xs">{`AWS_ACCESS_KEY_ID=${created.accessKey}\nAWS_SECRET_ACCESS_KEY=${created.secretKey}\nAWS_ENDPOINT_URL=${created.endpoint}\nAWS_DEFAULT_REGION=${created.region}`}</pre>
            <button className="btn-ghost mt-2" onClick={() => setCreated(null)}>Done</button>
          </div>
        )}
        {keys.length > 0 && (
          <table className="w-full text-sm"><tbody>
            {keys.map((k) => <tr key={k.id} className="border-t border-neutral-100 first:border-0 dark:border-neutral-800"><td className="py-2 font-medium">{k.name}</td><td className="py-2 font-mono text-xs">{k.accessKey}</td><td className="py-2 text-xs text-neutral-500">{new Date(k.createdAt).toLocaleDateString(locale)}</td><td className="py-2 text-end"><button className="btn-danger" disabled={busy} onClick={() => confirm(`Revoke key ${k.name}? Clients using it stop working at once.`) && run(() => api(`/v1/storage-keys/${k.id}`, { method: 'DELETE' }))}>Revoke</button></td></tr>)}
          </tbody></table>
        )}
        <form onSubmit={createKey} className="flex flex-wrap items-center gap-2">
          <input className="input" style={{ width: '16rem' }} name="kname" placeholder="Key name, for example ci" required />
          <button className="btn-primary" disabled={busy}>Create key</button>
        </form>
      </section>
    </div>
  );
}
