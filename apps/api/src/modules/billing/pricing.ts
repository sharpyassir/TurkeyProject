/**
 * Pure rating math (no I/O) so it can be unit-tested.
 * See docs/adr/0004-metering-and-rating.md.
 */

export interface RateInput {
  /** Minutes of usage inside this hour (0–60) */
  minutes: number;
  monthlyMinor: number;
  hoursPerMonth: number;
  /** Amount already charged for this resource in the calendar month, before this hour. */
  chargedThisMonthMinor: number;
}

/** Charge for one hour of a resource. A partial hour is billed pro-rata by minute. */
export function rateHour(i: RateInput): number {
  if (i.minutes <= 0 || i.monthlyMinor <= 0) return 0;
  const hourly = i.monthlyMinor / i.hoursPerMonth;
  const raw = Math.round((hourly * Math.min(i.minutes, 60)) / 60);
  const remainingCap = Math.max(0, i.monthlyMinor - i.chargedThisMonthMinor);
  return Math.min(raw, remainingCap);
}

/** Estimated monthly and hourly price for display (minor units). */
export function displayPrice(monthlyMinor: number, hoursPerMonth: number) {
  return { monthlyMinor, hourlyMinor: Math.round(monthlyMinor / hoursPerMonth) };
}

/** Saudi VAT (15%) applies to riyal invoices and to teams in Saudi Arabia. */
export function taxRateFor(currency: 'USD' | 'SAR', country: string): number {
  return currency === 'SAR' || country === 'SA' ? 0.15 : 0;
}

export function startOfHour(d: Date) {
  return new Date(Math.floor(d.getTime() / 3_600_000) * 3_600_000);
}

export function startOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function invoiceNumber(year: number, seq: number) {
  return `INV-${year}-${String(seq).padStart(6, '0')}`;
}
