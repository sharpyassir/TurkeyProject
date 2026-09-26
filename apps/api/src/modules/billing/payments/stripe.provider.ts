import { createHmac, timingSafeEqual } from 'node:crypto';
import { ApiError } from '../../../common/errors/api-error';
import { loadConfig } from '../../../config/config';
import type { CheckoutInput, CheckoutResult, PaymentEvent, PaymentProvider } from './provider';

/** Stripe Checkout over the REST API (no SDK): one session per payment, confirmed by webhook. */
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe' as const;

  async createCheckout(i: CheckoutInput): Promise<CheckoutResult> {
    const form = new URLSearchParams({
      mode: 'payment',
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': i.currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(i.amountMinor),
      'line_items[0][price_data][product_data][name]': i.description,
      customer_email: i.customer.email,
      client_reference_id: i.paymentId,
      'metadata[paymentId]': i.paymentId,
      'metadata[teamId]': i.customer.teamId,
      success_url: i.successUrl,
      cancel_url: i.cancelUrl,
    });
    const s = await this.call<{ id: string; url: string }>('/v1/checkout/sessions', form);
    return { providerRef: s.id, redirectUrl: s.url };
  }

  async parseEvent(rawBody: Buffer, headers: Record<string, string | undefined>): Promise<PaymentEvent[]> {
    const secret = loadConfig().STRIPE_WEBHOOK_SECRET;
    if (!secret) throw ApiError.unauthorized('Stripe webhook secret is not configured');
    const sig = headers['stripe-signature'] ?? '';
    const parts = Object.fromEntries(sig.split(',').map((p) => p.split('=') as [string, string]));
    const expected = createHmac('sha256', secret).update(`${parts.t}.${rawBody.toString('utf8')}`).digest('hex');
    const v1 = parts.v1 ?? '';
    if (!parts.t || v1.length !== expected.length || !timingSafeEqual(Buffer.from(v1), Buffer.from(expected))) throw ApiError.unauthorized('Invalid Stripe signature');
    if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) throw ApiError.unauthorized('Stale Stripe signature');
    const ev = JSON.parse(rawBody.toString('utf8')) as { type: string; data: { object: { id: string; payment_status?: string; amount_total?: number; currency?: string } } };
    const o = ev.data.object;
    if (ev.type === 'checkout.session.completed' && o.payment_status === 'paid') return [{ providerRef: o.id, status: 'succeeded', amountMinor: o.amount_total, currency: o.currency?.toUpperCase() as PaymentEvent['currency'] }];
    if (ev.type === 'checkout.session.async_payment_succeeded') return [{ providerRef: o.id, status: 'succeeded', amountMinor: o.amount_total }];
    if (ev.type === 'checkout.session.async_payment_failed' || ev.type === 'checkout.session.expired') return [{ providerRef: o.id, status: 'failed', reason: ev.type }];
    return [];
  }

  private async call<T>(path: string, form: URLSearchParams): Promise<T> {
    const key = loadConfig().STRIPE_SECRET_KEY;
    if (!key) throw new ApiError(503, 'payments_unavailable', 'Stripe is not configured');
    const res = await fetch(`https://api.stripe.com${path}`, { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/x-www-form-urlencoded' }, body: form, signal: AbortSignal.timeout(15_000) });
    const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
    if (!res.ok) throw new ApiError(502, 'payment_provider_error', `Stripe: ${body.error?.message ?? res.status}`);
    return body;
  }
}
