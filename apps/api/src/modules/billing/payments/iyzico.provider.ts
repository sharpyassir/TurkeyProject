import { createHmac, randomUUID } from 'node:crypto';
import { ApiError } from '../../../common/errors/api-error';
import { loadConfig } from '../../../config/config';
import type { CheckoutInput, CheckoutResult, PaymentEvent, PaymentProvider } from './provider';

/**
 * iyzico Checkout Form (hosted page). Auth v2: `IYZWSv2 base64(apiKey:..&randomKey:..&signature:..)` where
 * signature = HMAC-SHA256(secret, randomKey + uriPath + body). After paying, iyzico posts `token` to our
 * callback; we retrieve the result server side, so the callback body itself is never trusted.
 */
export class IyzicoProvider implements PaymentProvider {
  readonly name = 'iyzico' as const;

  async createCheckout(i: CheckoutInput): Promise<CheckoutResult> {
    const price = (i.amountMinor / 100).toFixed(2);
    const [first, ...rest] = i.customer.name.split(' ');
    const body = {
      locale: 'tr',
      conversationId: i.paymentId,
      price,
      paidPrice: price,
      currency: i.currency,
      basketId: i.paymentId,
      paymentGroup: 'PRODUCT',
      callbackUrl: i.callbackUrl,
      enabledInstallments: [1],
      buyer: { id: i.customer.teamId, name: first || 'Customer', surname: rest.join(' ') || '-', email: i.customer.email, identityNumber: '11111111111', registrationAddress: 'Türkiye', city: 'Istanbul', country: 'Turkey', ip: '0.0.0.0' },
      billingAddress: { contactName: i.customer.name, city: 'Istanbul', country: 'Turkey', address: 'Türkiye' },
      basketItems: [{ id: i.paymentId, name: i.description, category1: 'Cloud', itemType: 'VIRTUAL', price }],
    };
    const r = await this.call<{ status: string; token: string; paymentPageUrl: string; errorMessage?: string }>('/payment/iyzipos/checkoutform/initialize/auth', body);
    if (r.status !== 'success') throw new ApiError(502, 'payment_provider_error', `iyzico: ${r.errorMessage ?? 'initialize failed'}`);
    return { providerRef: r.token, redirectUrl: r.paymentPageUrl };
  }

  /** Callback carries only a token; the truth comes from the retrieve call. */
  async parseEvent(rawBody: Buffer, _headers: Record<string, string | undefined>, query?: Record<string, string>): Promise<PaymentEvent[]> {
    const text = rawBody.toString('utf8');
    let token = query?.token;
    if (!token) {
      try { token = (JSON.parse(text) as { token?: string }).token; } catch { token = new URLSearchParams(text).get('token') ?? undefined; }
    }
    if (!token) throw ApiError.invalid('token missing');
    const r = await this.call<{ status: string; paymentStatus?: string; paidPrice?: string; currency?: string; errorMessage?: string; token: string }>('/payment/iyzipos/checkoutform/auth/ecom/detail', { locale: 'tr', token });
    if (r.status === 'success' && r.paymentStatus === 'SUCCESS') return [{ providerRef: token, status: 'succeeded', amountMinor: Math.round(Number(r.paidPrice) * 100), currency: r.currency as PaymentEvent['currency'] }];
    return [{ providerRef: token, status: 'failed', reason: r.errorMessage ?? r.paymentStatus ?? 'failed' }];
  }

  private async call<T>(path: string, body: unknown): Promise<T> {
    const { IYZICO_API_KEY: key, IYZICO_SECRET_KEY: secret, IYZICO_BASE_URL: base } = loadConfig();
    if (!key || !secret) throw new ApiError(503, 'payments_unavailable', 'iyzico is not configured');
    const json = JSON.stringify(body);
    const randomKey = `${Date.now()}${randomUUID().slice(0, 8)}`;
    const signature = createHmac('sha256', secret).update(randomKey + path + json).digest('hex');
    const auth = 'IYZWSv2 ' + Buffer.from(`apiKey:${key}&randomKey:${randomKey}&signature:${signature}`).toString('base64');
    const res = await fetch(`${base}${path}`, { method: 'POST', headers: { authorization: auth, 'x-iyzi-rnd': randomKey, 'content-type': 'application/json', accept: 'application/json' }, body: json, signal: AbortSignal.timeout(15_000) });
    const out = (await res.json().catch(() => ({}))) as T;
    if (!res.ok) throw new ApiError(502, 'payment_provider_error', `iyzico answered ${res.status}`);
    return out;
  }
}
