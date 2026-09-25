import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ApiError } from '../../common/errors/api-error';

/** Public IPv4 pool. IPs come from IpBlock rows (own RIPE block or leased). */
@Injectable()
export class IpsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Atomically reserves a free IP in the region for a project. */
  async reserve(regionId: string, projectId: string, serverId?: string) {
    // `updateMany` on a single free row is our compare-and-swap.
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = await this.prisma.publicIp.findFirst({ where: { regionId, status: 'free' }, orderBy: { address: 'asc' } });
      if (!candidate) throw ApiError.quota('No public IPs available in this region', { region: regionId, code: 'no_public_ips' });
      const r = await this.prisma.publicIp.updateMany({
        where: { id: candidate.id, status: 'free' },
        data: { status: serverId ? 'assigned' : 'reserved', projectId, serverId, assignedAt: serverId ? new Date() : null },
      });
      if (r.count === 1) return this.prisma.publicIp.findUniqueOrThrow({ where: { id: candidate.id }, include: { block: true } });
    }
    throw new Error('could not reserve a public IP after 5 attempts');
  }

  async release(ipId: string) {
    await this.prisma.publicIp.update({
      where: { id: ipId },
      data: { status: 'free', projectId: null, serverId: null, assignedAt: null, reverseDns: null, floating: false },
    });
  }

  async releaseForServer(serverId: string) {
    const ips = await this.prisma.publicIp.findMany({ where: { serverId } });
    for (const ip of ips) {
      if (ip.floating) {
        await this.prisma.publicIp.update({ where: { id: ip.id }, data: { serverId: null, status: 'reserved' } });
      } else {
        await this.release(ip.id);
      }
    }
  }

  list(projectId: string) {
    return this.prisma.publicIp.findMany({ where: { projectId }, orderBy: { address: 'asc' } });
  }

  static prefixOf(cidr: string) {
    return Number(cidr.split('/')[1]);
  }
}
