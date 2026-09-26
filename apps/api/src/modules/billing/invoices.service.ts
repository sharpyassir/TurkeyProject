import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { invoiceNumber, startOfMonth, taxRateFor } from './pricing';
import { MailService } from '../../common/mail/mail.service';
import { loadConfig } from '../../config/config';

/**
 * Monthly invoicing. TRY invoices for Turkish teams (e-Fatura / e-Arşiv handed off to a
 * licensed provider — integration point: `EInvoiceProvider`), USD for the rest.
 */
@Injectable()
export class InvoicesService {
  private readonly log = new Logger(InvoicesService.name);

  constructor(private readonly prisma: PrismaService, private readonly events: EventsService, private readonly mail: MailService) {}

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
      this.notify(team.id, invoice.number, total, team.currency, invoice.status === 'paid').catch((e) => this.log.warn(`invoice mail failed: ${e.message}`));
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

  /** Full row for the PDF renderer. */
  getForPdf(teamId: string, id: string) {
    return this.prisma.invoice.findFirst({ where: { id, teamId }, include: { team: true, records: true } });
  }

  private async notify(teamId: string, number: string, totalMinor: number, currency: string, paid: boolean) {
    const owners = await this.prisma.teamMember.findMany({ where: { teamId, role: { in: ['owner', 'billing'] } }, include: { user: { select: { email: true, name: true } } } });
    const amount = new Intl.NumberFormat(currency === 'TRY' ? 'tr-TR' : 'en-US', { style: 'currency', currency }).format(totalMinor / 100);
    const url = `${loadConfig().CONSOLE_URL}/billing`;
    await Promise.all(owners.map((m) => this.mail.send({
      to: m.user.email,
      subject: paid ? `Invoice ${number}: ${amount}, settled from credit` : `Invoice ${number}: ${amount} due in 14 days`,
      text: `Hi ${m.user.name},\n\nYour invoice ${number} for last month is ready: ${amount}.\n${paid ? 'It was settled from your prepaid credit; nothing to do.' : 'Pay it by card or add credit here:'}\n${url}\n\nThe PDF is available on the same page.`,
    })));
  }
}
