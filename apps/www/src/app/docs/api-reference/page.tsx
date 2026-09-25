import type { Metadata } from 'next';
import { marked } from 'marked';
import { loadOpenApi } from '@/lib/openapi';

export const metadata: Metadata = { title: 'API reference', description: 'Every pgcloud endpoint, generated from the OpenAPI specification at build time.' };

const COLORS: Record<string, string> = { GET: 'bg-emerald-100 text-emerald-800', POST: 'bg-blue-100 text-blue-800', PUT: 'bg-amber-100 text-amber-800', PATCH: 'bg-amber-100 text-amber-800', DELETE: 'bg-red-100 text-red-800' };

export default function ApiReferencePage() {
  const { info, tags, endpoints, errorCodes } = loadOpenApi();
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_180px]">
      <div className="min-w-0 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Reference</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">API reference</h1>
        <p className="mt-2 text-lg text-slate-600">{info.title} {info.version}. Generated from <a href="/openapi.yaml" className="text-blue-600 hover:underline">openapi.yaml</a>, which you can also feed to any client generator. Read the <a href="/docs/api" className="text-blue-600 hover:underline">API guide</a> first for auth, idempotency and errors.</p>
        {tags.map((tag) => (
          <section key={tag} id={tag} className="mt-12 scroll-mt-20">
            <h2 className="border-b border-slate-200 pb-1 text-xl font-semibold capitalize">{tag}</h2>
            {endpoints.filter((e) => e.tag === tag).map((e) => (
              <article key={e.method + e.path} id={anchor(e)} className="mt-6 scroll-mt-20 rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 font-mono text-xs font-semibold ${COLORS[e.method] ?? ''}`}>{e.method}</span>
                  <code className="font-mono text-sm">{e.path}</code>
                  {!e.auth && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">no auth</span>}
                </div>
                <p className="mt-2 font-medium">{e.summary}</p>
                {e.description && <p className="prose-docs-inline mt-1 text-sm text-slate-600" dangerouslySetInnerHTML={{ __html: marked.parseInline(e.description.replace(/\s*\n\s*/g, ' ').trim()) as string }} />}
                {e.params.length > 0 && <Table title="Parameters" rows={e.params} />}
                {e.body.length > 0 && <Table title="Request body" rows={e.body} />}
                <div className="mt-3 text-sm">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Responses</div>
                  <ul className="mt-1 space-y-0.5">{e.responses.map((r) => <li key={r.code}><code className="font-mono text-xs">{r.code}</code> <span className="text-slate-600">{r.description}</span></li>)}</ul>
                </div>
              </article>
            ))}
          </section>
        ))}
        {errorCodes.length > 0 && (
          <section id="errors" className="mt-12 scroll-mt-20">
            <h2 className="border-b border-slate-200 pb-1 text-xl font-semibold">Error codes</h2>
            <p className="mt-2 text-sm text-slate-600">Every error is <code className="rounded bg-slate-100 px-1 font-mono text-xs">{'{ "error": { "code", "message", "details?" } }'}</code> with one of these codes.</p>
            <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">{errorCodes.map((c) => <li key={c}><code className="font-mono text-xs">{c}</code></li>)}</ul>
          </section>
        )}
      </div>
      <aside className="hidden lg:block">
        <div className="sticky top-20 text-sm">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Sections</div>
          <ul className="space-y-1">{tags.map((t) => <li key={t}><a href={`#${t}`} className="capitalize text-slate-600 hover:text-slate-900">{t}</a></li>)}<li><a href="#errors" className="text-slate-600 hover:text-slate-900">Error codes</a></li></ul>
        </div>
      </aside>
    </div>
  );
}

function anchor(e: { method: string; path: string }) {
  return `${e.method.toLowerCase()}-${e.path.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '')}`;
}

function Table({ title, rows }: { title: string; rows: { name: string; type: string; required: boolean; description?: string; enum?: string[] }[] }) {
  return (
    <div className="mt-3 text-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</div>
      <table className="mt-1 w-full">
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-slate-100">
              <td className="py-1 pe-3 align-top font-mono text-xs">{r.name}{r.required && <span className="text-red-600">*</span>}</td>
              <td className="py-1 pe-3 align-top text-xs text-slate-500">{r.type}</td>
              <td className="py-1 align-top text-slate-600">{r.description}{r.enum && <span className="ms-1 text-xs text-slate-400">one of {r.enum.join(', ')}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
