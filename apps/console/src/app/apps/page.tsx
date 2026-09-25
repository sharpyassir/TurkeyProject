'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, App } from '@/lib/api';
import { t } from '@/lib/i18n';
import { useShell } from '@/components/shell';

export default function AppsPage() {
  const { locale } = useShell();
  const [apps, setApps] = useState<App[]>([]);
  useEffect(() => { api<{ data: App[] }>('/v1/apps').then((r) => setApps(r.data)); }, []);

  const categories = [...new Set(apps.map((a) => a.category))];
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">{t(locale, 'apps')}</h1>
      {categories.map((c) => (
        <section key={c} className="mb-6">
          <h2 className="mb-2 text-xs font-medium uppercase text-neutral-500">{c}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {apps.filter((a) => a.category === c).map((a) => (
              <div key={a.slug} className="card flex flex-col">
                <div className="font-medium">{a.name} <span className="text-xs text-neutral-500">{a.version}</span></div>
                <p className="mt-1 flex-1 text-sm text-neutral-600 dark:text-neutral-400">{a.summary}</p>
                <div className="mt-3 flex items-center text-xs text-neutral-500">
                  <span>≥ {a.minSizeId}</span>
                  <Link href={`/servers/new?app=${a.slug}`} className="btn-primary ms-auto">{t(locale, 'deploy')}</Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
