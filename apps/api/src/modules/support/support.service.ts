import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ApiError } from '../../common/errors/api-error';
import { cursorArgs, toPage } from '../../common/pagination';
import { MailService } from '../../common/mail/mail.service';
import type { Actor } from '../../common/auth/actor';
import { loadConfig } from '../../config/config';
import { EventsService } from '../events/events.service';
import { SpendService } from '../billing/spend.service';
import { FxService } from '../billing/fx.service';
import { AdminListTicketsQuery, CreateTicketDto, ListTicketsQuery, PLAN_CATALOG, Priority, SUPPORT_PLANS, SupportPlanId, TicketMessageDto } from './support.dto';

const ticketInclude = { messages: { orderBy: { createdAt: 'asc' as const } } } satisfies Prisma.TicketInclude;
type TicketRow = Prisma.TicketGetPayload<{ include: typeof ticketInclude }>;

/**
 * Support plans and tickets.
 *
 * The plan sits on the team and is billed monthly against the team's oldest project through the
 * usual meter (resource type `support`, sku `support-<plan>`). Tickets carry the plan they were
 * opened under so a downgrade does not move the target on an open ticket. Staff answer from the
 * back office; every customer message reopens the ticket and every staff answer marks it answered.
 */
@Injectable()
export class SupportService {
  private readonly log = new Logger(SupportService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly spend: SpendService,
    private readonly fx: FxService,
    private readonly mail: MailService,
  ) {}

  /** Plan catalog with prices in the team's currency (or USD when unauthenticated). */
  async plans(currency: 'USD' | 'SAR' = 'USD') {
    const prices = await this.prisma.price.findMany({ where: { resourceType: 'support', currency: 'USD', validTo: null } });
    const rate = currency === 'USD' ? 1 : await this.fx.rate(currency, new Date());
    return {
      data: SUPPORT_PLANS.map((id) => {
        const usd = prices.find((p) => p.sku === `support-${id}`)?.monthlyMinor ?? 0;
        return { id, ...PLAN_CATALOG[id], currency, monthlyMinor: Math.round(usd * rate) };
      }),
    };
  }

  async current(actor: Actor) {
    const team = await this.prisma.team.findUniqueOrThrow({ where: { id: actor.teamId }, select: { supportPlan: true, supportPlanSince: true, currency: true } });
    const plans = await this.plans(team.currency);
    const open = await this.prisma.ticket.count({ where: { teamId: actor.teamId, status: { not: 'closed' } } });
    return { plan: team.supportPlan, since: team.supportPlanSince, openTickets: open, details: plans.data.find((p) => p.id === team.supportPlan) };
  }

  /** Change the plan. Upgrades check spend on the oldest project; downgrades take effect at once. */
  async setPlan(actor: Actor, plan: SupportPlanId) {
    const team = await this.prisma.team.findUniqueOrThrow({ where: { id: actor.teamId }, include: { projects: { orderBy: { createdAt: 'asc' }, take: 1 } } });
    if (team.supportPlan === plan) return this.current(actor);
    const order = SUPPORT_PLANS.indexOf(plan) - SUPPORT_PLANS.indexOf(team.supportPlan);
    if (order > 0) {
      if (!team.projects.length) throw ApiError.invalidState('The team needs a project before a paid plan can be billed');
      const monthly = await this.spend.monthlyPriceMinor('support', `support-${plan}`, team.currency);
      const current = team.supportPlan === 'free' ? 0 : await this.spend.monthlyPriceMinor('support', `support-${team.supportPlan}`, team.currency);
      await this.spend.assertCanSpend(actor, team.projects[0].id, Math.max(0, monthly - current));
    }
    await this.prisma.team.update({ where: { id: team.id }, data: { supportPlan: plan, supportPlanSince: new Date() } });
    await this.events.emit('support.plan_changed', { from: team.supportPlan, to: plan }, { actor, resource: `team:${team.id}` });
    return this.current(actor);
  }

  async list(actor: Actor, q: ListTicketsQuery) {
    const status = q.status ?? 'all';
    const rows = await this.prisma.ticket.findMany({
      where: { teamId: actor.teamId, ...(status === 'all' ? {} : { status }) },
      include: { _count: { select: { messages: true } } },
      orderBy: { updatedAt: 'desc' },
      ...cursorArgs(q),
    });
    return toPage(rows.map((t) => this.summary(t, t._count.messages)), q.limit);
  }

  async get(actor: Actor, id: string) {
    return this.present(await this.own(actor, id));
  }

