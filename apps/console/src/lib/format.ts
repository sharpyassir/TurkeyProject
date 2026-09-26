/** Human readable byte counts for storage pages. */
export const fmtBytes = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n >= 1e3 ? `${(n / 1e3).toFixed(0)} KB` : `${n} B`);

/** Display names for managed database engines. */
export const ENGINE_LABEL: Record<string, string> = { postgres: 'PostgreSQL', valkey: 'Valkey', mysql: 'MySQL' };
