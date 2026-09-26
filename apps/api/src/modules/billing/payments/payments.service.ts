import { Injectable, Logger } from '@nestjs/common';
import type { Currency, PaymentProvider as ProviderName } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ApiError } from '../../../common/errors/api-error';
import { EventsService } from '../../events/events.service';
import { loadConfig } from '../../../config/config';
import type { Actor } from '../../../common/auth/actor';
import type { PaymentProvider } from './provider';
import { MoyasarProvider } from './moyasar.provider';
import { FakeProvider } from './fake.provider';

/** Card payments: prepaid credit top ups and paying open invoices, in riyals or dollars through Moyasar. */
@Injectable()
export class PaymentsService {
  private readonly log = new Logger(PaymentsService.name);
  private readonly providers: Record<'moyasar' | 'fake', PaymentProvider> = { moyasar: new MoyasarProvider(), fake: new FakeProvider() };

  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  providerFor(currency: Currency): PaymentProvider {
    const c = loadConfig();
    void currency; // one provider serves both currencies
    return this.providers[c.PAYMENT_PROVIDER];
  }

  /** Limits per currency in minor units: keeps typos and card testing out. */
  limits(currency: Currency) {
    return currency === 'SAR' ? { min: 2_000, max: 2_000_000 } : { min: 500, max: 500_000 };
  }

  async topup(actor: Actor, amountMinor: number) {
    if (actor.isAgent) throw ApiError.forbidden('Agents cannot add credit. A person must do this in the console.');
    const team = await this.prisma.team.findUniqueOrThrow({ where: { id: actor.teamId } });
    const { min, max } = this.limits(team.currency);
    if (!Number.isInteger(amountMinor) || amountMinor < min || amountMinor > max) throw ApiError.invalid(`Amount must be between ${min / 100} and ${max / 100} ${team.currency}`, { min, max });
    return this.start(actor, team, amountMinor, `pgcloud credit top up for ${team.name}`, undefined);
  }

  async payInvoice(actor: Actor, invoiceId: string) {
    if (actor.isAgent) throw ApiError.forbidden('Agents cannot pay invoices. A person must do this in the console.');
    const team = await this.prisma.team.findUniqueOrThrow({ where: { id: actor.teamId } });
    const inv = await this.prisma.invoice.findFirst({ where: { id: invoiceId, teamId: team.id } });
    if (!inv) throw ApiError.notFound('invoice', invoiceId);
    if (inv.status !== 'open') throw ApiError.invalidState(`Invoice ${inv.number} is ${inv.status}`);
    return this.start(actor, team, inv.totalMinor, `pgcloud invoice ${inv.number}`, inv.id);
  }

  list(actor: Actor) {
    return this.prisma.payment.findMany({ where: { teamId: actor.teamId }, orderBy: { createdAt: 'desc' }, take: 50, include: { invoice: { select: { number: true } } } });
  }

  /** Provider webhook or callback: idempotent, so redelivery is harmless. */
  async handle(provider: ProviderName | 'fake', rawBody: Buffer, headers: Record<string, string | undefined>, query?: Record<string, string>) {
    const events = await this.providers[provider as 'moyasar' | 'fake'].parseEvent(rawBody, headers, query);
    const out: { paymentId: string; status: string; successUrl?: string; cancelUrl?: string }[] = [];
    for (const ev of events) {
      const p = await this.prisma.payment.findFirst({ where: { provider: 'moyasar', providerRef: ev.providerRef }, include: { invoice: true } });
      if (!p) { this.log.warn(`${provider} event for unknown payment ${ev.providerRef}`); continue; }
      const meta = (p.metadata ?? {}) as { successUrl?: string; cancelUrl?: string };
      if (p.status !== 'pending') { out.push({ paymentId: p.id, status: p.status, ...meta }); continue; }
      if (ev.status === 'succeeded') {
        if (ev.amountMinor !== undefined && ev.amountMinor !== p.amountMinor) {
          this.log.error(`payment ${p.id}: provider amount ${ev.amountMinor} differs from ${p.amountMinor}`);
        }
        await this.prisma.$transaction(async (tx) => {
          await tx.payment.update({ where: { id: p.id }, data: { status: 'succeeded', paidAt: new Date() } });
          if (p.invoiceId) {
            await tx.invoice.update({ where: { id: p.invoiceId }, data: { status: 'paid', paidAt: new Date() } });
          } else {
            await tx.credit.create({ data: { teamId: p.teamId, kind: 'prepaid', currency: p.currency, amountMinor: p.amountMinor, remainingMinor: p.amountMinor, reason: `Card top up (${provider} ${ev.providerRef.slice(0, 12)})` } });
          }
          // A paid invoice or fresh credit lifts a team that was suspended for non payment.
          await tx.team.updateMany({ where: { id: p.teamId, status: 'suspended' }, data: { status: 'active' } });
        });
        await this.events.emit(p.invoiceId ? 'invoice.paid' : 'payment.succeeded', { paymentId: p.id, invoiceId: p.invoiceId, amountMinor: p.amountMinor, currency: p.currency }, { teamId: p.teamId, resource: `payment:${p.id}` });
      } else {
        await this.prisma.payment.update({ where: { id: p.id }, data: { status: 'failed', failureReason: ev.reason } });
        await this.events.emit('payment.failed', { paymentId: p.id, invoiceId: p.invoiceId, reason: ev.reason }, { teamId: p.teamId, resource: `payment:${p.id}` });
      }
      out.push({ paymentId: p.id, status: ev.status, ...meta });
    }
    return out;
  }

  private async start(actor: Actor, team: { id: string; name: string; currency: Currency }, amountMinor: number, description: string, invoiceId: string | undefined) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.userId } });
    const provider = this.providerFor(team.currency);
    const c = loadConfig();
    const successUrl = `${c.CONSOLE_URL}/billing?payment=success`;
    const cancelUrl = `${c.CONSOLE_URL}/billing?payment=cancel`;
    const payment = await this.prisma.payment.create({
      data: { teamId: team.id, invoiceId, provider: 'moyasar', currency: team.currency, amountMinor, metadata: { successUrl, cancelUrl, providerName: provider.name } },
    });
    try {
      const r = await provider.createCheckout({ paymentId: payment.id, amountMinor, currency: team.currency, description, customer: { email: user.email, name: user.name, teamId: team.id }, successUrl, cancelUrl, callbackUrl: `${c.PUBLIC_API_URL}/v1/billing/payments/${provider.name}/callback` });
      await this.prisma.payment.update({ where: { id: payment.id }, data: { providerRef: r.providerRef } });
      await this.events.emit('payment.started', { paymentId: payment.id, amountMinor, currency: team.currency, invoiceId }, { actor, resource: `payment:${payment.id}` });
      return { paymentId: payment.id, provider: provider.name, amountMinor, currency: team.currency, redirectUrl: r.redirectUrl };
    } catch (err) {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'failed', failureReason: (err as Error).message } });
      throw err;
    }
  }
}
