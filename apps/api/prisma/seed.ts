/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { MARKETPLACE_APPS } from './seed-apps';

const prisma = new PrismaClient();

/** Launch price book is valid from the start of the launch year so back-dated usage rates. */
const PRICE_VALID_FROM = new Date(Date.UTC(2026, 0, 1));

/**
 * Prices in USD cents. The ladder mirrors DigitalOcean's Basic Droplets (docs/competitors.md).
 * Riyal prices are never stored: FxService converts at the current USD→SAR rate.
 */
const SIZES = [
  { id: 's-1vcpu-512mb', vcpu: 1, memoryMb: 512, diskGb: 10, transferTb: 0.5, usd: 400 },
  { id: 's-1vcpu-1gb', vcpu: 1, memoryMb: 1024, diskGb: 25, transferTb: 1, usd: 600 },
  { id: 's-1vcpu-2gb', vcpu: 1, memoryMb: 2048, diskGb: 50, transferTb: 2, usd: 1200 },
  { id: 's-2vcpu-2gb', vcpu: 2, memoryMb: 2048, diskGb: 60, transferTb: 3, usd: 1800 },
  { id: 's-2vcpu-4gb', vcpu: 2, memoryMb: 4096, diskGb: 80, transferTb: 4, usd: 2400 },
  { id: 's-4vcpu-8gb', vcpu: 4, memoryMb: 8192, diskGb: 160, transferTb: 5, usd: 4800 },
  { id: 's-8vcpu-16gb', vcpu: 8, memoryMb: 16384, diskGb: 320, transferTb: 6, usd: 9600 },
];

const DISTROS = [
  { id: 'ubuntu-24-04', name: 'Ubuntu 24.04 LTS', distribution: 'ubuntu', version: '24.04', driverRef: '{"template":9000}' },
  { id: 'ubuntu-22-04', name: 'Ubuntu 22.04 LTS', distribution: 'ubuntu', version: '22.04', driverRef: '{"template":9001}' },
  { id: 'debian-12', name: 'Debian 12', distribution: 'debian', version: '12', driverRef: '{"template":9002}' },
  { id: 'rocky-9', name: 'Rocky Linux 9', distribution: 'rocky', version: '9', driverRef: '{"template":9003}' },
];

