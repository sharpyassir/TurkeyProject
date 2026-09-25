import Link from 'next/link';
import { allDocs } from '@/lib/docs';

export default function DocsIndex() {
  const docs = allDocs();
  const start = docs.filter((d) => d.section === 'Start here');
  const guides = docs.filter((d) => d.section === 'Guides');
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">Documentation</h1>
      <p className="mt-3 text-lg text-slate-600">Everything here works the same from the console, the command line, the API and an AI agent. Start with the first page and you will have a server in a few minutes.</p>
      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wider text-slate-400">Start here</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {start.map((d) => <Link key={d.slug} href={`/docs/${d.slug}`} className="card"><div className="font-semibold">{d.title}</div><p className="mt-1 text-sm text-slate-600">{d.description}</p></Link>)}
      </div>
      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wider text-slate-400">Guides</h2>
      <ul className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200">
        {guides.map((d) => <li key={d.slug}><Link href={`/docs/${d.slug}`} className="block px-5 py-3 hover:bg-slate-50"><span className="font-medium">{d.title}</span><span className="ms-2 text-sm text-slate-500">{d.description}</span></Link></li>)}
        <li><Link href="/docs/api-reference" className="block px-5 py-3 hover:bg-slate-50"><span className="font-medium">API reference</span><span className="ms-2 text-sm text-slate-500">Every endpoint, generated from the OpenAPI spec.</span></Link></li>
      </ul>
    </div>
  );
}
