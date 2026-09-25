'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { GROUPS, PRODUCTS, phaseLabel } from '@/lib/products';

/** DigitalOcean-style grouped product menu: everything we sell or plan, in one place. */
export function ProductMenu({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button className="btn-ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        {label} <span aria-hidden>▾</span>
      </button>
      {open && (
        <div role="menu" className="absolute start-0 z-20 mt-2 w-[min(92vw,56rem)] rounded-lg border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {GROUPS.map((g) => (
              <div key={g}>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{g}</div>
                <ul className="space-y-0.5">
                  {PRODUCTS.filter((p) => p.group === g).map((p) => (
                    <li key={p.slug}>
                      <Link href={p.href ?? `/products/${p.slug}`} role="menuitem"
                        className={`flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 ${p.href ? '' : 'text-neutral-500'}`}>
                        <span>{p.name}</span>
                        {p.phase && <span className="badge bg-neutral-100 text-neutral-500 dark:bg-neutral-800">{phaseLabel(p.phase)}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
