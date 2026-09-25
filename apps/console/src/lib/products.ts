/**
 * The full product surface, grouped like DigitalOcean's menu. `href` = live today;
 * `phase` = roadmap item that opens the "coming soon / register interest" page.
 * Source of truth for the roadmap: docs/product-catalog.md.
 */
export type Phase = 'mvp' | 2 | 3;

export interface Product {
  slug: string;
  name: string;
  group: 'Compute' | 'AI' | 'Data' | 'Networking' | 'Storage' | 'Observability';
  href?: string;
  phase?: Phase;
  blurb: string;
}

export const PRODUCTS: Product[] = [
  // Compute
  { slug: 'servers', name: 'Servers', group: 'Compute', href: '/servers', blurb: 'KVM virtual machines in Istanbul, billed hourly, capped monthly.' },
  { slug: 'apps', name: 'Marketplace', group: 'Compute', href: '/apps', blurb: 'One-click apps: WordPress, n8n, Odoo, Coolify, AI starter and more.' },
  { slug: 'gpu-servers', name: 'GPU Servers', group: 'Compute', phase: 3, blurb: 'Hourly GPU nodes for inference and fine-tuning.' },
  { slug: 'kubernetes', name: 'Kubernetes', group: 'Compute', phase: 3, blurb: 'Managed Kubernetes clusters on pgcloud servers.' },
  // AI
  { slug: 'agents', name: 'Agent Access', group: 'AI', href: '/agents', blurb: 'Agent-safe API tokens: scopes, monthly spend caps, human approval for destructive actions.' },
  { slug: 'mcp', name: 'MCP Server', group: 'AI', phase: 2, blurb: 'Use pgcloud as tools from Claude, Cursor or any MCP client.' },
  { slug: 'approvals', name: 'Approval Queue', group: 'AI', phase: 2, blurb: 'Review and approve actions your agents request before they run.' },
  { slug: 'inference', name: 'Inference Gateway', group: 'AI', phase: 3, blurb: 'One OpenAI-compatible endpoint, billed per token in TRY or USD.' },
  { slug: 'dedicated-inference', name: 'Dedicated Inference', group: 'AI', phase: 3, blurb: 'Your own model endpoint on a GPU server.' },
  // Data
  { slug: 'databases', name: 'Managed Databases', group: 'Data', phase: 3, blurb: 'PostgreSQL (with pgvector), MySQL and Redis with automated backups.' },
  { slug: 'caching', name: 'Caching', group: 'Data', phase: 3, blurb: 'Managed Redis / Valkey.' },
  // Networking
  { slug: 'firewalls', name: 'Firewalls', group: 'Networking', href: '/firewalls', blurb: 'Host-enforced firewall rules, attached to any server.' },
  { slug: 'public-ips', name: 'Public IPs', group: 'Networking', href: '/public-ips', blurb: 'IPv4 addresses from our Istanbul blocks; floating IPs in phase 2.' },
  { slug: 'vpc', name: 'VPC', group: 'Networking', phase: 2, blurb: 'Isolated private networks per project (VXLAN / EVPN).' },
  { slug: 'load-balancers', name: 'Load Balancers', group: 'Networking', phase: 2, blurb: 'Managed HAProxy with automatic TLS.' },
  { slug: 'dns', name: 'DNS', group: 'Networking', phase: 2, blurb: 'API-managed zones and reverse DNS, free with your account.' },
  // Storage
  { slug: 'snapshots', name: 'Snapshots', group: 'Storage', href: '/snapshots', blurb: 'Point-in-time copies of a server, $0.06 / GB-month class pricing.' },
  { slug: 'volumes', name: 'Block Volumes', group: 'Storage', phase: 2, blurb: 'Ceph-backed volumes you attach and detach from servers.' },
  { slug: 'object-storage', name: 'Object Storage', group: 'Storage', phase: 3, blurb: 'S3-compatible buckets in Istanbul.' },
  // Observability
  { slug: 'monitoring', name: 'Monitoring & Alerts', group: 'Observability', phase: 2, blurb: 'Metrics from every server, alert rules to email, SMS or webhook.' },
  { slug: 'webhooks', name: 'Webhooks', group: 'Observability', href: '/webhooks', blurb: 'Signed event deliveries: server.active, invoice.issued, spend.limit_reached…' },
];

export const GROUPS = ['Compute', 'AI', 'Data', 'Networking', 'Storage', 'Observability'] as const;

export function phaseLabel(p: Phase) {
  return p === 'mvp' ? 'MVP' : `Phase ${p}`;
}
