'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError, money } from '@/lib/api';
import { useShell } from '@/components/shell';

interface Project { id: string; slug: string; name: string; quotaServers: number; quotaVcpu: number; quotaMemoryMb: number; spendLimitMinor: number | null; createdAt: string }

export default function ProjectsPage() {
  const { locale } = useShell();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currency, setCurrency] = useState<'USD' | 'TRY'>('USD');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, b] = await Promise.all([api<{ data: Project[] }>('/v1/projects'), api<{ currency: 'USD' | 'TRY' }>('/v1/billing/balance')]);
    setProjects(p.data); setCurrency(b.currency);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const f = new FormData(e.currentTarget);
    const limit = Number(f.get('limit'));
    try {
      await api('/v1/projects', { method: 'POST', body: JSON.stringify({ name: f.get('name'), slug: f.get('slug'), spendLimitMinor: limit > 0 ? Math.round(limit * 100) : undefined }) });
      e.currentTarget.reset(); load();
    } catch (err) { setError(err instanceof ApiError ? err.message : String(err)); }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Projects</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <div key={p.id} className="card">
            <div className="font-medium">{p.name} <span className="font-mono text-xs text-neutral-500">{p.slug}</span></div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 text-xs text-neutral-600 dark:text-neutral-400">
              <dt>Servers quota</dt><dd>{p.quotaServers}</dd>
              <dt>vCPU / RAM quota</dt><dd>{p.quotaVcpu} / {p.quotaMemoryMb / 1024} GB</dd>
              <dt>Monthly spend limit</dt><dd>{p.spendLimitMinor != null ? money(p.spendLimitMinor, currency, locale) : '∞'}</dd>
            </dl>
          </div>
        ))}
      </div>
      <form onSubmit={create} className="card grid gap-3 sm:grid-cols-4">
        <input className="input" name="name" placeholder="Staging" required />
        <input className="input" name="slug" placeholder="staging" pattern="[a-z0-9-]{2,40}" required />
        <input className="input" name="limit" type="number" min={0} placeholder={`Spend limit (${currency}, optional)`} />
        <button className="btn-primary justify-center">Create project</button>
        {error && <p className="text-sm text-red-600 sm:col-span-4">{error}</p>}
      </form>
    </div>
  );
}
