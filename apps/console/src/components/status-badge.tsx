const colors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  off: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  suspended: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

export function StatusBadge({ status }: { status: string }) {
  const cls = colors[status] ?? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 animate-pulse';
  return <span className={`badge ${cls}`}>{status}</span>;
}
