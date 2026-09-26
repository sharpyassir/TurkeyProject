'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useShell } from '@/components/shell';
import { StatusBadge } from '@/components/status-badge';
import { Bucket, fmtBytes } from '../page';

interface Obj { key: string; size: number; lastModified: string }
interface Listing { prefix: string; objects: Obj[]; prefixes: string[]; nextToken?: string }

/** One bucket: browse by prefix, upload through presigned URLs, download, delete, toggle public. */
export default function BucketPage() {
  const { name } = useParams<{ name: string }>();
  const router = useRouter();
  const { locale } = useShell();
  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [prefix, setPrefix] = useState('');
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [b, l] = await Promise.all([api<Bucket>(`/v1/buckets/${name}`), api<Listing>(`/v1/buckets/${name}/objects?prefix=${encodeURIComponent(prefix)}`)]);
      setBucket(b); setListing(l);
    } catch (err) { if (err instanceof ApiError && err.status === 404) router.replace('/buckets'); else setError(err instanceof ApiError ? err.message : String(err)); }
  }, [name, prefix, router]);
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setError(null);
    try { await fn(); await load(); } catch (err) { setError(err instanceof ApiError ? err.message : String(err)); } finally { setBusy(false); }
  }
  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    await run(async () => {
      for (const f of files) {
        setProgress(`Uploading ${f.name}…`);
        const { url } = await api<{ url: string }>(`/v1/buckets/${name}/presign`, { method: 'POST', body: JSON.stringify({ key: prefix + f.name, method: 'PUT', contentType: f.type || 'application/octet-stream' }) });
        const r = await fetch(url, { method: 'PUT', body: f, headers: { 'content-type': f.type || 'application/octet-stream' } });
        if (!r.ok) throw new Error(`Upload of ${f.name} failed (${r.status})`);
      }
      setProgress(null);
    });
    e.target.value = '';
  }
  const download = async (key: string) => { const { url } = await api<{ url: string }>(`/v1/buckets/${name}/presign`, { method: 'POST', body: JSON.stringify({ key }) }); window.open(url, '_blank'); };
  if (!bucket || !listing) return <p className="text-sm text-neutral-500">{error ?? 'Loading…'}</p>;
  const crumbs = prefix.split('/').filter(Boolean);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/buckets" className="text-sm text-neutral-500 hover:underline">← Object storage</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{bucket.name}</h1>
          <StatusBadge status={bucket.status} />
          <span className="text-sm text-neutral-500">{fmtBytes(bucket.sizeBytes)} in {bucket.objectCount} objects · <code>{bucket.url}</code></span>
          <label className="ms-auto flex items-center gap-2 text-sm"><input type="checkbox" checked={bucket.public} disabled={busy} onChange={(ev) => run(() => api(`/v1/buckets/${name}`, { method: 'PATCH', body: JSON.stringify({ public: ev.target.checked }) }))} /> Public read</label>
          <button className="btn-danger" disabled={busy} onClick={() => confirm(`Delete bucket ${bucket.name}? It must be empty.`) && run(() => api(`/v1/buckets/${name}`, { method: 'DELETE' }).then(() => router.replace('/buckets')))}>Delete bucket</button>
        </div>
      </div>
      {error && <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/30">{error}</p>}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button className="hover:underline" onClick={() => setPrefix('')}>{bucket.name}</button>
        {crumbs.map((c, i) => <span key={i}>/ <button className="hover:underline" onClick={() => setPrefix(crumbs.slice(0, i + 1).join('/') + '/')}>{c}</button></span>)}
        <label className="btn-primary ms-auto cursor-pointer">{progress ?? 'Upload files'}<input type="file" multiple className="hidden" onChange={upload} disabled={busy} /></label>
      </div>
      <div className="card p-0">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-neutral-500"><tr><th className="px-4 py-2 text-start">Name</th><th className="px-4 py-2 text-start">Size</th><th className="px-4 py-2 text-start">Modified</th><th /></tr></thead>
          <tbody>
            {listing.prefixes.length === 0 && listing.objects.length === 0 && <tr><td className="px-4 py-3 text-neutral-500" colSpan={4}>Empty. Upload files here, or use any S3 client with an access key.</td></tr>}
            {listing.prefixes.map((p) => <tr key={p} className="border-t border-neutral-100 dark:border-neutral-800"><td className="px-4 py-2"><button className="text-blue-600 hover:underline" onClick={() => setPrefix(p)}>{p.slice(prefix.length)}</button></td><td className="px-4 py-2 text-neutral-500">folder</td><td /><td /></tr>)}
            {listing.objects.map((o) => (
              <tr key={o.key} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-4 py-2 font-mono text-xs">{o.key.slice(prefix.length)}</td><td className="px-4 py-2">{fmtBytes(o.size)}</td><td className="px-4 py-2 text-neutral-500">{new Date(o.lastModified).toLocaleString(locale)}</td>
                <td className="px-4 py-2 text-end whitespace-nowrap"><button className="btn-ghost me-1" onClick={() => download(o.key)}>Download</button>{bucket.public && <a className="btn-ghost me-1" href={`${bucket.url}/${o.key}`} target="_blank" rel="noreferrer">Public link</a>}<button className="btn-danger" disabled={busy} onClick={() => run(() => api(`/v1/buckets/${name}/objects?key=${encodeURIComponent(o.key)}`, { method: 'DELETE' }))}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500">Console uploads go through short lived presigned URLs and are limited to what your browser can hold; for large or many files use the CLI or an S3 client.</p>
    </div>
  );
}
