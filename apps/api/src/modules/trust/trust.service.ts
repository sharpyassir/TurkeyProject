import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ApiError } from '../../common/errors/api-error';
import { EventsService } from '../events/events.service';
import { NatsService, Subjects } from '../../common/nats/nats.service';

/**
 * Trust & safety: pre-flight checks before any resource is created, plus the hooks
 * AI-ops / abuse reports use to flag and suspend accounts.
 */
@Injectable()
export class TrustService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService, private readonly nats: NatsService) {}

  /** Throws if the team may not create resources right now. */
  async assertCanProvision(teamId: string) {
    const team = await this.prisma.team.findUniqueOrThrow({ where: { id: teamId }, include: { credits: true, abuseFlags: { where: { resolvedAt: null } } } });
    if (team.status === 'suspended') throw new ApiError(403, 'account_suspended', 'This account is suspended. Contact support.');
    if (team.status === 'closed') throw new ApiError(403, 'account_closed', 'This account is closed.');
    if (team.abuseFlags.some((f) => f.score >= 80)) throw new ApiError(403, 'account_under_review', 'This account is under review. Contact support.');

    // Owners must confirm their email; new accounts also need a verified phone/ID or prepaid credit.
    const owner = await this.prisma.teamMember.findFirst({ where: { teamId, role: 'owner' }, include: { user: { select: { emailVerified: true } } } });
    if (owner && !owner.user.emailVerified) throw new ApiError(403, 'email_unverified', 'Confirm your email address first. Check your inbox for the link, or request a new one.');
    if (team.status === 'pending_verification') {
      const prepaid = team.credits.reduce((s, c) => s + (c.kind === 'prepaid' ? c.remainingMinor : 0), 0);
      if (team.kycLevel < 1 && prepaid <= 0) {
        throw new ApiError(403, 'verification_required', 'Verify your phone number or add prepaid credit before creating servers.');
      }
    }
  }

  /** Outbound bandwidth cap for accounts with no verification history (anti-spam). */
  async outboundLimitMbps(teamId: string): Promise<number | null> {
    const team = await this.prisma.team.findUniqueOrThrow({ where: { id: teamId } });
    return team.kycLevel >= 2 ? null : 100;
  }

  async flag(input: { teamId: string; serverId?: string; kind: 'mining' | 'spam' | 'scanning' | 'ddos_source' | 'phishing' | 'payment_fraud' | 'report'; score: number; evidence?: Record<string, unknown>; source: string }) {
    const flag = await this.prisma.abuseFlag.create({ data: { ...input, evidence: (input.evidence ?? {}) as Prisma.InputJsonValue } });
    await this.prisma.team.update({ where: { id: input.teamId }, data: { riskScore: { increment: input.score } } });
    await this.events.emit('abuse.flagged', { flagId: flag.id, kind: input.kind, score: input.score }, { teamId: input.teamId });
    if (input.score >= 90) await this.suspend(input.teamId, `automatic: ${input.kind}`);
    return flag;
  }

  async suspend(teamId: string, reason: string) {
    await this.prisma.team.update({ where: { id: teamId }, data: { status: 'suspended' } });
    // Servers are powered off, not deleted, so a false positive is recoverable.
    const servers = await this.prisma.server.findMany({ where: { project: { teamId }, status: 'active' } });
    await this.prisma.server.updateMany({ where: { id: { in: servers.map((s) => s.id) } }, data: { status: 'suspended', statusMessage: reason } });
    for (const s of servers) this.nats.publish(Subjects.event('server.suspend_requested'), { serverId: s.id });
    await this.events.emit('account.suspended', { reason }, { teamId });
  }

  async reinstate(teamId: string) {
    await this.prisma.team.update({ where: { id: teamId }, data: { status: 'active' } });
    await this.prisma.server.updateMany({ where: { project: { teamId }, status: 'suspended' }, data: { status: 'off', statusMessage: null } });
    await this.events.emit('account.reinstated', {}, { teamId });
  }
}
