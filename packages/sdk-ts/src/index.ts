/**
 * pgcloud SDK for TypeScript and JavaScript.
 *
 *   import { Pgcloud } from '@pgcloud/sdk';
 *   const pg = new Pgcloud({ token: process.env.PGCLOUD_TOKEN! });
 *   const server = await pg.servers.create({ name: 'web-1', size: 's-1vcpu-1gb', image: 'ubuntu-24-04' });
 *   await pg.servers.waitUntilActive(server.id);
 *
 * Types come from the OpenAPI document (src/types.gen.ts, regenerated with `pnpm gen`).
 * Every mutating call sends an Idempotency-Key, so a retried request never doubles a resource.
 */
import type { components, paths } from './types.gen.js';

export type Schemas = components['schemas'];
export type Paths = paths;
export type Approval = Schemas['Approval'];
export type Checkout = Schemas['Checkout'];
export type ApiErrorBody = Schemas['Error'];

export interface Server {
  id: string; name: string; status: string; statusMessage: string | null;
  region: { id: string; name: string }; size: { id: string; vcpu: number; memoryMb: number; diskGb: number; transferTb: number };
  image: { id: string; name: string; kind: string };
  networks: { v4: { ipAddress: string; floating?: boolean; reverseDns?: string | null }[]; private: { ipAddress: string }[] };
  firewalls: string[]; backupsEnabled: boolean; projectId: string; tags: string[]; createdAt: string;
}
export interface Deployment { id: string; name: string; repoUrl: string; repo: string | null; source: 'github_app' | 'url'; branch: string; port: number; status: string; url: string | null; serverId: string; serverStatus: string; lastCommit: string | null; lastDeployAt: string | null; createdAt: string }
export interface Size { id: string; vcpu: number; memoryMb: number; diskGb: number; transferTb: number }
export interface Image { id: string; kind: 'distribution' | 'marketplace'; name: string; distribution?: string; version?: string }
export interface Price { resourceType: string; sku: string; unit: string; monthlyMinor: number; hourlyMinor: number }
export interface Balance { currency: 'USD' | 'TRY'; creditMinor: number; monthToDateMinor: number; status: string }
export interface Firewall { id: string; name: string; rules: FirewallRule[]; servers: { serverId: string }[] }
export interface FirewallRule { id?: string; direction: 'inbound' | 'outbound'; protocol: 'tcp' | 'udp' | 'icmp' | 'any'; ports?: string | null; cidrs: string[]; description?: string }
export interface Snapshot { id: string; name: string; status: string; sizeGb: number; serverId: string | null; createdAt: string }
export interface SshKey { id: string; name: string; fingerprint: string; createdAt: string }
export interface ApiToken { id: string; name: string; prefix: string; scopes: string[]; isAgent: boolean; spendCapMinor: number | null; spentThisMonthMinor: number; requireApprovalFor: string[]; expiresAt: string | null; lastUsedAt: string | null; createdAt: string }
export interface List<T> { data: T[]; meta?: { next_cursor?: string | null } }

export class PgcloudError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: Record<string, unknown>) {
    super(message);
    this.name = 'PgcloudError';
  }
  /** True for approval_required: a person must approve in the console; `details.approvalId` says which. */
  get needsApproval() { return this.code === 'approval_required'; }
}

