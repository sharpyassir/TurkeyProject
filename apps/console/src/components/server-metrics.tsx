'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { MetricsChart } from '@/components/metrics-chart';

export interface MetricPoint { at: string; cpu: number; cpuMax?: number; memoryUsedMb: number; memoryTotalMb: number; netInBps: number; netOutBps: number; diskReadBps: number; diskWriteBps: number; diskUsedPercent?: number | null }
export interface MetricSeries { serverId: string; period: string; resolution: 'minute' | 'hour'; latest: MetricPoint | null; points: MetricPoint[] }

const PERIODS = ['1h', '6h', '24h', '7d', '30d'] as const;

/** The Metrics tab of a server: four charts and a period switch, refreshed every minute. */
export function ServerMetrics({ serverId }: { serverId: string }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('1h');
  const [data, setData] = useState<MetricSeries | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => api<MetricSeries>(`/v1/servers/${serverId}/metrics?period=${period}`).then((d) => live && setData(d)).catch((e) => live && setError(String(e.message ?? e)));
    load();
    const h = setInterval(load, 60_000);
    return () => { live = false; clearInterval(h); };
  }, [serverId, period]);

  const p = data?.points ?? [];
  const times = p.map((x) => x.at);
  const mbps = (bps: number) => (bps * 8) / 1e6;
  const mbs = (bps: number) => bps / 1e6;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="flex rounded-md border border-neutral-300 p-0.5 text-xs dark:border-neutral-700">
          {PERIODS.map((x) => <button key={x} type="button" onClick={() => setPeriod(x)} className={`rounded px-2.5 py-1 ${period === x ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'text-neutral-600 dark:text-neutral-300'}`}>{x}</button>)}
        </div>
        <span className="text-xs text-neutral-500">{data ? `${p.length} points, ${data.resolution === 'hour' ? 'hourly averages' : 'one per minute'}, refreshes every minute` : 'Loading…'}</span>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <MetricsChart title="CPU" unit="%" max={100} times={times} series={[{ name: 'CPU', values: p.map((x) => x.cpu) }]} />
        <MetricsChart title="Memory" unit="%" max={100} times={times} series={[{ name: 'Used', values: p.map((x) => (x.memoryTotalMb ? Math.round((x.memoryUsedMb / x.memoryTotalMb) * 1000) / 10 : null)) }]} />
        <MetricsChart title="Network" unit=" Mbps" times={times} format={(v) => (v >= 10 ? Math.round(v).toString() : (Math.round(v * 100) / 100).toString())} series={[{ name: 'In', values: p.map((x) => mbps(x.netInBps)) }, { name: 'Out', values: p.map((x) => mbps(x.netOutBps)) }]} />
        <MetricsChart title="Disk I/O" unit=" MB/s" times={times} format={(v) => (Math.round(v * 100) / 100).toString()} series={[{ name: 'Read', values: p.map((x) => mbs(x.diskReadBps)) }, { name: 'Write', values: p.map((x) => mbs(x.diskWriteBps)) }]} />
      </div>
      {data?.latest?.diskUsedPercent != null && <p className="text-xs text-neutral-500">Disk used: {data.latest.diskUsedPercent}%</p>}
    </div>
  );
}
