'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PRODUCTS, phaseLabel } from '@/lib/products';
import { t } from '@/lib/i18n';
import { useShell } from '@/components/shell';

/** Roadmap product page: what it is, which phase, and a one-click "notify me" that feeds prioritisation. */
export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const { locale } = useShell();
  const router = useRouter();
  const product = PRODUCTS.find((p) => p.slug === slug);
  const [done, setDone] = useState(false);

  useEffect(() => { if (product?.href) router.replace(product.href); }, [product, router]);
  if (!product) return <p className="text-neutral-500">Unknown product.</p>;

  async function interest() {
    await api('/v1/interest', { method: 'POST', body: JSON.stringify({ product: product!.slug }) });
    setDone(true);
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">{product.group} · {product.phase ? phaseLabel(product.phase) : ''}</div>
      <h1 className="text-2xl font-semibold">{product.name}</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">{product.blurb}</p>
      <div className="card mt-6 flex items-center gap-4">
        <span className="badge bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">{t(locale, 'comingSoon')}</span>
        {done ? <span className="text-sm">{t(locale, 'interested')}</span> : <button className="btn-primary" onClick={interest}>{t(locale, 'interest')}</button>}
      </div>
    </div>
  );
}
