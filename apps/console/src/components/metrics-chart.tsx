'use client';

import { useId, useMemo, useState } from 'react';

/**
 * A small time series line chart in plain SVG. One or two series, 2px lines, recessive grid,
 * crosshair with a tooltip on hover, legend when there are two series, and a table view for
 * screen readers. Colors are text tokens; series hues are fixed per slot and validated for
 * light and dark surfaces.
 */
export interface Series { name: string; values: (number | null)[] }
export interface ChartProps {
  title: string;
  unit: string;
  times: string[];
  series: Series[];
  /** Fixed upper bound (percent charts); otherwise scaled to the data. */
  max?: number;
  format?: (v: number) => string;
  height?: number;
}

const HUES = ['text-blue-600 dark:text-blue-500', 'text-amber-600 dark:text-amber-600'];

export function MetricsChart({ title, unit, times, series, max, format = (v) => `${Math.round(v * 10) / 10}`, height = 160 }: ChartProps) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const w = 640, padL = 44, padR = 12, padT = 10, padB = 24;
  const innerW = w - padL - padR, innerH = height - padT - padB;
  const n = times.length;
  const top = useMemo(() => {
    if (max) return max;
    const m = Math.max(1, ...series.flatMap((s) => s.values.filter((v): v is number => v !== null)));
    const mag = Math.pow(10, Math.floor(Math.log10(m)));
    return Math.ceil(m / mag) * mag;
  }, [series, max]);
  const x = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => padT + innerH - (Math.min(v, top) / top) * innerH;
  const path = (vals: (number | null)[]) => {
    let d = '', pen = false;
    vals.forEach((v, i) => { if (v === null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true; });
    return d;
  };
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top);
  const labelAt = (i: number) => { const d = new Date(times[i]); return n > 300 ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); };
  const xLabels = n > 1 ? [0, Math.floor(n / 2), n - 1] : [0];
  const latest = series.map((s) => [...s.values].reverse().find((v) => v !== null) ?? null);

  return (
    <figure className="card p-3" aria-label={title}>
      <figcaption className="mb-1 flex flex-wrap items-baseline gap-x-3 text-sm">
        <span className="font-medium">{title}</span>
        {series.length >= 2 ? (
          <span className="flex gap-3 text-xs text-neutral-500">{series.map((s, i) => <span key={s.name} className="flex items-center gap-1"><i className={`inline-block h-0.5 w-3 rounded bg-current ${HUES[i]}`} />{s.name}{latest[i] !== null && <span className="text-neutral-700 dark:text-neutral-200"> {format(latest[i]!)}{unit}</span>}</span>)}</span>
        ) : latest[0] !== null && <span className="text-xs text-neutral-500">now <span className="text-neutral-700 dark:text-neutral-200">{format(latest[0]!)}{unit}</span></span>}
        <button type="button" className="ms-auto text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200" onClick={() => setTable(!table)}>{table ? 'Chart' : 'Table'}</button>
      </figcaption>
      {table ? (
        <div className="max-h-48 overflow-auto text-xs">
          <table className="w-full"><thead className="text-neutral-500"><tr><th className="text-start">Time</th>{series.map((s) => <th key={s.name} className="text-end">{s.name}</th>)}</tr></thead>
            <tbody>{times.map((t, i) => <tr key={t} className="border-t border-neutral-100 dark:border-neutral-800"><td>{new Date(t).toLocaleString()}</td>{series.map((s) => <td key={s.name} className="text-end tabular-nums">{s.values[i] === null ? '' : `${format(s.values[i]!)}${unit}`}</td>)}</tr>)}</tbody></table>
        </div>
      ) : n === 0 ? (
        <div className="flex items-center justify-center text-xs text-neutral-500" style={{ height }}>No samples yet. The first ones arrive within a minute of the server becoming active.</div>
      ) : (
        <svg viewBox={`0 0 ${w} ${height}`} className="w-full" role="img" aria-labelledby={`${id}-t`}
          onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * w; setHover(Math.max(0, Math.min(n - 1, Math.round(((px - padL) / innerW) * (n - 1))))); }}
          onMouseLeave={() => setHover(null)}>
          <title id={`${id}-t`}>{title}</title>
          {ticks.map((t) => <g key={t}><line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} className="stroke-neutral-200 dark:stroke-neutral-800" strokeWidth={1} /><text x={padL - 6} y={y(t) + 3} textAnchor="end" className="fill-neutral-400 text-[10px]">{format(t)}</text></g>)}
          {xLabels.map((i) => <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="fill-neutral-400 text-[10px]">{labelAt(i)}</text>)}
          {series.map((s, i) => <path key={s.name} d={path(s.values)} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className={`stroke-current ${HUES[i]}`} />)}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + innerH} className="stroke-neutral-400" strokeWidth={1} strokeDasharray="3 3" />
              {series.map((s, i) => s.values[hover] !== null && <circle key={s.name} cx={x(hover)} cy={y(s.values[hover]!)} r={4} className={`fill-current ${HUES[i]} stroke-white dark:stroke-neutral-900`} strokeWidth={2} />)}
              <foreignObject x={Math.min(x(hover) + 8, w - 170)} y={padT} width={160} height={20 + series.length * 16}>
                <div className="rounded border border-neutral-200 bg-white/95 px-2 py-1 text-[11px] shadow dark:border-neutral-700 dark:bg-neutral-900/95">
                  <div className="text-neutral-500">{new Date(times[hover]).toLocaleString()}</div>
                  {series.map((s, i) => <div key={s.name} className="flex justify-between gap-2"><span className="flex items-center gap-1"><i className={`inline-block h-0.5 w-3 rounded bg-current ${HUES[i]}`} />{s.name}</span><span className="tabular-nums">{s.values[hover] === null ? '' : `${format(s.values[hover]!)}${unit}`}</span></div>)}
                </div>
              </foreignObject>
            </g>
          )}
          <rect x={padL} y={padT} width={innerW} height={innerH} fill="transparent" />
        </svg>
      )}
    </figure>
  );
}