  async create(actor: Actor, dto: CreateTicketDto) {
    const team = await this.prisma.team.findUniqueOrThrow({ where: { id: actor.teamId } });
    const plan = team.supportPlan;
    const priority: Priority = dto.priority ?? 'normal';
    const target = PLAN_CATALOG[plan].targets[priority];
    if (target === null) throw ApiError.invalid(`Priority "${priority}" needs a higher support plan`, { plan, allowed: (Object.keys(PLAN_CATALOG[plan].targets) as Priority[]).filter((p) => PLAN_CATALOG[plan].targets[p] !== null) });
    const open = await this.prisma.ticket.count({ where: { teamId: team.id, status: { not: 'closed' } } });
    if (open >= PLAN_CATALOG[plan].maxOpen) throw ApiError.quota(`Your plan allows ${PLAN_CATALOG[plan].maxOpen} open tickets; close one first`);
    if (dto.resource) await this.checkResource(actor, dto.resource);
    const author = await this.authorName(actor);
    const ticket = await this.prisma.ticket.create({
      data: {
        teamId: team.id,
        subject: dto.subject.trim(),
        priority,
        plan,
        resource: dto.resource ?? null,
        createdById: actor.userId,
        firstResponseDueAt: new Date(Date.now() + target * 3600_000),
        messages: { create: { fromSupport: false, authorId: actor.userId, authorName: author, body: dto.body } },
      },
      include: ticketInclude,
    });
    await this.events.emit('ticket.opened', { ticketId: ticket.id, number: ticket.number, subject: ticket.subject, priority, plan }, { actor, resource: `ticket:${ticket.id}` });
    await this.notifyStaff(ticket, dto.body);
    return this.present(ticket);
  }

