import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { invoiceNumber, startOfMonth, taxRateFor } from './pricing';

/**
 * Monthly invoicing. TRY invoices for Turkish teams (e-Fatura / e-Arşiv handed off to a
 * licensed provider — integration point: `EInvoiceProvider`), USD for the rest.
 */
@Injectable()
export class InvoicesService {
  private readonly log = new Logger(InvoicesService.name);

  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  /** Generates invoices for the month that just ended. Idempotent per team + period. */
  async issueForPreviousMonth(now = new Date()) {
    const periodEnd = startOfMonth(now);
    const periodStart = startOfMonth(new Date(periodEnd.getTime() - 1));
    const teams = await this.prisma.team.findMany({ where: { status: { not: 'closed' } }, include: { projects: { select: { id: true } } } });
    let issued = 0;
    for (const team of teams) {
      const existing = await this.prisma.invoice.findFirst({ where: { teamId: team.id, periodStart } });
      if (existing) continue;
      const records = await this.prisma.usageRecord.findMany({
        where: { projectId: { in: team.projects.map((p) => p.id) }, hourStart: { gte: periodStart, lt: periodEnd }, invoiceId: null },
      });
      const subtotal = records.reduce((s, r) => s + r.amountMinor, 0);
      if (subtotal <= 0) continue;

      const tax = Math.round(subtotal * taxRateFor(team.currency, team.country));
      const credit = await this.consumeCredits(team.id, subtotal + tax);
      const total = subtotal + tax - credit;

      const seq = (await this.prisma.invoice.count({ where: { createdAt: { gte: new Date(Date.UTC(periodEnd.getUTCFullYear(), 0, 1)) } } })) + 1;
      const invoice = await this.prisma.invoice.create({
        data: {
          teamId: team.id,
          number: invoiceNumber(periodEnd.getUTCFullYear(), seq),
          currency: team.currency,
          periodStart,
          periodEnd,
          subtotalMinor: subtotal,
          taxMinor: tax,
          creditMinor: credit,
          totalMinor: total,
          status: total === 0 ? 'paid' : 'open',
          eInvoiceType: team.country === 'TR' ? (team.taxId ? 'e-fatura' : 'e-arsiv') : null,
          dueAt: new Date(periodEnd.getTime() + 14 * 86_400_000),
          paidAt: total === 0 ? new Date() : null,
          records: { connect: records.map((r) => ({ id: r.id })) },
        },
      });
      await this.events.emit('invoice.issued', { invoiceId: invoice.id, number: invoice.number, totalMinor: total, currency: team.currency }, { teamId: team.id });
      issued++;
    }
    this.log.log(`issued ${issued} invoices for ${periodStart.toISOString().slice(0, 7)}`);
    return issued;
  }

  /** Applies promo/prepaid credits oldest-expiry first; returns the amount consumed. */
  private async consumeCredits(teamId: string, amountMinor: number) {
    const credits = await this.prisma.credit.findMany({
      where: { teamId, remainingMinor: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
    });
    let left = amountMinor;
    for (const c of credits) {
      if (left <= 0) break;
      const use = Math.min(c.remainingMinor, left);
      await this.prisma.credit.update({ where: { id: c.id }, data: { remainingMinor: { decrement: use } } });
      left -= use;
    }
    return amountMinor - left;
  }

  list(teamId: string) {
    return this.prisma.invoice.findMany({ where: { teamId }, orderBy: { periodStart: 'desc' } });
  }

  async get(teamId: string, id: string) {
    return this.prisma.invoice.findFirst({ where: { id, teamId }, include: { records: true, payments: true } });
  }
}
