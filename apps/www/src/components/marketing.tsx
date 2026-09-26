'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { COPY, LANGS, type Copy, type Lang } from '@/lib/copy';

const LangCtx = createContext<Lang>('en');
export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const dir = LANGS.find((l) => l.code === lang)?.dir ?? 'ltr';
  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = dir; }, [lang, dir]);
  return <LangCtx.Provider value={lang}><div dir={dir}>{children}</div></LangCtx.Provider>;
}
function useCopy(): Copy { return COPY[useContext(LangCtx)]; }
function useLang(): Lang { return useContext(LangCtx); }

const CONSOLE = process.env.NEXT_PUBLIC_CONSOLE_URL ?? 'http://localhost:3000';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/* ───────────────────────── Header ───────────────────────── */

export function Header() {
  const [open, setOpen] = useState(false);
  const c = useCopy(); const lang = useLang();
  const links = [
    ['#products', c.nav.products], ['#agents', c.nav.agents], ['#pricing', c.nav.pricing], ['#marketplace', c.nav.marketplace], ['/docs', c.nav.docs],
  ];
  const langs = <span className="flex gap-1 text-xs">{LANGS.map((l) => <a key={l.code} href={l.path} className={`rounded px-1.5 py-0.5 ${l.code === lang ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'}`}>{l.label}</a>)}</span>;
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b1220]/80 text-white backdrop-blur">
      <div className="container-x flex h-16 items-center gap-8">
        <a href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight"><Logo /> pgcloud</a>
        <nav className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
          {links.map(([h, l]) => <a key={h} href={h} className="hover:text-white">{l}</a>)}
        </nav>
        <div className="ms-auto hidden items-center gap-3 md:flex">
          {langs}
          <a href={`${CONSOLE}/login`} className="text-sm text-slate-300 hover:text-white">{c.nav.signIn}</a>
          <a href={`${CONSOLE}/login`} className="btn-primary py-2">{c.nav.startFree}</a>
        </div>
        <button className="ms-auto md:hidden" aria-label={c.nav.menu} onClick={() => setOpen(!open)}>☰</button>
      </div>
      {open && (
        <div className="border-t border-white/10 px-5 py-4 md:hidden">
          {links.map(([h, l]) => <a key={h} href={h} className="block py-2 text-slate-200" onClick={() => setOpen(false)}>{l}</a>)}
          <div className="py-2">{langs}</div>
          <a href={`${CONSOLE}/login`} className="btn-primary mt-3 w-full">{c.nav.startFree}</a>
        </div>
      )}
    </header>
  );
}

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
      <defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#60a5fa" /><stop offset="1" stopColor="#2563eb" /></linearGradient></defs>
      <rect x="1" y="1" width="24" height="24" rx="7" fill="url(#g)" />
      <path d="M8 17V9h4.5a3 3 0 0 1 0 6H10" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17.5" cy="16.5" r="1.6" fill="#fff" />
    </svg>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

export function Hero() {
  const c = useCopy();
  return (
    <section className="hero-bg relative overflow-hidden text-white">
      <div className="grid-bg absolute inset-0" aria-hidden />
      <div className="container-x relative grid items-center gap-12 py-20 sm:py-28 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {c.hero.badge}
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            {c.hero.h1a}<span className="bg-gradient-to-r from-sky-300 to-blue-400 bg-clip-text text-transparent">{c.hero.h1b}</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-slate-300">
            {c.hero.lead}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={`${CONSOLE}/login`} className="btn-primary">{c.hero.ctaPrimary}</a>
            <a href="#agents" className="btn-light">{c.hero.ctaSecondary}</a>
          </div>
          <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-white/10 pt-6 text-sm">
            {c.hero.stats.map(([v, l]) => (
              <div key={l}><dt className="text-2xl font-bold">{v}</dt><dd className="text-slate-400">{l}</dd></div>
            ))}
          </dl>
        </div>
        <Terminal />
      </div>
    </section>
  );
}

