import { Injectable, Logger } from '@nestjs/common';
import { Currency } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { loadConfig } from '../../config/config';
import { BOOK_CURRENCY } from './pricing';

/**
 * Exchange rates. Every price in the book is in riyals (BOOK_CURRENCY). Dollar amounts are
 * derived from the riyal amount at the USD to SAR rate in force at that moment. The riyal is
 * pegged at 3.75, so the rate rarely moves, but the machinery is the same for any currency.
 *
 * Rate sources, in order: the latest FxRate row at or before `at`, then the
 * FX_USD_SAR environment fallback. `refresh()` pulls a fresh rate from FX_PROVIDER_URL
 * once an hour; an admin can also set the rate by hand (POST /admin/v1/fx).
 */
@Injectable()
export class FxService {
  private readonly log = new Logger(FxService.name);
  private cache: { rate: number; at: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** USD → `quote` rate valid at `at` (default now). USD → USD is 1. */
  async rate(quote: Currency, at: Date = new Date()): Promise<number> {
    if (quote === 'USD') return 1;
    const isNow = Date.now() - at.getTime() < 60_000;
    if (isNow && this.cache && Date.now() - this.cache.at < 60_000) return this.cache.rate;
    const row = await this.prisma.fxRate.findFirst({ where: { base: 'USD', quote, at: { lte: at } }, orderBy: { at: 'desc' } });
    const rate = row ? Number(row.rate) : loadConfig().FX_USD_SAR;
    if (isNow) this.cache = { rate, at: Date.now() };
    return rate;
  }

  /** Multiplier from the price book currency to `currency` at `at`: 1 for the book currency itself. */
  async bookRate(currency: Currency, at?: Date): Promise<number> {
    if (currency === BOOK_CURRENCY) return 1;
    const usdToSar = await this.rate('SAR', at);
    return BOOK_CURRENCY === 'SAR' ? 1 / usdToSar : usdToSar;
  }

  /** Convert a book minor amount (halalas) into `currency` minor units at the rate for `at`. */
  async convert(bookMinor: number, currency: Currency, at?: Date): Promise<number> {
    if (currency === BOOK_CURRENCY) return bookMinor;
    return Math.round(bookMinor * (await this.bookRate(currency, at)));
  }

  async set(quote: Currency, rate: number, source: string) {
    const row = await this.prisma.fxRate.create({ data: { base: 'USD', quote, rate, source } });
    this.cache = null;
    this.log.log(`USD→${quote} = ${rate} (${source})`);
    return row;
  }

  /** Pull the current USD→SAR rate from the configured provider. Safe to call often. */
  async refresh(): Promise<number | null> {
    const url = loadConfig().FX_PROVIDER_URL;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { rates?: Record<string, number> };
      const rate = body.rates?.SAR;
      if (!rate || !Number.isFinite(rate) || rate <= 0) throw new Error('no SAR rate in response');
      const current = await this.rate('SAR');
      // Only write when the rate moved, so the table stays small.
      if (Math.abs(rate - current) / current > 0.0005) await this.set('SAR', rate, url);
      return rate;
    } catch (err) {
      this.log.warn(`FX refresh failed (${(err as Error).message}); keeping the last known rate`);
      return null;
    }
  }
}
