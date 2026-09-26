'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { api, ApiError, App, Image, money, Price, Size, withVat } from '@/lib/api';
import { t, tf } from '@/lib/i18n';
import { useShell } from '@/components/shell';

function CreateServerForm() {
  const { locale } = useShell();
  const router = useRouter();
  const params = useSearchParams();
  const [sizes, setSizes] = useState<Size[]>([]);
  const [images, setImages] = useState<Image[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [currency, setCurrency] = useState<'USD' | 'SAR'>('USD');
  const [image, setImage] = useState(params.get('app') ?? 'ubuntu-24-04');
  const [size, setSize] = useState('s-2vcpu-4gb');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [managed, setManaged] = useState(false);

  useEffect(() => {
    (async () => {
      const bal = await api<{ currency: 'USD' | 'SAR' }>('/v1/billing/balance').catch(() => ({ currency: 'USD' as const }));
      setCurrency(bal.currency);
      const [s, i, a, p] = await Promise.all([
        api<{ data: Size[] }>('/v1/sizes'),
        api<{ data: Image[] }>('/v1/images?kind=distribution'),
        api<{ data: App[] }>('/v1/apps'),
        api<{ data: Price[] }>(`/v1/pricing?currency=${bal.currency}`),
      ]);
      setSizes(s.data); setImages(i.data); setApps(a.data); setPrices(p.data);
    })();
  }, []);

  const app = useMemo(() => apps.find((a) => a.slug === image), [apps, image]);
  const priceOf = (sku: string) => prices.find((p) => p.sku === sku);
  const plan = priceOf(size)?.monthlyMinor ?? 0;
  const managedPrice = priceOf(`managed-${size}`)?.monthlyMinor ?? 0;
  const managedOffered = managedPrice > 0;
  const estimate = plan + (priceOf('public_ip')?.monthlyMinor ?? 0) + (app?.priceMonthlyMinor ?? 0) + (managed && managedOffered ? managedPrice : 0);

  useEffect(() => {
    if (app && sizes.length) {
      const min = sizes.find((s) => s.id === app.minSizeId);
      const cur = sizes.find((s) => s.id === size);
      if (min && cur && cur.memoryMb < min.memoryMb) setSize(min.id);
    }
  }, [app, sizes, size]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null);
    const f = new FormData(e.currentTarget);
    const appVariables: Record<string, string> = {};
    app?.variables.forEach((v) => { const val = f.get(`var:${v.name}`); if (val) appVariables[v.name] = String(val); });
    try {
      await api('/v1/servers', { method: 'POST', idempotent: true, body: JSON.stringify({ name: f.get('name'), size, image, managed: managed && managedOffered, ...(app ? { appVariables } : {}) }) });
      router.push('/servers');
    } catch (err) {
      setError(err instanceof ApiError ? `${err.message}${err.code === 'spend_limit_reached' || err.code === 'verification_required' ? ' — see Billing' : ''}` : String(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">{t(locale, 'create')}</h1>

      <section className="card space-y-3">
        <h2 className="text-sm font-medium text-neutral-500">{t(locale, 'image')}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {images.map((i) => <Choice key={i.id} active={image === i.id} onClick={() => setImage(i.id)} title={i.name} />)}
        </div>
        <h2 className="pt-2 text-sm font-medium text-neutral-500">{t(locale, 'oneClick')}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {apps.map((a) => <Choice key={a.slug} active={image === a.slug} onClick={() => setImage(a.slug)} title={a.name} sub={a.category} />)}
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-sm font-medium text-neutral-500">{t(locale, 'size')}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {sizes.map((s) => {
            const p = priceOf(s.id);
            const tooSmall = !!app && (sizes.find((x) => x.id === app.minSizeId)?.memoryMb ?? 0) > s.memoryMb;
            return (
              <Choice key={s.id} active={size === s.id} disabled={tooSmall} onClick={() => setSize(s.id)}
                title={`${s.name ? `${s.name}: ` : ''}${s.vcpu} vCPU · ${s.memoryMb / 1024} GB · ${s.diskGb} GB NVMe`}
                sub={p ? `${money(p.monthlyMinor, currency, locale)}${t(locale, 'perMonth')} · ${money(p.hourlyMinor, currency, locale)}${t(locale, 'perHour')}` : s.id} />
            );
          })}
        </div>
      </section>

      <section className="card space-y-3">
        <label className="block text-sm">
          <span className="text-neutral-500">{t(locale, 'name')}</span>
          <input className="input mt-1" name="name" required pattern="[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?" defaultValue={app ? `${app.slug}-1` : 'web-1'} />
        </label>
        {app?.variables.map((v) => (
          <label key={v.name} className="block text-sm">
            <span className="text-neutral-500">{v.label}{v.required ? ' *' : ''}</span>
            <input className="input mt-1" name={`var:${v.name}`} type={v.type === 'password' ? 'password' : v.type === 'email' ? 'email' : 'text'} required={!!v.required && !v.generate} defaultValue={v.default ?? ''} placeholder={v.generate ? '(auto-generated)' : ''} />
          </label>
        ))}
      </section>

      <section className="card space-y-2">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1" checked={managed && managedOffered} disabled={!managedOffered} onChange={(e) => setManaged(e.target.checked)} />
          <span>
            <span className="font-medium">{t(locale, 'managedTier')}</span>
            <span className="block text-neutral-500">{managedOffered ? tf(locale, 'managedNote')(`${money(plan + managedPrice, currency, locale)}${t(locale, 'perMonth')}`) : t(locale, 'managedNotOnPlan')}</span>
          </span>
        </label>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-4">
        <button className="btn-primary" disabled={busy}>{busy ? t(locale, 'creating') : t(locale, 'deploy')}</button>
        <span className="text-sm text-neutral-500">≈ {money(estimate, currency, locale)}{t(locale, 'perMonth')} <span className="text-neutral-400">· {money(withVat(estimate), currency, locale)} {t(locale, 'inclVat')}</span></span>
      </div>
    </form>
  );
}

function Choice({ active, disabled, onClick, title, sub }: { active: boolean; disabled?: boolean; onClick: () => void; title: string; sub?: string }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={`rounded-md border p-3 text-start text-sm transition disabled:opacity-40 ${active ? 'border-blue-600 ring-1 ring-blue-600' : 'border-neutral-200 hover:border-neutral-400 dark:border-neutral-700'}`}>
      <div className="font-medium">{title}</div>
      {sub && <div className="text-xs text-neutral-500">{sub}</div>}
    </button>
  );
}

export default function NewServerPage() {
  return <Suspense><CreateServerForm /></Suspense>;
}