function Terminal() {
  const c = useCopy();
  const [step, setStep] = useState(0);
  useEffect(() => { const id = setInterval(() => setStep((s) => (s + 1) % 5), 1400); return () => clearInterval(id); }, []);
  const status = ['new', 'provisioning', 'provisioning', 'active', 'active'][step];
  return (
    <div className="code relative">
      <div className="mb-3 flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-red-400/80" /><i className="h-2.5 w-2.5 rounded-full bg-amber-300/80" /><i className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" /></div>
      <div><span className="c">$</span> <span className="k">pgcloud</span> servers create <span className="p">--name</span> web-1 <span className="p">--size</span> s-2vcpu-4gb <span className="p">--image</span> wordpress</div>
      <div className="c mt-1">202 Accepted. id srv_9f1c, region tr1</div>
      <div className="mt-3"><span className="c">$</span> <span className="k">pgcloud</span> servers get srv_9f1c <span className="p">--watch</span></div>
      <div className="mt-1">status: <span className={status === 'active' ? 's' : 'p'}>{status}</span>{step >= 1 && <span className="c">  ip: 185.0.113.42</span>}</div>
      {step >= 3 && <div className="s mt-1">{c.terminal.ready}</div>}
      <div className="c mt-4">{c.terminal.orAgent}</div>
      <div><span className="c">$</span> claude mcp add pgcloud <span className="p">--token</span> pgc_… <span className="c">{c.terminal.capNote}</span></div>
    </div>
  );
}

/* ───────────────────────── Trust strip ───────────────────────── */

