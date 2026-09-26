'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { GROUPS, Group, PRODUCTS, phaseLabel } from '@/lib/products';
import { groupLabel, t } from '@/lib/i18n';
import { useShell } from '@/components/shell';

const GROUP_HOME: Partial<Record<Group, string>> = {
  Projects: '/projects', 'Managed Agents': '/agents', 'Core Cloud': '/servers', Marketplace: '/apps', Security: '/firewalls',
};

function GroupList({ group, onNavigate }: { group: Group; onNavigate?: () => void }) {
  return (
    <ul className="space-y-0.5">
      {PRODUCTS.filter((p) => p.group === group).map((p) => (
        <li key={p.slug}>
          <Link href={p.href ?? `/products/${p.slug}`} role="menuitem" onClick={onNavigate}
            className={`flex items-center justify-between gap-3 rounded px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 ${p.href ? '' : 'text-neutral-500'}`}>
            <span>{p.name}</span>
            {p.phase && <span className="badge bg-neutral-100 text-neutral-500 dark:bg-neutral-800">{phaseLabel(p.phase)}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Desktop: the seven product groups as top-level items, each with a dropdown. */
export function DesktopNav() {
  const { locale } = useShell();
  const [open, setOpen] = useState<Group | null>(null);
  const pathname = usePathname();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => setOpen(null), [pathname]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(null); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const activeGroup = PRODUCTS.find((p) => p.href && pathname.startsWith(p.href.split('?')[0]))?.group;

  return (
    <nav ref={ref} className="hidden items-center gap-1 lg:flex" aria-label="Products">
      {GROUPS.map((g) => (
        <div key={g} className="relative">
          <button
            className={`rounded px-2.5 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 ${activeGroup === g ? 'font-medium' : 'text-neutral-600 dark:text-neutral-300'}`}
            aria-haspopup="menu" aria-expanded={open === g}
            onClick={() => setOpen(open === g ? null : g)}
            onMouseEnter={() => open && setOpen(g)}>
            {groupLabel(locale, g)}
          </button>
          {open === g && (
            <div role="menu" className="absolute start-0 z-20 mt-1 w-72 rounded-lg border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
              <GroupList group={g} />
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}

/** Mobile: hamburger → full-height "Menu" sheet with each group as an expandable row (DigitalOcean-style). */
export function MobileNav({ extra }: { extra?: React.ReactNode }) {
  const { locale } = useShell();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Group | null>(null);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="lg:hidden">
      <button className="btn-ghost px-2" aria-label={t(locale, 'menu')} aria-expanded={open} onClick={() => setOpen(true)}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 5h14M3 10h14M3 15h14" /></svg>
      </button>
      {open && (
        <div className="fixed inset-0 z-30 flex flex-col bg-white dark:bg-neutral-950" role="dialog" aria-modal="true">
          <div className="flex items-center border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <span className="mx-auto text-lg font-semibold">{t(locale, 'menu')}</span>
            <button className="absolute end-4 text-2xl leading-none text-neutral-500" aria-label="Close" onClick={() => setOpen(false)}>×</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {GROUPS.map((g) => (
              <div key={g} className="border-b border-neutral-100 dark:border-neutral-800">
                <button className="flex w-full items-center justify-between px-5 py-4 text-start text-lg" aria-expanded={expanded === g} onClick={() => setExpanded(expanded === g ? null : g)}>
                  <span>{groupLabel(locale, g)}</span>
                  <span className={`text-neutral-400 transition ${expanded === g ? 'rotate-90' : ''}`} aria-hidden>›</span>
                </button>
                {expanded === g && (
                  <div className="px-4 pb-3">
                    {GROUP_HOME[g] && <Link href={GROUP_HOME[g]!} onClick={() => setOpen(false)} className="mb-1 block px-2 text-xs font-medium uppercase tracking-wider text-blue-600">{groupLabel(locale, g)} →</Link>}
                    <GroupList group={g} onNavigate={() => setOpen(false)} />
                  </div>
                )}
              </div>
            ))}
            {extra && <div className="px-5 py-4">{extra}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