async function main() {
  await prisma.region.upsert({ where: { id: 'sa1' }, update: {}, create: { id: 'sa1', name: 'Saudi Arabia 1', country: 'SA' } });

  for (const [i, s] of SIZES.entries()) {
    await prisma.size.upsert({ where: { id: s.id }, update: {}, create: { id: s.id, vcpu: s.vcpu, memoryMb: s.memoryMb, diskGb: s.diskGb, transferTb: s.transferTb, sortOrder: i } });
    const exists = await prisma.price.findFirst({ where: { resourceType: 'server', sku: s.id, currency: 'USD', validTo: null } });
    if (!exists) await prisma.price.create({ data: { resourceType: 'server', sku: s.id, sizeId: s.id, currency: 'USD', monthlyMinor: s.usd, validFrom: PRICE_VALID_FROM } });
  }
  // Managed database nodes: twice the plan price of the same size, per node.
  for (const s of SIZES) {
    const sku = `db-${s.id}`;
    const exists = await prisma.price.findFirst({ where: { resourceType: 'database', sku, currency: 'USD', validTo: null } });
    if (!exists) await prisma.price.create({ data: { resourceType: 'database', sku, sizeId: s.id, currency: 'USD', monthlyMinor: s.usd * 2, validFrom: PRICE_VALID_FROM } });
  }
  for (const [sku, type, usd] of [
    ['public_ip', 'public_ip', 300],
    ['snapshot_gb', 'snapshot', 6],
    ['volume_gb', 'volume', 10],
    ['lb_node', 'load_balancer', 1200],
    ['storage_gb', 'object_storage', 2],
    ['bandwidth_gb', 'bandwidth', 1],
    // Backups: 20% of the server's monthly price (DigitalOcean weekly backup model). Stored as
    // percent in monthlyMinor with unit "percent"; RatingService applies it per server hour.
    ['backups_pct', 'backup', 20],
    // Managed tier: 30% of the server's monthly price, same percent mechanism.
    ['managed_pct', 'managed_server', 30],
    // Support plans: flat monthly, billed against the team's default project.
    ['support-developer', 'support', 2400],
    ['support-standard', 'support', 9900],
    ['support-premium', 'support', 49900],
  ] as const) {
    const exists = await prisma.price.findFirst({ where: { resourceType: type, sku, currency: 'USD', validTo: null } });
    if (!exists) await prisma.price.create({ data: { resourceType: type, sku, currency: 'USD', monthlyMinor: usd, unit: sku.endsWith('_pct') ? 'percent' : sku.startsWith('support-') ? 'month' : 'hour', validFrom: PRICE_VALID_FROM } });
  }

  // Starting exchange rate; the hourly job replaces it with the provider's rate.
  if (!(await prisma.fxRate.findFirst({ where: { quote: 'SAR' } }))) {
    await prisma.fxRate.create({ data: { base: 'USD', quote: 'SAR', rate: 3.75, source: 'seed' } });
  }

  for (const d of DISTROS) {
    await prisma.image.upsert({ where: { id: d.id }, update: {}, create: { ...d, kind: 'distribution' } });
  }

  for (const app of MARKETPLACE_APPS) {
    const imageId = `app-${app.slug}`;
    await prisma.image.upsert({
      where: { id: imageId },
      update: {},
      create: { id: imageId, kind: 'marketplace', name: `${app.name} on Ubuntu 24.04`, distribution: 'ubuntu', version: '24.04', driverRef: `{"template":${9100 + MARKETPLACE_APPS.indexOf(app)}}`, minMemoryMb: 1024 },
    });
    await prisma.marketplaceApp.upsert({
      where: { id: app.slug },
      update: { version: app.version, cloudInit: app.cloudInit, variables: app.variables, status: 'published' },
      create: { id: app.slug, imageId, slug: app.slug, name: app.name, category: app.category, summary: app.summary, description: app.description, version: app.version, minSizeId: app.minSizeId, ports: app.ports, variables: app.variables, cloudInit: app.cloudInit, status: 'published', publishedAt: new Date() },
    });
  }

  // A fake host + a /28 of public IPs so the fake driver can provision.
  const host = await prisma.host.upsert({
    where: { name: 'fake1' },
    update: {},
    create: { name: 'fake1', regionId: 'sa1', driver: 'fake', driverRef: '{"node":"fake1"}', totalVcpu: 64, totalMemoryMb: 262144, totalDiskGb: 4000, overcommitCpu: 4 },
  });
  await prisma.host.update({ where: { id: host.id }, data: { driverRef: JSON.stringify({ node: 'fake1', hostId: host.id }) } });

  const block = await prisma.ipBlock.upsert({ where: { cidr: '203.0.113.0/28' }, update: {}, create: { regionId: 'sa1', cidr: '203.0.113.0/28', gateway: '203.0.113.1' } });
  for (let i = 2; i < 15; i++) {
    const address = `203.0.113.${i}`;
    await prisma.publicIp.upsert({ where: { address }, update: {}, create: { regionId: 'sa1', blockId: block.id, address } });
  }

  // Dev user + team + token
  const email = 'dev@pgcloud.local';
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: 'Dev User',
        isStaff: true, // so the seeded admin token works locally
        emailVerified: new Date(),
        passwordHash: await argon2.hash('devpassword123'),
        memberships: { create: { role: 'owner', team: { create: { name: 'Dev Team', slug: 'dev', country: 'SA', currency: 'SAR', status: 'active', kycLevel: 1, projects: { create: { name: 'Default', slug: 'default' } } } } } },
      },
    });
    const team = await prisma.team.findUniqueOrThrow({ where: { slug: 'dev' } });
    await prisma.credit.create({ data: { teamId: team.id, kind: 'promo', currency: 'SAR', amountMinor: 37500, remainingMinor: 37500, reason: 'dev seed ($100 at 3.75)' } });
    const raw = 'pgc_' + randomBytes(32).toString('base64url');
    await prisma.apiToken.create({
      data: { teamId: team.id, userId: user.id, name: 'dev', prefix: raw.slice(0, 12), hash: createHash('sha256').update(raw).digest('hex'), scopes: ['servers:read', 'servers:write', 'servers:delete', 'images:read', 'snapshots:read', 'snapshots:write', 'volumes:read', 'volumes:write', 'dns:read', 'dns:write', 'storage:read', 'storage:write', 'databases:read', 'databases:write', 'network:read', 'network:write', 'apps:read', 'billing:read', 'billing:write', 'support:read', 'support:write', 'iam:read', 'iam:write'] },
    });
    const admin = 'pgc_' + randomBytes(32).toString('base64url');
    await prisma.apiToken.create({ data: { teamId: team.id, userId: user.id, name: 'staff-admin', prefix: admin.slice(0, 12), hash: createHash('sha256').update(admin).digest('hex'), scopes: ['admin'] } });
    console.log(`\nDev login:   ${email} / devpassword123`);
    console.log(`Dev token:   export PGCLOUD_TOKEN=${raw}`);
    console.log(`Admin token: export PGCLOUD_ADMIN_TOKEN=${admin}\n`);
  }
  console.log('seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