export function TrustStrip() {
  const items = useCopy().trust;
  return (
    <section className="border-b border-slate-200 bg-slate-50">
      <div className="container-x grid gap-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([i, t, s]) => (
          <div key={t} className="flex gap-3"><span className="text-2xl">{i}</span><div><div className="font-semibold">{t}</div><div className="text-sm text-slate-600">{s}</div></div></div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── Products ───────────────────────── */


export function Products() {
  const c = useCopy();
  const GROUPS = c.products.groups;
  return (
    <section id="products" className="py-20">
      <div className="container-x">
        <span className="eyebrow">{c.products.eyebrow}</span>
        <h2 className="h2">{c.products.h2}</h2>
        <p className="lead">{c.products.lead}</p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {GROUPS.map((g) => (
            <div key={g.name} className={`card ${g.highlight ? 'border-blue-300 ring-1 ring-blue-200' : ''}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{g.name}</h3>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${g.live ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{g.live ? c.products.available : c.products.roadmap}</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{g.desc}</p>
              <ul className="mt-4 flex flex-wrap gap-1.5">{g.items.map((i) => <li key={i} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{i}</li>)}</ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Agents ───────────────────────── */

export function Agents() {
  const c = useCopy();
  return (
    <section id="agents" className="bg-slate-950 py-20 text-white">
      <div className="container-x grid items-center gap-12 lg:grid-cols-2">
        <div>
          <span className="eyebrow text-sky-300">{c.agents.eyebrow}</span>
          <h2 className="h2 text-white">{c.agents.h2}</h2>
          <p className="lead text-slate-300">{c.agents.lead}</p>
          <ul className="mt-8 space-y-4 text-slate-200">
            {c.agents.points.map(([t, d]) => (
              <li key={t} className="flex gap-3"><span className="mt-1 h-5 w-5 flex-none rounded-full bg-sky-500/20 text-center text-xs leading-5 text-sky-300">✓</span><div><div className="font-semibold">{t}</div><div className="text-sm text-slate-400">{d}</div></div></li>
            ))}
          </ul>
        </div>
        <div className="code" dir="ltr">
          <div className="c">{c.agents.codeCreate}</div>
          <div><span className="k">POST</span> /v1/tokens</div>
          <pre className="mt-2 whitespace-pre-wrap">{`{
  "name": "claude-code",
  "isAgent": true,
  "scopes": ["servers:read", "servers:write"],
  "spendCapMinor": 1500,          `}<span className="c">{c.agents.codeCap}</span>{`
  "requireApprovalFor": ["servers:delete", "servers:resize-down"]
}`}</pre>
          <div className="c mt-4">{c.agents.codeOver}</div>
          <div><span className="k">402</span> <span className="p">spend_limit_reached</span></div>
          <div className="c">{`{ "capMinor": 1500, "spentMinor": 900, "addedMonthlyMinor": 2700 }`}</div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Pricing ───────────────────────── */

interface Price { sku: string; monthlyMinor: number; hourlyMinor: number; size?: { vcpu: number; memoryMb: number; diskGb: number; transferTb: number } | null }
interface PriceList { currency: 'USD' | 'SAR'; baseCurrency: 'USD'; fxRate: number; data: Price[] }
const FALLBACK: Price[] = [
  { sku: 's-1vcpu-512mb', monthlyMinor: 400, hourlyMinor: 1, size: { vcpu: 1, memoryMb: 512, diskGb: 10, transferTb: 0.5 } },
  { sku: 's-1vcpu-1gb', monthlyMinor: 600, hourlyMinor: 1, size: { vcpu: 1, memoryMb: 1024, diskGb: 25, transferTb: 1 } },
  { sku: 's-1vcpu-2gb', monthlyMinor: 1200, hourlyMinor: 2, size: { vcpu: 1, memoryMb: 2048, diskGb: 50, transferTb: 2 } },
  { sku: 's-2vcpu-4gb', monthlyMinor: 2400, hourlyMinor: 4, size: { vcpu: 2, memoryMb: 4096, diskGb: 80, transferTb: 4 } },
  { sku: 's-4vcpu-8gb', monthlyMinor: 4800, hourlyMinor: 7, size: { vcpu: 4, memoryMb: 8192, diskGb: 160, transferTb: 5 } },
  { sku: 's-8vcpu-16gb', monthlyMinor: 9600, hourlyMinor: 14, size: { vcpu: 8, memoryMb: 16384, diskGb: 320, transferTb: 6 } },
];

export function Pricing() {
  const c = useCopy(); const lang = useLang();
  const [currency, setCurrency] = useState<'USD' | 'SAR'>('USD');
  const [list, setList] = useState<PriceList>({ currency: 'USD', baseCurrency: 'USD', fxRate: 1, data: FALLBACK });
  useEffect(() => {
    fetch(`${API}/v1/pricing?currency=${currency}`)
      .then((r) => r.json())
      .then((d: PriceList) => setList({ ...d, data: d.data.filter((p) => p.size).sort((a, b) => a.monthlyMinor - b.monthlyMinor) }))
      .catch(() => setList({ currency: 'USD', baseCurrency: 'USD', fxRate: 1, data: FALLBACK }));
  }, [currency]);
  const cur = list.currency;
  const fmt = (m: number, digits = 2) => new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US', { style: 'currency', currency: cur, maximumFractionDigits: digits }).format(m / 100);
  return (
    <section id="pricing" className="py-20">
      <div className="container-x">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <span className="eyebrow">{c.pricing.eyebrow}</span>
            <h2 className="h2">{c.pricing.h2}</h2>
            <p className="lead">{c.pricing.lead}<code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm" dir="ltr">{c.pricing.leadCode}</code>.</p>
          </div>
          <div className="flex rounded-lg border border-slate-300 p-1 text-sm">
            {(['USD', 'SAR'] as const).map((c) => <button key={c} onClick={() => setCurrency(c)} className={`rounded-md px-4 py-1.5 ${currency === c ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>{c}</button>)}
          </div>
        </div>
        <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>{c.pricing.cols.map((h, i) => <th key={h} className={`px-5 py-3 ${i >= 4 ? 'text-end' : 'text-start'}`}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {list.data.map((p) => (
                <tr key={p.sku} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium">{p.size!.vcpu}</td>
                  <td className="px-5 py-3">{p.size!.memoryMb >= 1024 ? `${p.size!.memoryMb / 1024} GB` : `${p.size!.memoryMb} MB`}</td>
                  <td className="px-5 py-3">{p.size!.diskGb} GB</td>
                  <td className="px-5 py-3">{p.size!.transferTb} TB</td>
                  <td className="px-5 py-3 text-end font-semibold">{fmt(p.monthlyMinor)}</td>
                  <td className="px-5 py-3 text-end text-slate-500">{fmt(p.hourlyMinor, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {cur === 'SAR' ? c.pricing.noteTry(list.fxRate.toFixed(2)) : c.pricing.noteUsd}
          {c.pricing.noteTail(cur === 'SAR' ? fmt(Math.round(6 * list.fxRate)) : '$0.06')}
        </p>
      </div>
    </section>
  );
}

/* ───────────────────────── Marketplace ───────────────────────── */

const APPS = ['WordPress', 'WooCommerce', 'Docker', 'Node.js', 'Laravel', 'Django', 'n8n', 'Nextcloud', 'Mattermost', 'Odoo', 'WireGuard', 'Plausible', 'Ghost', 'Coolify', 'Ollama + Open WebUI'];

export function Marketplace() {
  const c = useCopy();
  return (
    <section id="marketplace" className="border-y border-slate-200 bg-slate-50 py-20">
      <div className="container-x">
        <span className="eyebrow">{c.marketplace.eyebrow}</span>
        <h2 className="h2">{c.marketplace.h2}</h2>
        <p className="lead">{c.marketplace.lead}</p>
        <div className="mt-8 flex flex-wrap gap-2">
          {APPS.map((a) => <span key={a} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-sm">{a}</span>)}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Compare ───────────────────────── */

export function Compare() {
  const c = useCopy();
  const rows = c.compare.rows;
  return (
    <section className="py-20">
      <div className="container-x">
        <span className="eyebrow">{c.compare.eyebrow}</span>
        <h2 className="h2">{c.compare.h2}</h2>
        <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3 text-start"> </th><th className="px-5 py-3 text-start text-blue-700">{c.compare.cols[0]}</th><th className="px-5 py-3 text-start">{c.compare.cols[1]}</th><th className="px-5 py-3 text-start">{c.compare.cols[2]}</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r[0]} className="border-t border-slate-100"><td className="px-5 py-3 font-medium">{r[0]}</td><td className="px-5 py-3 font-semibold text-blue-700">{r[1]}</td><td className="px-5 py-3 text-slate-600">{r[2]}</td><td className="px-5 py-3 text-slate-600">{r[3]}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── CTA + Footer ───────────────────────── */

export function Cta() {
  const c = useCopy();
  return (
    <section className="hero-bg py-20 text-white">
      <div className="container-x text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{c.cta.h2}</h2>
        <p className="mx-auto mt-4 max-w-xl text-slate-300">{c.cta.lead}</p>
        <div className="mt-8 flex justify-center gap-3">
          <a href={`${CONSOLE}/login`} className="btn-primary">{c.cta.create}</a>
          <a href="/docs/api" className="btn-light">{c.cta.docs}</a>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const c = useCopy();
  const cols = c.footer.cols;
  return (
    <footer className="border-t border-slate-200 bg-white py-14 text-sm">
      <div className="container-x grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-1"><div className="flex items-center gap-2 font-bold"><Logo /> pgcloud</div><p className="mt-3 text-slate-500">{c.footer.tagline}</p><p className="mt-3 flex gap-2 text-slate-500">{LANGS.map((l) => <a key={l.code} href={l.path} className="hover:text-slate-900">{l.label}</a>)}</p></div>
        {cols.map(([h, ls]) => <div key={h}><div className="font-semibold">{h}</div><ul className="mt-3 space-y-2 text-slate-600">{ls.map((l) => <li key={l}><a href="#" className="hover:text-slate-900">{l}</a></li>)}</ul></div>)}
      </div>
      <div className="container-x mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6 text-xs text-slate-500"><span>© {new Date().getFullYear()} {c.footer.copyright}</span><span>{c.footer.builtOn}</span></div>
    </footer>
  );
}