export interface PgcloudOptions {
  token: string;
  /** Defaults to https://api.pgcloud.example/v1 or PGCLOUD_API_URL. */
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Project id or slug applied to project scoped calls when set. */
  project?: string;
  userAgent?: string;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class Pgcloud {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;
  constructor(private readonly opts: PgcloudOptions) {
    if (!opts.token) throw new Error('pgcloud: token is required');
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.PGCLOUD_API_URL;
    this.base = (opts.baseUrl ?? env ?? 'https://api.pgcloud.example').replace(/\/+$/, '').replace(/\/v1$/, '');
    this.fetchImpl = opts.fetch ?? fetch;
  }

  /** Raw call. Prefer the resource helpers below. */
  async request<T>(method: Method, path: string, body?: unknown, query?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(this.base + path);
    for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
    const headers: Record<string, string> = { authorization: `Bearer ${this.opts.token}`, accept: 'application/json', 'user-agent': this.opts.userAgent ?? 'pgcloud-sdk-ts/0.1.0' };
    if (body !== undefined) { headers['content-type'] = 'application/json'; headers['idempotency-key'] = randomKey(); }
    const res = await this.fetchImpl(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    const json = text ? safeJson(text) : null;
    if (!res.ok) {
      const e = (json as { error?: ApiErrorBody['error'] } | null)?.error;
      throw new PgcloudError(res.status, e?.code ?? 'http_error', e?.message ?? res.statusText, e?.details as Record<string, unknown> | undefined);
    }
    return json as T;
  }

  readonly account = {
    me: () => this.request<{ user: { id: string; email: string; name: string; totpEnabled: boolean; emailVerified: boolean }; team: { id: string; slug: string; name: string; currency: 'USD' | 'TRY' }; role: string; scopes: string[]; isAgent: boolean; isStaff: boolean }>('GET', '/v1/account'),
    tokens: () => this.request<List<ApiToken>>('GET', '/v1/tokens'),
    createToken: (body: { name: string; scopes: string[]; isAgent?: boolean; spendCapMinor?: number; requireApprovalFor?: string[]; projectId?: string; expiresInDays?: number }) => this.request<ApiToken & { token: string }>('POST', '/v1/tokens', body),
    revokeToken: (id: string) => this.request<void>('DELETE', `/v1/tokens/${id}`),
    sshKeys: () => this.request<List<SshKey>>('GET', '/v1/ssh-keys'),
    addSshKey: (body: { name: string; publicKey: string }) => this.request<SshKey>('POST', '/v1/ssh-keys', body),
  };

  readonly catalog = {
    sizes: () => this.request<List<Size>>('GET', '/v1/sizes'),
    images: (kind?: 'distribution' | 'marketplace') => this.request<List<Image>>('GET', '/v1/images', undefined, { kind }),
    regions: () => this.request<List<{ id: string; name: string; country: string }>>('GET', '/v1/regions'),
    pricing: (currency: 'USD' | 'TRY' = 'USD') => this.request<{ currency: string; baseCurrency: 'USD'; fxRate: number; hoursPerMonth: number; data: Price[] }>('GET', '/v1/pricing', undefined, { currency }),
  };

  readonly servers = {
    list: (q?: { project?: string; status?: string; tag?: string }) => this.request<List<Server>>('GET', '/v1/servers', undefined, { project: this.opts.project, ...q }),
    get: (id: string) => this.request<Server>('GET', `/v1/servers/${id}`),
    create: (body: { name: string; size: string; image: string; region?: string; project?: string; sshKeys?: string[]; userData?: string; tags?: string[]; backups?: boolean; firewalls?: string[]; appVariables?: Record<string, string> }) =>
      this.request<Server>('POST', '/v1/servers', { project: this.opts.project, ...body }),
    action: (id: string, body: { type: 'start' | 'stop' | 'reboot' | 'resize' | 'rebuild' | 'snapshot'; size?: string; image?: string; name?: string; force?: boolean }) =>
      this.request<{ id: string; type: string; status: string }>('POST', `/v1/servers/${id}/actions`, body),
    actions: (id: string) => this.request<List<{ id: string; type: string; status: string; startedAt: string; finishedAt: string | null; error: string | null }>>('GET', `/v1/servers/${id}/actions`),
    delete: (id: string) => this.request<{ id: string; status: string }>('DELETE', `/v1/servers/${id}`),
    /** Polls until the server is active, off or failed. Throws on failed. */
    waitUntilActive: async (id: string, opts: { timeoutMs?: number; intervalMs?: number } = {}) => {
      const until = Date.now() + (opts.timeoutMs ?? 180_000);
      for (;;) {
        const s = await this.servers.get(id);
        if (s.status === 'active' || s.status === 'off') return s;
        if (s.status === 'failed') throw new PgcloudError(500, 'server_failed', s.statusMessage ?? 'Server provisioning failed');
        if (Date.now() > until) throw new PgcloudError(504, 'timeout', `Server ${id} is still ${s.status}`);
        await sleep(opts.intervalMs ?? 3000);
      }
    },
  };

  readonly deploys = {
    list: (project?: string) => this.request<List<Deployment>>('GET', '/v1/deploys', undefined, { project: project ?? this.opts.project }),
    get: (id: string) => this.request<Deployment>('GET', `/v1/deploys/${id}`),
    create: (body: { repoUrl?: string; installationId?: string; repo?: string; branch?: string; port?: number; size?: string; env?: Record<string, string>; name?: string; project?: string; gitToken?: string }) =>
      this.request<Deployment & { webhook: { url: string; secret: string } | null }>('POST', '/v1/deploys', { project: this.opts.project, ...body }),
    redeploy: (id: string) => this.request<{ id: string; status: string }>('POST', `/v1/deploys/${id}/redeploy`, {}),
    logs: (id: string) => this.request<{ id: string; status: string; commit: string | null; log: string; updatedAt: string | null; live: boolean }>('GET', `/v1/deploys/${id}/logs`),
  };

  readonly firewalls = {
    list: () => this.request<List<Firewall>>('GET', '/v1/firewalls'),
    get: (id: string) => this.request<Firewall>('GET', `/v1/firewalls/${id}`),
    create: (body: { name: string; rules: FirewallRule[]; project?: string }) => this.request<Firewall>('POST', '/v1/firewalls', { project: this.opts.project, ...body }),
    attach: (id: string, serverId: string) => this.request<void>('POST', `/v1/firewalls/${id}/servers`, { serverId }),
    detach: (id: string, serverId: string) => this.request<void>('DELETE', `/v1/firewalls/${id}/servers/${serverId}`),
    delete: (id: string) => this.request<void>('DELETE', `/v1/firewalls/${id}`),
  };

  readonly snapshots = {
    list: () => this.request<List<Snapshot>>('GET', '/v1/snapshots'),
    delete: (id: string) => this.request<void>('DELETE', `/v1/snapshots/${id}`),
  };

  readonly billing = {
    balance: () => this.request<Balance>('GET', '/v1/billing/balance'),
    usage: (q?: { project?: string; from?: string; to?: string }) => this.request<List<{ resourceType: string; resourceId: string; unit: string; quantity: number; amountMinor: number; currency: string }>>('GET', '/v1/billing/usage', undefined, { project: this.opts.project, ...q }),
    invoices: () => this.request<List<{ id: string; number: string; status: string; totalMinor: number; currency: string; periodStart: string; dueAt: string | null }>>('GET', '/v1/billing/invoices'),
    topup: (amountMinor: number) => this.request<Checkout>('POST', '/v1/billing/topup', { amountMinor }),
    payInvoice: (id: string) => this.request<Checkout>('POST', `/v1/billing/invoices/${id}/pay`, {}),
  };

  readonly approvals = {
    list: (status?: string) => this.request<{ data: Approval[]; pending: number }>('GET', '/v1/approvals', undefined, { status }),
    get: (id: string) => this.request<Approval>('GET', `/v1/approvals/${id}`),
    approve: (id: string) => this.request<Approval>('POST', `/v1/approvals/${id}/approve`, {}),
    deny: (id: string, reason?: string) => this.request<Approval>('POST', `/v1/approvals/${id}/deny`, { reason }),
    /** Polls a pending approval until it is decided or the timeout passes. */
    wait: async (id: string, timeoutMs = 600_000) => {
      const until = Date.now() + timeoutMs;
      for (;;) {
        const a = await this.approvals.get(id);
        if (a.status !== 'pending' || Date.now() > until) return a;
        await sleep(5000);
      }
    },
  };
}

function randomKey() {
  const g = globalThis.crypto as Crypto | undefined;
  return g?.randomUUID ? g.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
function safeJson(t: string) { try { return JSON.parse(t); } catch { return null; } }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
