import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  NATS_URL: z.string().default('nats://localhost:4222'),
  TEMPORAL_ADDRESS: z.string().default('localhost:7233'),
  TEMPORAL_NAMESPACE: z.string().default('default'),
  TEMPORAL_TASK_QUEUE: z.string().default('pgcloud-control-plane'),
  HYPERVISOR_DRIVER: z.enum(['fake', 'proxmox']).default('fake'),
  PROXMOX_CEPH_POOL: z.string().default('vm-disks'),
  PROXMOX_VXLAN_ZONE: z.string().default('customers'),
  JWT_SECRET: z.string().min(16).default('dev-only-secret-change-me'),
  SESSION_TTL_SECONDS: z.coerce.number().default(86400),
  BILLING_HOURS_PER_MONTH: z.coerce.number().default(672),
  DEFAULT_CURRENCY: z.enum(['USD', 'TRY']).default('USD'),
  DEFAULT_REGION: z.string().default('ist1'),
  /** Fallback USD→TRY rate when no FxRate row exists yet. */
  FX_USD_TRY: z.coerce.number().positive().default(41),
  /** JSON endpoint returning { rates: { TRY: number } } for USD. */
  PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
  /** GitHub App for Git Deploy (optional; without it customers paste a repository URL and token). */
  GITHUB_APP_ID: z.coerce.number().optional(),
  GITHUB_APP_SLUG: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  GITHUB_APP_WEBHOOK_SECRET: z.string().optional(),
  CONSOLE_URL: z.string().url().default('http://localhost:3000'),
  MAIL_PROVIDER: z.enum(['log', 'postmark', 'resend']).default('log'),
  MAIL_FROM: z.string().default('pgcloud <no-reply@pgcloud.example>'),
  MAIL_API_KEY: z.string().optional(),
  /** When true, team owners must enable two factor sign in before using the console. */
  REQUIRE_TOTP_FOR_OWNERS: z.coerce.boolean().default(false),
  FX_PROVIDER_URL: z.string().url().default('https://open.er-api.com/v6/latest/USD'),
});

export type AppConfig = z.infer<typeof schema>;

let cached: AppConfig | undefined;

/** Parsed, validated environment. Fails fast at boot on a bad config. */
export function loadConfig(): AppConfig {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}
