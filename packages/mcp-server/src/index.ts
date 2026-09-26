#!/usr/bin/env node
/**
 * pgcloud MCP server. Exposes the public API as tools so Claude Code, Cursor, Windsurf or
 * any MCP client can create servers, deploy repositories and read billing.
 *
 * Every call carries the agent token from PGCLOUD_TOKEN (or ~/.config/pgcloud/config.json).
 * The API enforces the token's scopes, monthly spending cap and approval rules, so the
 * agent can never exceed what the account owner allowed. Errors such as
 * spend_limit_reached come back to the agent as plain text it can act on.
 *
 *   claude mcp add pgcloud -e PGCLOUD_TOKEN=pgc_... -- npx -y pgcloud-mcp
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

const VERSION = '0.1.0';

/* ───────────────────────── config ───────────────────────── */

function loadConfig(): { apiUrl: string; token: string } {
  let apiUrl = process.env.PGCLOUD_API_URL ?? '';
  let token = process.env.PGCLOUD_TOKEN ?? '';
  if (!token || !apiUrl) {
    try {
      const path = process.env.XDG_CONFIG_HOME ? join(process.env.XDG_CONFIG_HOME, 'pgcloud', 'config.json') : join(homedir(), '.config', 'pgcloud', 'config.json');
      const cfg = JSON.parse(readFileSync(path, 'utf8')) as { api_url?: string; token?: string };
      apiUrl ||= cfg.api_url ?? '';
      token ||= cfg.token ?? '';
    } catch {
      /* no CLI config; env vars must carry everything */
    }
  }
  if (!token) {
    process.stderr.write('pgcloud-mcp: set PGCLOUD_TOKEN (an agent token from the console or `pgcloud tokens create NAME --agent --cap 15`)\n');
    process.exit(1);
  }
  return { apiUrl: (apiUrl || 'https://api.pgcloud.example').replace(/\/$/, ''), token };
}

const cfg = loadConfig();

/* ───────────────────────── http ───────────────────────── */

