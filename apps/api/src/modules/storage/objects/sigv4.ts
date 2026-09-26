import { createHash, createHmac } from 'node:crypto';

/**
 * AWS Signature Version 4 for S3 style requests (Ceph RGW speaks it too). Header signing
 * for API calls, query signing for presigned URLs. Kept small on purpose: one region, one
 * service, unsigned payloads for header requests.
 */
export interface SigV4Creds {
  accessKey: string;
  secretKey: string;
  region: string;
  service?: string;
}

const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const sha256 = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
const hmac = (k: Buffer | string, s: string) => createHmac('sha256', k).update(s).digest();

function canonicalQuery(params: Record<string, string>) {
  return Object.keys(params).sort().map((k) => `${enc(k)}=${enc(params[k])}`).join('&');
}

function signingKey(secret: string, date: string, region: string, service: string) {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, date), region), service), 'aws4_request');
}

function amzDate(d = new Date()) {
  const iso = d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return { full: iso, date: iso.slice(0, 8) };
}

/** Signs a request and returns the headers to send (Host, x-amz-date, x-amz-content-sha256, Authorization). */
export function signHeaders(creds: SigV4Creds, method: string, url: URL, extraHeaders: Record<string, string> = {}, body: Buffer | string = ''): Record<string, string> {
  const service = creds.service ?? 's3';
  const { full, date } = amzDate();
  const payloadHash = body.length ? sha256(body) : sha256('');
  const headers: Record<string, string> = { host: url.host, 'x-amz-date': full, 'x-amz-content-sha256': payloadHash, ...Object.fromEntries(Object.entries(extraHeaders).map(([k, v]) => [k.toLowerCase(), v.trim()])) };
  const signed = Object.keys(headers).sort();
  const canonicalHeaders = signed.map((k) => `${k}:${headers[k]}\n`).join('');
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (params[k] = v));
  const canonical = [method, encodePath(url.pathname), canonicalQuery(params), canonicalHeaders, signed.join(';'), payloadHash].join('\n');
  const scope = `${date}/${creds.region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', full, scope, sha256(canonical)].join('\n');
  const sig = createHmac('sha256', signingKey(creds.secretKey, date, creds.region, service)).update(toSign).digest('hex');
  return { ...headers, authorization: `AWS4-HMAC-SHA256 Credential=${creds.accessKey}/${scope}, SignedHeaders=${signed.join(';')}, Signature=${sig}` };
}

/** Presigned URL valid for `expiresSeconds`. */
export function presignUrl(creds: SigV4Creds, method: string, url: URL, expiresSeconds: number): string {
  const service = creds.service ?? 's3';
  const { full, date } = amzDate();
  const scope = `${date}/${creds.region}/${service}/aws4_request`;
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (params[k] = v));
  Object.assign(params, { 'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': `${creds.accessKey}/${scope}`, 'X-Amz-Date': full, 'X-Amz-Expires': String(expiresSeconds), 'X-Amz-SignedHeaders': 'host' });
  const canonical = [method, encodePath(url.pathname), canonicalQuery(params), `host:${url.host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const toSign = ['AWS4-HMAC-SHA256', full, scope, sha256(canonical)].join('\n');
  const sig = createHmac('sha256', signingKey(creds.secretKey, date, creds.region, service)).update(toSign).digest('hex');
  return `${url.origin}${url.pathname}?${canonicalQuery(params)}&X-Amz-Signature=${sig}`;
}

function encodePath(p: string) {
  return p.split('/').map((seg) => enc(decodeURIComponent(seg))).join('/');
}
