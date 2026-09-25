'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import { getToken, setToken } from '@/lib/api';
import { getLocale, Locale, RTL, t } from '@/lib/i18n';
import { ProductMenu } from './product-menu';

interface Ctx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  authed: boolean;
  signOut: () => void;
}

const ShellCtx = createContext<Ctx>({ locale: 'en', setLocale: () => {}, authed: false, signOut: () => {} });
export const useShell = () => useContext(ShellCtx);

export function Shell({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setLocaleState(getLocale());
    setAuthed(!!getToken());
    setReady(true);
  }, [pathname]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = RTL[locale] ? 'rtl' : 'ltr';
  }, [locale]);

  useEffect(() => {
    if (ready && !authed && pathname !== '/login') router.replace('/login');
  }, [ready, authed, pathname, router]);

  const setLocale = (l: Locale) => {
    try { localStorage.setItem('pgcloud.locale', l); } catch { /* ignore */ }
    setLocaleState(l);
  };
  const signOut = () => {
    setToken(null);
    setAuthed(false);
    router.replace('/login');
  };

  const nav = [
    { href: '/servers', label: t(locale, 'servers') },
    { href: '/apps', label: t(locale, 'apps') },
    { href: '/agents', label: t(locale, 'agents') },
    { href: '/billing', label: t(locale, 'billing') },
  ];

  return (
    <ShellCtx.Provider value={{ locale, setLocale, authed, signOut }}>
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/servers" className="font-semibold tracking-tight">pgcloud</Link>
          {authed && (
            <>
              <ProductMenu label={t(locale, 'products')} />
              <nav className="hidden gap-4 text-sm sm:flex">
                {nav.map((n) => (
                  <Link key={n.href} href={n.href} className={pathname.startsWith(n.href) ? 'font-medium' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'}>
                    {n.label}
                  </Link>
                ))}
              </nav>
            </>
          )}
          <div className="ms-auto flex items-center gap-3 text-sm">
            <select className="input w-auto py-1" value={locale} onChange={(e) => setLocale(e.target.value as Locale)} aria-label="Language">
              <option value="en">EN</option>
              <option value="tr">TR</option>
              <option value="ar">AR</option>
            </select>
            {authed && <button className="btn-ghost" onClick={signOut}>{t(locale, 'signOut')}</button>}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{ready ? children : null}</main>
    </ShellCtx.Provider>
  );
}
