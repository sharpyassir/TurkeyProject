import { Injectable, Logger } from '@nestjs/common';
import { Currency } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { loadConfig } from '../../config/config';

/**
 * Exchange rates. Every price in the book is in USD. Lira amounts are derived from the
 * USD amount at the rate in force at that moment, so lira prices move with the market
 * while our dollar pricing stays fixed.
 *
 * Rate sources, in order: the latest FxRate row at or before `at`, then the
 * FX_USD_TRY environment fallback. `refresh()` pulls a fresh rate from FX_PROVIDER_URL
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
    const rate = row ? Number(row.rate) : loadConfig().FX_USD_TRY;
    if (isNow) this.cache = { rate, at: Date.now() };
    return rate;
  }

  /** Convert a USD minor amount (cents) into `currency` minor units (kuruş) at the rate for `at`. */
  async convert(usdMinor: number, currency: Currency, at?: Date): Promise<number> {
    if (currency === 'USD') return usdMinor;
    return Math.round(usdMinor * (await this.rate(currency, at)));
  }

  async set(quote: Currency, rate: number, source: string) {
    const row = await this.prisma.fxRate.create({ data: { base: 'USD', quote, rate, source } });
    this.cache = null;
    this.log.log(`USD→${quote} = ${rate} (${source})`);
    return row;
  }

  /** Pull the current USD→TRY rate from the configured provider. Safe to call often. */
  async refresh(): Promise<number | null> {
    const url = loadConfig().FX_PROVIDER_URL;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { rates?: Record<string, number> };
      const rate = body.rates?.TRY;
      if (!rate || !Number.isFinite(rate) || rate <= 0) throw new Error('no TRY rate in response');
      const current = await this.rate('TRY');
      // Only write when the rate moved, so the table stays small.
      if (Math.abs(rate - current) / current > 0.0005) await this.set('TRY', rate, url);
      return rate;
    } catch (err) {
      this.log.warn(`FX refresh failed (${(err as Error).message}); keeping the last known rate`);
      return null;
    }
  }
}
