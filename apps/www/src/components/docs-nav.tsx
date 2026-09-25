'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export function DocsNav({ groups }: { groups: { section: string; items: { slug: string; title: string }[] }[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const list = (
    <nav className="space-y-6 text-sm">
      {groups.map((g) => (
        <div key={g.section}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{g.section}</div>
          <ul className="space-y-1">
            {g.items.map((d) => {
              const href = `/docs/${d.slug}`;
              const active = pathname === href;
              return <li key={d.slug}><Link href={href} onClick={() => setOpen(false)} className={`block rounded px-2 py-1 ${active ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>{d.title}</Link></li>;
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
  return (
    <aside>
      <button className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-left text-sm md:hidden" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'} all pages</button>
      <div className={`${open ? 'block' : 'hidden'} md:sticky md:top-20 md:block`}>{list}</div>
    </aside>
  );
}