class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(cfg.apiUrl + path, {
    method,
    headers: {
      authorization: `Bearer ${cfg.token}`,
      accept: 'application/json',
      'user-agent': `pgcloud-mcp/${VERSION}`,
      ...(body ? { 'content-type': 'application/json', 'idempotency-key': `mcp-${Date.now()}-${Math.random().toString(36).slice(2)}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const e = json?.error ?? { code: 'http_error', message: res.statusText };
    throw new ApiError(res.status, e.code, e.message, e.details);
  }
  return json as T;
}

/** Turns a result or an error into MCP text content. Errors are returned, not thrown, so the agent can read and adapt. */
async function run(fn: () => Promise<unknown>) {
  try {
    const out = await fn();
    return { content: [{ type: 'text' as const, text: typeof out === 'string' ? out : JSON.stringify(out, null, 2) }] };
  } catch (err) {
    if (err instanceof ApiError) {
      const hint: Record<string, string> = {
        spend_limit_reached: 'This token has a monthly spending cap. Pick a smaller size, delete unused servers, or ask the account owner to raise the cap.',
        forbidden: /scope/.test(err.message)
          ? 'This token was not given that scope. Ask the account owner for a token with the scope, or skip this step.'
          : 'This token requires a human to approve this action in the console. Tell the user what you wanted to do and why.',
        approval_required: 'The request was parked for a person to approve in the console. Tell the user what you asked for and the approval id; call get_approval to see the decision, or continue with other work.',
        quota_exceeded: 'The project quota or region capacity is exhausted. Ask the account owner to raise the quota or try a smaller size.',
        verification_required: 'The account owner must verify their phone number or add credit before servers can be created.',
        invalid_state: 'The server is busy with another operation. Check its status and retry when it is active or off.',
      };
      const text = `Error ${err.code} (HTTP ${err.status}): ${err.message}${err.details ? '\nDetails: ' + JSON.stringify(err.details) : ''}${hint[err.code] ? '\n' + hint[err.code] : ''}`;
      return { content: [{ type: 'text' as const, text }], isError: true };
    }
    return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true };
  }
}

const money = (minor: number, currency: string) => `${(minor / 100).toFixed(2)} ${currency}`;

/* ───────────────────────── tools ───────────────────────── */

const server = new McpServer({ name: 'pgcloud', version: VERSION });

server.registerTool('list_servers', {
  title: 'List servers',
  description: 'List the servers in a project with status, public IP, size and image.',
  inputSchema: { project: z.string().optional().describe('Project id or slug. Defaults to "default".') },
}, async ({ project }) => run(async () => {
  const r = await api<{ data: any[] }>('GET', `/v1/servers${project ? `?project=${encodeURIComponent(project)}` : ''}`);
  return r.data.map((s) => ({ id: s.id, name: s.name, status: s.status, ip: s.networks?.v4?.[0]?.ipAddress ?? null, size: s.size?.id, image: s.image?.name, createdAt: s.createdAt }));
}));

server.registerTool('get_server', {
  title: 'Get server',
  description: 'Get one server by id, including status, IPs, size, image and recent actions.',
  inputSchema: { id: z.string() },
}, async ({ id }) => run(async () => {
  const [s, a] = await Promise.all([api('GET', `/v1/servers/${id}`), api<{ data: any[] }>('GET', `/v1/servers/${id}/actions`)]);
  return { ...(s as object), recentActions: a.data.slice(0, 5) };
}));

server.registerTool('list_sizes', {
  title: 'List sizes',
  description: 'Available server sizes with vCPU, memory, disk and price. Prices are in USD unless you pass currency=SAR.',
  inputSchema: { currency: z.enum(['USD', 'SAR']).optional() },
}, async ({ currency }) => run(async () => {
  const p = await api<{ currency: string; fxRate: number; data: any[] }>('GET', `/v1/pricing?currency=${currency ?? 'USD'}`);
  return {
    currency: p.currency,
    exchangeRate: p.fxRate,
    sizes: p.data.filter((x) => x.size).sort((a, b) => a.monthlyMinor - b.monthlyMinor).map((x) => ({ id: x.sku, vcpu: x.size.vcpu, memoryMb: x.size.memoryMb, diskGb: x.size.diskGb, monthly: money(x.monthlyMinor, p.currency), hourly: money(x.hourlyMinor, p.currency) })),
    extras: p.data.filter((x) => !x.size).map((x) => ({ sku: x.sku, unit: x.unit, monthly: x.unit === 'percent' ? `${x.monthlyMinor}% of plan` : money(x.monthlyMinor, p.currency) })),
  };
}));

server.registerTool('list_images', {
  title: 'List images and apps',
  description: 'Operating system images and one click marketplace apps you can create a server from. Use the id (for images) or slug (for apps) as the image argument of create_server.',
  inputSchema: {},
}, async () => run(async () => {
  const [i, a] = await Promise.all([api<{ data: any[] }>('GET', '/v1/images?kind=distribution'), api<{ data: any[] }>('GET', '/v1/apps')]);
  return {
    images: i.data.map((x) => ({ id: x.id, name: x.name })),
    apps: a.data.map((x) => ({ slug: x.slug, name: x.name, category: x.category, minSize: x.minSizeId, variables: x.variables })),
  };
}));

server.registerTool('create_server', {
  title: 'Create server',
  description: 'Create a server. Returns immediately with status "new"; it becomes "active" in about a minute. Call get_server to check. The token\'s monthly spending cap is enforced; a spend_limit_reached error means the plan is too expensive for the remaining cap.',
  inputSchema: {
    name: z.string().regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/).describe('Hostname label, lowercase letters, digits and hyphens'),
    size: z.string().default('s-1vcpu-1gb').describe('Size id from list_sizes'),
    image: z.string().default('ubuntu-24-04').describe('Image id or marketplace app slug from list_images'),
    project: z.string().optional(),
    userData: z.string().optional().describe('cloud-init user data'),
    appVariables: z.record(z.string()).optional().describe('Variables for a marketplace app, e.g. { admin_email: "..." }'),
    tags: z.array(z.string()).optional(),
    backups: z.boolean().optional().describe('Enable backups at 20% of the plan price'),
    wait: z.boolean().default(true).describe('Wait up to 2 minutes for the server to become active'),
  },
}, async ({ wait, ...body }) => run(async () => {
  const keys = await api<{ data: { id: string }[] }>('GET', '/v1/ssh-keys').catch(() => ({ data: [] }));
  let s = await api<any>('POST', '/v1/servers', { ...body, sshKeys: keys.data.map((k) => k.id) });
  if (wait) {
    const until = Date.now() + 120_000;
    while (Date.now() < until && !['active', 'failed', 'off'].includes(s.status)) {
      await new Promise((r) => setTimeout(r, 3000));
      s = await api<any>('GET', `/v1/servers/${s.id}`);
    }
  }
  return { id: s.id, name: s.name, status: s.status, ip: s.networks?.v4?.[0]?.ipAddress ?? null, statusMessage: s.statusMessage, ssh: s.networks?.v4?.[0] ? `ssh root@${s.networks.v4[0].ipAddress}` : undefined };
}));

server.registerTool('server_action', {
  title: 'Server action',
  description: 'Start, stop, reboot, resize, rebuild or snapshot a server. Some actions (resize down, rebuild) may require a human to approve them depending on the token.',
  inputSchema: {
    id: z.string(),
    action: z.enum(['start', 'stop', 'reboot', 'resize', 'rebuild', 'snapshot']),
    size: z.string().optional().describe('For resize: target size id'),
    image: z.string().optional().describe('For rebuild: image id'),
    name: z.string().optional().describe('For snapshot: a name'),
  },
}, async ({ id, action, ...rest }) => run(() => api('POST', `/v1/servers/${id}/actions`, { type: action, ...rest })));

server.registerTool('delete_server', {
  title: 'Delete server',
  description: 'Permanently delete a server. Most agent tokens require a human to approve this; if so the API returns an error explaining that.',
  inputSchema: { id: z.string(), confirm: z.literal(true).describe('Must be true. Ask the user before calling.') },
}, async ({ id }) => run(() => api('DELETE', `/v1/servers/${id}`)));

server.registerTool('deploy_repository', {
  title: 'Deploy a Git repository',
  description: 'Create a server that clones a repository, builds it (Dockerfile or docker-compose.yml) and serves it on port 80. Give repoUrl for a public repository, or installationId plus repo ("owner/name") from list_github_repos for any repository the GitHub App can see; app deployments redeploy on every push with no webhook setup.',
  inputSchema: {
    repoUrl: z.string().url().optional().describe('Public https repository URL'),
    installationId: z.string().optional().describe('From list_github_repos'),
    repo: z.string().optional().describe('"owner/name", with installationId'),
    branch: z.string().default('main'),
    port: z.number().int().min(1).max(65535).default(3000).describe('Port the app listens on inside the container'),
    size: z.string().optional(),
    env: z.record(z.string()).optional(),
    name: z.string().optional(),
    project: z.string().optional(),
  },
}, async (body) => run(() => api('POST', '/v1/deploys', body)));

server.registerTool('list_deployments', {
  title: 'List deployments',
  description: 'List Git deployments with status, URL and last commit.',
  inputSchema: { project: z.string().optional() },
}, async ({ project }) => run(async () => (await api<{ data: unknown[] }>('GET', `/v1/deploys${project ? `?project=${encodeURIComponent(project)}` : ''}`)).data));

server.registerTool('redeploy', {
  title: 'Redeploy',
  description: 'Pull the latest commit and rebuild a deployment now.',
  inputSchema: { id: z.string() },
}, async ({ id }) => run(() => api('POST', `/v1/deploys/${id}/redeploy`, {})));

server.registerTool('deploy_logs', {
  title: 'Deployment build log',
  description: 'Tail of the last build log of a deployment plus its status and commit. Use it to see why a build failed.',
  inputSchema: { id: z.string() },
}, async ({ id }) => run(async () => {
  const l = await api<{ status: string; commit: string | null; log: string; live: boolean }>('GET', `/v1/deploys/${id}/logs`);
  return `status: ${l.status}${l.commit ? ` commit: ${l.commit.slice(0, 7)}` : ''}${l.live ? '' : ' (cached)'}\n\n${l.log || '(no build log yet)'}`;
}));

server.registerTool('list_github_repos', {
  title: 'List GitHub repositories',
  description: 'Repositories reachable through the team\'s GitHub App installations, for deploy_repository with installationId and repo. Empty when the team has not connected GitHub.',
  inputSchema: {},
}, async () => run(async () => {
  const inst = await api<{ data: { id: string; accountLogin: string }[] }>('GET', '/v1/github/installations');
  const out: unknown[] = [];
  for (const i of inst.data) {
    const r = await api<{ data: { fullName: string; private: boolean; defaultBranch: string }[] }>('GET', `/v1/github/installations/${i.id}/repos`);
    out.push({ installationId: i.id, account: i.accountLogin, repos: r.data.map((x) => ({ repo: x.fullName, private: x.private, defaultBranch: x.defaultBranch })) });
  }
  return out;
}));

server.registerTool('get_billing', {
  title: 'Billing balance',
  description: 'Credit balance, month to date spend and the account status. Also useful to know what this token can still spend.',
  inputSchema: {},
}, async () => run(async () => {
  const [b, me] = await Promise.all([api<any>('GET', '/v1/billing/balance'), api<any>('GET', '/v1/account')]);
  const tokens = await api<{ data: any[] }>('GET', '/v1/tokens').catch(() => ({ data: [] }));
  const mine = tokens.data.find((t) => t.isAgent && t.spendCapMinor != null);
  return {
    currency: b.currency,
    credit: money(b.creditMinor, b.currency),
    monthToDate: money(b.monthToDateMinor, b.currency),
    accountStatus: b.status,
    team: me.team?.slug,
    scopes: me.scopes,
    tokenCap: mine ? { cap: money(mine.spendCapMinor, b.currency), spent: money(mine.spentThisMonthMinor, b.currency), requiresApprovalFor: mine.requireApprovalFor } : 'not visible with this token',
  };
}));

server.registerTool('get_approval', {
  title: 'Check an approval',
  description: 'Check whether a person has approved a parked request (from an approval_required error). With wait=true, polls for up to 10 minutes. Status is pending, approved, denied, expired or failed; an approved request has already run.',
  inputSchema: { id: z.string(), wait: z.boolean().default(false) },
}, async ({ id, wait }) => run(async () => {
  const until = Date.now() + 10 * 60_000;
  let a = await api<any>('GET', `/v1/approvals/${id}`);
  while (wait && a.status === 'pending' && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 5000));
    a = await api<any>('GET', `/v1/approvals/${id}`);
  }
  return { id: a.id, status: a.status, summary: a.summary, reason: a.reason, decidedBy: a.decidedBy?.name ?? null, result: a.result ?? null, expiresAt: a.expiresAt };
}));

server.registerTool('list_firewalls', {
  title: 'List firewalls',
  description: 'Firewalls in the project with their rules and attached servers.',
  inputSchema: { project: z.string().optional() },
}, async ({ project }) => run(async () => (await api<{ data: unknown[] }>('GET', `/v1/firewalls${project ? `?project=${encodeURIComponent(project)}` : ''}`)).data));

server.registerTool('list_volumes', {
  title: 'List volumes',
  description: 'Block volumes in the project: size, status and which server each is attached to.',
  inputSchema: { project: z.string().optional(), server: z.string().optional().describe('Only volumes attached to this server id') },
}, async ({ project, server: srv }) => run(async () => (await api<{ data: unknown[] }>('GET', `/v1/volumes?${new URLSearchParams({ ...(project ? { project } : {}), ...(srv ? { server: srv } : {}) })}`)).data));

server.registerTool('create_volume', {
  title: 'Create a volume',
  description: 'Creates a block volume (10 GB to 16 TB, billed per GB per month) and optionally attaches it to a server in the same region. The guest sees it at the returned device path; format and mount it there.',
  inputSchema: { name: z.string().regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/), sizeGb: z.number().int().min(10).max(16384), serverId: z.string().optional(), project: z.string().optional() },
}, async (input) => run(() => api('POST', '/v1/volumes', input)));

server.registerTool('volume_action', {
  title: 'Attach, detach, resize or delete a volume',
  description: 'attach needs serverId; resize needs sizeGb (grow only, live when attached); delete needs the volume detached and destroys its data.',
  inputSchema: { volumeId: z.string(), action: z.enum(['attach', 'detach', 'resize', 'delete']), serverId: z.string().optional(), sizeGb: z.number().int().min(10).max(16384).optional() },
}, async ({ volumeId, action, serverId, sizeGb }) => run(async () => {
  if (action === 'delete') return api('DELETE', `/v1/volumes/${volumeId}`);
  if (action === 'attach') return api('POST', `/v1/volumes/${volumeId}/attach`, { serverId });
  if (action === 'resize') return api('POST', `/v1/volumes/${volumeId}/resize`, { sizeGb });
  return api('POST', `/v1/volumes/${volumeId}/detach`, {});
}));

server.registerTool('list_load_balancers', {
  title: 'List load balancers',
  description: 'Load balancers in the project with their IP, forwarding rules and target health.',
  inputSchema: { project: z.string().optional() },
}, async ({ project }) => run(async () => (await api<{ data: unknown[] }>('GET', `/v1/load-balancers${project ? `?project=${encodeURIComponent(project)}` : ''}`)).data));

server.registerTool('create_load_balancer', {
  title: 'Create a load balancer',
  description: 'Creates a managed HAProxy load balancer with its own public IP in front of servers. Each forwarding rule maps an entry port (http, https with a certificateId, or tcp) to a target port. Billed per node per month. Point DNS at the returned ip.',
  inputSchema: {
    name: z.string().regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/),
    forwardingRules: z.array(z.object({ entryProtocol: z.enum(['http', 'https', 'tcp']), entryPort: z.number().int(), targetProtocol: z.enum(['http', 'tcp']), targetPort: z.number().int(), certificateId: z.string().optional() })).min(1),
    serverIds: z.array(z.string()).optional(), tag: z.string().optional().describe('Servers with this tag become targets automatically'),
    nodes: z.number().int().min(1).max(3).optional(), algorithm: z.enum(['round_robin', 'least_conn']).optional(), redirectHttpToHttps: z.boolean().optional(),
    healthCheck: z.object({ protocol: z.enum(['http', 'tcp']).optional(), port: z.number().int().optional(), path: z.string().optional() }).optional(),
    project: z.string().optional(),
  },
}, async (input) => run(() => api('POST', '/v1/load-balancers', input)));

server.registerTool('load_balancer_servers', {
  title: 'Add or remove load balancer targets',
  description: 'add attaches servers to the load balancer; remove detaches one.',
  inputSchema: { loadBalancerId: z.string(), action: z.enum(['add', 'remove']), serverIds: z.array(z.string()).min(1) },
}, async ({ loadBalancerId, action, serverIds }) => run(async () => {
  if (action === 'add') return api('POST', `/v1/load-balancers/${loadBalancerId}/servers`, { serverIds });
  for (const s of serverIds) await api('DELETE', `/v1/load-balancers/${loadBalancerId}/servers/${s}`);
  return api('GET', `/v1/load-balancers/${loadBalancerId}`);
}));

server.registerTool('delete_load_balancer', {
  title: 'Delete a load balancer',
  description: 'Deletes the load balancer, its nodes and releases its IP. Target servers are untouched.',
  inputSchema: { loadBalancerId: z.string() },
}, async ({ loadBalancerId }) => run(() => api('DELETE', `/v1/load-balancers/${loadBalancerId}`)));

server.registerTool('list_domains', {
  title: 'List DNS zones',
  description: 'Hosted DNS zones in the project and the nameservers to set at the registrar. Pass name to get one zone with its records.',
  inputSchema: { name: z.string().optional(), project: z.string().optional() },
}, async ({ name, project }) => run(() => name ? api('GET', `/v1/domains/${name}`) : api('GET', `/v1/domains${project ? `?project=${encodeURIComponent(project)}` : ''}`)));

server.registerTool('create_domain', {
  title: 'Add a DNS zone',
  description: 'Hosts a domain on pgcloud nameservers (free). Optionally creates an apex A record pointing at ip, for example a server or load balancer address.',
  inputSchema: { name: z.string(), ip: z.string().optional(), project: z.string().optional() },
}, async (input) => run(() => api('POST', '/v1/domains', input)));

server.registerTool('dns_record', {
  title: 'Add, change or delete a DNS record',
  description: 'add needs type and content (A: IPv4, AAAA: IPv6, CNAME/MX/NS: hostname, TXT: text, SRV: "weight port target", CAA: "flags tag value"); update and delete need recordId. Name is relative to the zone, "@" for the apex. Changes are live within seconds.',
  inputSchema: { zone: z.string(), action: z.enum(['add', 'update', 'delete']), recordId: z.string().optional(), name: z.string().optional(), type: z.enum(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA']).optional(), content: z.string().optional(), ttl: z.number().int().optional(), priority: z.number().int().optional() },
}, async ({ zone, action, recordId, ...body }) => run(async () => {
  if (action === 'add') return api('POST', `/v1/domains/${zone}/records`, body);
  if (!recordId) throw new Error('recordId is required');
  if (action === 'delete') return api('DELETE', `/v1/domains/${zone}/records/${recordId}`);
  return api('PATCH', `/v1/domains/${zone}/records/${recordId}`, body);
}));

server.registerTool('list_buckets', {
  title: 'List object storage buckets',
  description: 'S3 compatible buckets in the project with size, object count and the S3 endpoint. Pass name and an optional prefix to list objects in one bucket.',
  inputSchema: { name: z.string().optional(), prefix: z.string().optional(), project: z.string().optional() },
}, async ({ name, prefix, project }) => run(() => name ? api('GET', `/v1/buckets/${name}/objects?prefix=${encodeURIComponent(prefix ?? '')}`) : api('GET', `/v1/buckets${project ? `?project=${encodeURIComponent(project)}` : ''}`)));

server.registerTool('create_bucket', {
  title: 'Create a bucket',
  description: 'Creates an S3 compatible bucket (name is global, 3 to 63 lowercase letters, digits and hyphens). Billed per GB per month. public makes objects readable by anyone.',
  inputSchema: { name: z.string().regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/), public: z.boolean().optional(), project: z.string().optional() },
}, async (input) => run(() => api('POST', '/v1/buckets', input)));

server.registerTool('bucket_presign', {
  title: 'Presigned URL for an object',
  description: 'Returns a short lived URL to GET, PUT or DELETE one object without S3 keys. Use PUT to upload a file, GET to hand a download link to the user.',
  inputSchema: { bucket: z.string(), key: z.string(), method: z.enum(['GET', 'PUT', 'DELETE']).optional(), expiresSeconds: z.number().int().min(60).max(604800).optional(), contentType: z.string().optional() },
}, async ({ bucket, ...body }) => run(() => api('POST', `/v1/buckets/${bucket}/presign`, body)));

server.registerTool('create_storage_key', {
  title: 'Create S3 access key',
  description: 'Creates an access key pair for every bucket in the project. The secret is returned once; give it to the user, never store it in the conversation longer than needed.',
  inputSchema: { name: z.string(), project: z.string().optional() },
}, async (input) => run(() => api('POST', '/v1/storage-keys', input)));

/* ───────────────────────── start ───────────────────────── */

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`pgcloud-mcp ${VERSION} connected to ${cfg.apiUrl}\n`);
