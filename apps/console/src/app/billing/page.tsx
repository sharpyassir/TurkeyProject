'use client';

import { useEffect, useState } from 'react';
import { api, Balance, money } from '@/lib/api';
import { t } from '@/lib/i18n';
import { useShell } from '@/components/shell';

interface UsageRow { resourceType: string; resourceId: string; unit: string; quantity: number; amountMinor: number; currency: string }
interface Invoice { id: string; number: string; currency: string; totalMinor: number; status: string; periodStart: string; eInvoiceType: string | null }

export default function BillingPage() {
  const { locale } = useShell();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    api<Balance>('/v1/billing/balance').then(setBalance);
    api<{ data: UsageRow[] }>('/v1/billing/usage').then((r) => setUsage(r.data));
    api<{ data: Invoice[] }>('/v1/billing/invoices').then((r) => setInvoices(r.data));
  }, []);

  if (!balance) return null;
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t(locale, 'billing')}</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={t(locale, 'balance')} value={money(balance.creditMinor, balance.currency, locale)} />
        <Stat label={t(locale, 'mtd')} value={money(balance.monthToDateMinor, balance.currency, locale)} />
        <Stat label={t(locale, 'status')} value={balance.status} />
      </div>
      <section className="card p-0">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-neutral-500"><tr><th className="px-4 py-2 text-start">Resource</th><th className="px-4 py-2 text-start">Usage</th><th className="px-4 py-2 text-end">Amount</th></tr></thead>
          <tbody>
            {usage.length === 0 && <tr><td className="px-4 py-3 text-neutral-500" colSpan={3}>—</td></tr>}
            {usage.map((u) => (
              <tr key={u.resourceId + u.unit} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-4 py-2">{u.resourceType} <span className="font-mono text-xs text-neutral-500">{u.resourceId.slice(-6)}</span></td>
                <td className="px-4 py-2">{u.quantity} {u.unit}</td>
                <td className="px-4 py-2 text-end">{money(u.amountMinor, u.currency, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {invoices.length > 0 && (
        <section className="card p-0">
          <table className="w-full text-sm">
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="border-t border-neutral-100 first:border-0 dark:border-neutral-800">
                  <td className="px-4 py-2 font-mono">{i.number}</td>
                  <td className="px-4 py-2 text-neutral-500">{i.periodStart.slice(0, 7)} {i.eInvoiceType && `· ${i.eInvoiceType}`}</td>
                  <td className="px-4 py-2">{i.status}</td>
                  <td className="px-4 py-2 text-end">{money(i.totalMinor, i.currency, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="card"><div className="text-xs text-neutral-500">{label}</div><div className="mt-1 text-lg font-semibold">{value}</div></div>;
}