  async reply(actor: Actor, id: string, dto: TicketMessageDto) {
    const ticket = await this.own(actor, id);
    if (ticket.status === 'closed' && ticket.closedAt && Date.now() - ticket.closedAt.getTime() > 14 * 86400_000) throw ApiError.invalidState('This ticket was closed more than 14 days ago; open a new one');
    const author = await this.authorName(actor);
    const updated = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'open', closedAt: null, lastCustomerAt: new Date(), messages: { create: { fromSupport: false, authorId: actor.userId, authorName: author, body: dto.body } } },
      include: ticketInclude,
    });
    await this.events.emit('ticket.replied', { ticketId: id, number: ticket.number, by: 'customer' }, { actor, resource: `ticket:${id}` });
    await this.notifyStaff(updated, dto.body);
    return this.present(updated);
  }

  async close(actor: Actor, id: string) {
    const ticket = await this.own(actor, id);
    if (ticket.status === 'closed') return this.present(ticket);
    const updated = await this.prisma.ticket.update({ where: { id }, data: { status: 'closed', closedAt: new Date() }, include: ticketInclude });
    await this.events.emit('ticket.closed', { ticketId: id, number: ticket.number, by: 'customer' }, { actor, resource: `ticket:${id}` });
    return this.present(updated);
  }

  // ---- back office ----

  async adminList(q: AdminListTicketsQuery) {
    const status = q.status ?? 'open';
    const rows = await this.prisma.ticket.findMany({
      where: { ...(status === 'all' ? {} : { status }), ...(q.team ? { teamId: q.team } : {}) },
      include: { _count: { select: { messages: true } } },
      orderBy: status === 'open' ? [{ firstResponseDueAt: 'asc' }, { lastCustomerAt: 'asc' }] : [{ updatedAt: 'desc' }],
      ...cursorArgs(q),
    });
    const teams = await this.prisma.team.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.teamId))] } }, select: { id: true, name: true, slug: true, supportPlan: true } });
    const teamOf = new Map(teams.map((t) => [t.id, t]));
    return toPage(rows.map((t) => ({ ...this.summary(t, t._count.messages), team: teamOf.get(t.teamId) ?? null, overdue: t.status === 'open' && !t.firstRespondedAt && !!t.firstResponseDueAt && t.firstResponseDueAt < new Date() })), q.limit);
  }

  async adminGet(id: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id }, include: ticketInclude });
    if (!ticket) throw ApiError.notFound('ticket', id);
    const team = await this.prisma.team.findUnique({ where: { id: ticket.teamId }, select: { id: true, name: true, slug: true, supportPlan: true, currency: true, country: true, members: { where: { role: 'owner' }, include: { user: { select: { email: true, name: true } } } } } });
    return { ...this.present(ticket), team };
  }

  /** Staff answer: marks the ticket answered, records the first response, emails the team owners and the opener. */
  async adminReply(actor: Actor, id: string, dto: TicketMessageDto, close = false) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw ApiError.notFound('ticket', id);
    const staff = await this.prisma.user.findUnique({ where: { id: actor.userId }, select: { name: true } });
    const now = new Date();
    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        status: close ? 'closed' : 'answered',
        closedAt: close ? now : null,
        lastSupportAt: now,
        firstRespondedAt: ticket.firstRespondedAt ?? now,
        messages: { create: { fromSupport: true, authorId: actor.userId, authorName: staff?.name ?? 'pgcloud support', body: dto.body } },
      },
      include: ticketInclude,
    });
    await this.events.emit(close ? 'ticket.closed' : 'ticket.answered', { ticketId: id, number: ticket.number, by: 'support' }, { teamId: ticket.teamId, actor, resource: `ticket:${id}` });
    await this.notifyCustomer(updated, dto.body);
    return this.present(updated);
  }

  async adminClose(actor: Actor, id: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw ApiError.notFound('ticket', id);
    const updated = await this.prisma.ticket.update({ where: { id }, data: { status: 'closed', closedAt: new Date() }, include: ticketInclude });
    await this.events.emit('ticket.closed', { ticketId: id, number: ticket.number, by: 'support' }, { teamId: ticket.teamId, actor, resource: `ticket:${id}` });
    return this.present(updated);
  }

  /** Open tickets past their first response target; used by the back office overview. */
  async overdueCount() {
    return this.prisma.ticket.count({ where: { status: 'open', firstRespondedAt: null, firstResponseDueAt: { lt: new Date() } } });
  }

  // ---- helpers ----

  private async own(actor: Actor, id: string) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id, teamId: actor.teamId }, include: ticketInclude });
    if (!ticket) throw ApiError.notFound('ticket', id);
    return ticket;
  }

  private async authorName(actor: Actor) {
    const u = await this.prisma.user.findUnique({ where: { id: actor.userId }, select: { name: true } });
    return actor.tokenId ? `${u?.name ?? 'API'} (API token)` : u?.name ?? 'Customer';
  }

  /** The resource named on a ticket must belong to the team. */
  private async checkResource(actor: Actor, ref: string) {
    const [kind, id] = ref.split(':', 2);
    const teamScope = { project: { teamId: actor.teamId } };
    const found = await (async () => {
      switch (kind) {
        case 'server': return this.prisma.server.count({ where: { id, ...teamScope } });
        case 'database': return this.prisma.dbCluster.count({ where: { id, ...teamScope } });
        case 'load_balancer': return this.prisma.loadBalancer.count({ where: { id, ...teamScope } });
        case 'volume': return this.prisma.volume.count({ where: { id, ...teamScope } });
        case 'domain': return this.prisma.dnsZone.count({ where: { id, ...teamScope } });
        case 'bucket': return this.prisma.bucket.count({ where: { id, ...teamScope } });
        case 'invoice': return this.prisma.invoice.count({ where: { id, teamId: actor.teamId } });
        default: return 0;
      }
    })();
    if (!found) throw ApiError.invalid(`Unknown resource "${ref}"`);
  }

  private async notifyStaff(ticket: TicketRow, body: string) {
    const c = loadConfig();
    if (!c.SUPPORT_INBOX) return;
    await this.mail.send({ to: c.SUPPORT_INBOX, subject: `[#${ticket.number}] [${ticket.priority}] ${ticket.subject}`, text: `${body}\n\n${c.CONSOLE_URL}/admin/support/${ticket.id}` }).catch((e) => this.log.warn(`support mail failed: ${e}`));
  }

  private async notifyCustomer(ticket: TicketRow, body: string) {
    const [owners, opener] = await Promise.all([
      this.prisma.teamMember.findMany({ where: { teamId: ticket.teamId, role: 'owner' }, include: { user: { select: { email: true } } } }),
      ticket.createdById ? this.prisma.user.findUnique({ where: { id: ticket.createdById }, select: { email: true } }) : null,
    ]);
    const to = new Set([...owners.map((m) => m.user.email), ...(opener ? [opener.email] : [])]);
    const url = `${loadConfig().CONSOLE_URL}/support/${ticket.id}`;
    await Promise.all([...to].map((email) => this.mail.send({ to: email, subject: `Re: [#${ticket.number}] ${ticket.subject}`, text: `${body}\n\nReply or close the ticket here:\n${url}` }).catch((e) => this.log.warn(`support mail failed: ${e}`))));
  }

  private summary(t: Prisma.TicketGetPayload<object>, messageCount: number) {
    return {
      id: t.id, number: t.number, subject: t.subject, status: t.status, priority: t.priority, plan: t.plan, resource: t.resource,
      firstResponseDueAt: t.firstResponseDueAt, firstRespondedAt: t.firstRespondedAt, lastCustomerAt: t.lastCustomerAt, lastSupportAt: t.lastSupportAt,
      closedAt: t.closedAt, createdAt: t.createdAt, updatedAt: t.updatedAt, messageCount,
    };
  }

  private present(t: TicketRow) {
    return { ...this.summary(t, t.messages.length), messages: t.messages.map((m) => ({ id: m.id, fromSupport: m.fromSupport, author: m.authorName, body: m.body, createdAt: m.createdAt })) };
  }
}
