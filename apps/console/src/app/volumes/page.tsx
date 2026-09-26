'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError, money, Price, Server, Volume } from '@/lib/api';
import { t, tf } from '@/lib/i18n';
import { useShell } from '@/components/shell';
import { StatusBadge } from '@/components/status-badge';

const SETTLED = ['available', 'attached', 'failed'];

/** Volumes: create, attach to a server, grow, detach and delete block storage. */
export default function VolumesPage() {
  const { locale } = useShell();
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [currency, setCurrency] = useState<'USD' | 'SAR'>('USD');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [growing, setGrowing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [v, s] = await Promise.all([api<{ data: Volume[] }>('/v1/volumes'), api<{ data: Server[] }>('/v1/servers')]);
    setVolumes(v.data); setServers(s.data.filter((x) => ['active', 'off'].includes(x.status)));
  }, []);
  useEffect(() => {
    load();
    api<{ currency: 'USD' | 'SAR' }>('/v1/billing/balance').then(async (b) => { setCurrency(b.currency); setPrices((await api<{ data: Price[] }>(`/v1/pricing?currency=${b.currency}`)).data); }).catch(() => undefined);
  }, [load]);
  useEffect(() => {
    if (!volumes.some((v) => !SETTLED.includes(v.status))) return;
    const h = setInterval(load, 2000);
    return () => clearInterval(h);
  }, [volumes, load]);

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true); setError(null); setNotice(null);
    try { await fn(); if (ok) setNotice(ok); await load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : String(err)); }
    finally { setBusy(false); }
  }
  const call = (path: string, body?: unknown) => api(path, { method: 'POST', idempotent: true, body: JSON.stringify(body ?? {}) });

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const form = e.currentTarget;
    const body: Record<string, unknown> = { name: f.get('name'), sizeGb: Number(f.get('sizeGb')) };
    if (f.get('serverId')) body.serverId = f.get('serverId');
    await run(() => call('/v1/volumes', body).then(() => form.reset()), t(locale, 'volumeCreated'));
  }

  const perGb = prices.find((p) => p.sku === 'volume_gb')?.monthlyMinor ?? 0;
  const serverName = (v: Volume) => v.server?.name ?? servers.find((s) => s.id === v.serverId)?.name ?? v.serverId;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t(locale, 'volumes')}</h1>
        <p className="text-sm text-neutral-500">{tf(locale, 'volumeNote')(money(perGb, currency, locale))}</p>
      </div>
      {error && <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/30">{error}</p>}
      {notice && <p className="rounded border border-green-200 bg-green-50 p-2 text-sm text-green-700 dark:bg-green-950/30">{notice}</p>}

      <div className="card p-0">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-neutral-500"><tr><th className="px-4 py-2 text-start">{t(locale, 'name')}</th><th className="px-4 py-2 text-start">{t(locale, 'status')}</th><th className="px-4 py-2 text-start">GB</th><th className="px-4 py-2 text-start">{t(locale, 'attachedTo')}</th><th className="px-4 py-2 text-start">{t(locale, 'device')}</th><th /></tr></thead>
          <tbody>
            {volumes.length === 0 && <tr><td className="px-4 py-3 text-neutral-500" colSpan={6}>{t(locale, 'noVolumes')}</td></tr>}
            {volumes.map((v) => (
              <tr key={v.id} className="border-t border-neutral-100 align-top dark:border-neutral-800">
                <td className="px-4 py-2 font-medium">{v.name}<div className="text-xs font-normal text-neutral-500">{money(perGb * v.sizeGb, currency, locale)}{t(locale, 'perMonth')}</div></td>
                <td className="px-4 py-2"><StatusBadge status={v.status} />{v.statusMessage && <div className="mt-1 max-w-[16rem] text-xs text-red-600">{v.statusMessage}</div>}</td>
                <td className="px-4 py-2">{v.sizeGb}</td>
                <td className="px-4 py-2">{v.serverId ? <Link href={`/servers/${v.serverId}`} className="text-blue-600 hover:underline">{serverName(v)}</Link> : <span className="text-neutral-400">—</span>}</td>
                <td className="px-4 py-2 font-mono text-xs text-neutral-500">{v.device ?? ''}</td>
                <td className="px-4 py-2 text-end whitespace-nowrap">
                  {v.status === 'available' && servers.length > 0 && (
                    <form className="inline-flex gap-1" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const sid = String(new FormData(e.currentTarget).get('serverId')); run(() => call(`/v1/volumes/${v.id}/attach`, { serverId: sid })); }}>
                      <select name="serverId" className="input py-1 text-xs">{servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                      <button className="btn-ghost" disabled={busy}>{t(locale, 'attach')}</button>
                    </form>
                  )}
                  {v.status === 'attached' && <button className="btn-ghost me-1" disabled={busy} title={t(locale, 'detachNote')} onClick={() => run(() => call(`/v1/volumes/${v.id}/detach`))}>{t(locale, 'detach')}</button>}
                  {(v.status === 'available' || v.status === 'attached') && (growing === v.id ? (
                    <form className="inline-flex gap-1" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const gb = Number(new FormData(e.currentTarget).get('sizeGb')); setGrowing(null); run(() => call(`/v1/volumes/${v.id}/resize`, { sizeGb: gb })); }}>
                      <input name="sizeGb" type="number" min={v.sizeGb + 1} max={16384} defaultValue={v.sizeGb * 2} className="input w-24 py-1 text-xs" aria-label={t(locale, 'growTo')} />
                      <button className="btn-primary" disabled={busy}>{t(locale, 'grow')}</button>
                    </form>
                  ) : <button className="btn-ghost me-1" disabled={busy} onClick={() => setGrowing(v.id)}>{t(locale, 'grow')}</button>)}
                  {(v.status === 'available' || v.status === 'failed') && <button className="btn-danger" disabled={busy} onClick={() => confirm(t(locale, 'deleteVolumeConfirm')) && run(() => api(`/v1/volumes/${v.id}`, { method: 'DELETE' }))}>{t(locale, 'delete')}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={create} className="card space-y-3">
        <h2 className="font-medium">{t(locale, 'newVolume')}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <input className="input" name="name" placeholder={t(locale, 'volumeName')} pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?" maxLength={64} required />
          <input className="input" name="sizeGb" type="number" min={10} max={16384} defaultValue={100} placeholder={t(locale, 'sizeGb')} required />
          <select className="input" name="serverId" defaultValue=""><option value="">{t(locale, 'attachedTo')}: —</option>{servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </div>
        <button className="btn-primary" disabled={busy}>{t(locale, 'createVolume')}</button>
      </form>
    </div>
  );
}
