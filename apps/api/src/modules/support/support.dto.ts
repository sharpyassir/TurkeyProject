import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { PaginationQuery } from '../../common/pagination';

export const SUPPORT_PLANS = ['free', 'developer', 'standard', 'premium'] as const;
export type SupportPlanId = (typeof SUPPORT_PLANS)[number];
export const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type Priority = (typeof PRIORITIES)[number];

/**
 * The plan catalog. Prices live in the price book (sku `support-<plan>`); everything else about
 * a plan is here so the API, console and docs say the same thing.
 *
 * `targets` is the first response target in hours per priority; null means the priority cannot be
 * chosen on that plan. Targets count wall clock hours, day and night, every day of the week.
 */
export const PLAN_CATALOG: Record<SupportPlanId, { name: string; summary: string; features: string[]; targets: Record<Priority, number | null>; maxOpen: number }> = {
  free: {
    name: 'Free',
    summary: 'Docs, community and tickets for account and billing questions.',
    features: ['Tickets for account, billing and abuse matters', 'Answer within 2 days', 'Docs and status page'],
    targets: { low: 72, normal: 48, high: null, urgent: null },
    maxOpen: 3,
  },
  developer: {
    name: 'Developer',
    summary: 'Technical help by ticket with a one day target.',
    features: ['Technical tickets on any product', 'Normal within 24 hours, high within 8 hours', 'Guidance on setup, sizing and best practice'],
    targets: { low: 48, normal: 24, high: 8, urgent: null },
    maxOpen: 10,
  },
  standard: {
    name: 'Standard',
    summary: 'Faster targets and urgent tickets for production issues.',
    features: ['Urgent tickets answered within 1 hour, high within 4', 'Normal within 8 hours', 'Help with incidents on managed products', 'Quarterly review of your setup on request'],
    targets: { low: 24, normal: 8, high: 4, urgent: 1 },
    maxOpen: 25,
  },
  premium: {
    name: 'Premium',
    summary: 'A named engineer who knows your setup and answers first.',
    features: ['Urgent tickets answered within 30 minutes, high within 2 hours', 'Normal within 4 hours', 'Named engineer and monthly review', 'Architecture and migration help', 'Priority during platform incidents'],
    targets: { low: 8, normal: 4, high: 2, urgent: 0.5 },
    maxOpen: 100,
  },
};

export class SetPlanDto {
  @IsIn(SUPPORT_PLANS) plan: SupportPlanId;
}

export class CreateTicketDto {
  @IsString() @Length(3, 140) subject: string;
  @IsString() @Length(1, 20000) body: string;
  @IsOptional() @IsIn(PRIORITIES) priority?: Priority;
  /** "server:<id>", "database:<id>", "load_balancer:<id>", "domain:<id>", "bucket:<id>", "invoice:<id>" */
  @IsOptional() @IsString() @Matches(/^[a-z_]+:[A-Za-z0-9_-]+$/) resource?: string;
}

export class TicketMessageDto {
  @IsString() @Length(1, 20000) body: string;
}

export class ListTicketsQuery extends PaginationQuery {
  @IsOptional() @IsIn(['open', 'answered', 'closed', 'all']) status?: 'open' | 'answered' | 'closed' | 'all';
}

export class AdminListTicketsQuery extends PaginationQuery {
  @IsOptional() @IsIn(['open', 'answered', 'closed', 'all']) status?: 'open' | 'answered' | 'closed' | 'all';
  @IsOptional() @IsString() team?: string;
}
