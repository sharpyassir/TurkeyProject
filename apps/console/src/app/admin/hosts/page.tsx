'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { AdminShell, fmtDate } from '@/components/admin-shell';
import { StatusBadge } from '@/components/status-badge';

interface Host { id: string; name: string; regionId: string; driver: string; status: string; totalVcpu: number; totalMemoryMb: number; totalDiskGb: number; usedVcpu: number; usedMemoryMb: number; usedDiskGb: number; lastHeartbeatAt: string | null; _count: { servers: number } }

export default function AdminHosts() {
  const [rows, setRows] = useState<Host[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => api<{ data: Host[] }>('/admin/v1/hosts').then((r) => setRows(r.data)), []);
  useEffect(() => { load(); }, [load]);
  async function setStatus(h: Host, status: string) {
    try { await api(`/admin/v1/hosts/${h.id}/status`, { method: 'POST', body: JSON.stringify({ status }) }); load(); } catch (err) { setError(err instanceof ApiError ? err.message : String(err)); }
  }
  async function register(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const f = new FormData(e.currentTarget);
    try {
      await api('/admin/v1/hosts', { method: 'POST', body: JSON.stringify({ name: f.get('name'), regionId: f.get('regionId'), driver: f.get('driver'), driverRef: JSON.stringify({ node: f.get('name') }), totalVcpu: Number(f.get('vcpu')), totalMemoryMb: Number(f.get('memoryGb')) * 1024, totalDiskGb: Number(f.get('diskGb')) }) });
      e.currentTarget.reset(); load();
    } catch (err) { setError(err instanceof ApiError ? err.message : String(err)); }
  }
  const pct = (u: number, t: number) => (t ? Math.round((u / t) * 100) : 0);
  return (
    <AdminShell title="Hosts">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <section className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-neutral-500"><tr><th className="px-4 py-2 text-start">Host</th><th className="px-4 py-2 text-start">Status</th><th className="px-4 py-2 text-start">vCPU</th><th className="px-4 py-2 text-start">Memory</th><th className="px-4 py-2 text-start">Disk</th><th className="px-4 py-2 text-start">Servers</th><th className="px-4 py-2 text-start">Heartbeat</th><th /></tr></thead>
          <tbody>
            {rows.map((h) => (
              <tr key={h.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-4 py-2"><div className="font-medium">{h.name}</div><div className="text-xs text-neutral-500">{h.regionId} · {h.driver}</div></td>
                <td className="px-4 py-2"><StatusBadge status={h.status} /></td>
                <td className="px-4 py-2"><Bar pct={pct(h.usedVcpu, h.totalVcpu)} label={`${h.usedVcpu}/${h.totalVcpu}`} /></td>
                <td className="px-4 py-2"><Bar pct={pct(h.usedMemoryMb, h.totalMemoryMb)} label={`${Math.round(h.usedMemoryMb / 1024)}/${Math.round(h.totalMemoryMb / 1024)} GB`} /></td>
                <td className="px-4 py-2"><Bar pct={pct(h.usedDiskGb, h.totalDiskGb)} label={`${h.usedDiskGb}/${h.totalDiskGb} GB`} /></td>
                <td className="px-4 py-2">{h._count.servers}</td>
                <td className="px-4 py-2 text-xs text-neutral-500">{h.lastHeartbeatAt ? fmtDate(h.lastHeartbeatAt) : 'never'}</td>
                <td className="px-4 py-2 text-end"><select className="input w-auto py-1 text-xs" value={h.status} onChange={(e) => setStatus(h, e.target.value)}>{['active', 'draining', 'maintenance', 'down'].map((s) => <option key={s}>{s}</option>)}</select></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <form onSubmit={register} className="card space-y-3">
        <h2 className="font-medium">Register a host</h2>
        <p className="text-sm text-neutral-500">Creates the row the host agent needs. Put the returned id in the agent config on the Proxmox node and run the Ansible playbook.</p>
        <div className="grid gap-2 sm:grid-cols-6">
          <input className="input" name="name" placeholder="pve3" required /><input className="input" name="regionId" placeholder="sa1" defaultValue="sa1" required />
          <select className="input" name="driver" defaultValue="proxmox"><option>proxmox</option><option>fake</option></select>
          <input className="input" name="vcpu" type="number" placeholder="vCPU" required /><input className="input" name="memoryGb" type="number" placeholder="Memory GB" required /><input className="input" name="diskGb" type="number" placeholder="Disk GB" required />
        </div>
        <button className="btn-primary">Register</button>
      </form>
    </AdminShell>
  );
}

function Bar({ pct, label }: { pct: number; label: string }) {
  return <div className="w-32"><div className="h-1.5 rounded bg-neutral-200 dark:bg-neutral-800"><div className={`h-1.5 rounded ${pct > 85 ? 'bg-red-500' : pct > 65 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, pct)}%` }} /></div><div className="mt-0.5 text-xs text-neutral-500">{label}</div></div>;
}
