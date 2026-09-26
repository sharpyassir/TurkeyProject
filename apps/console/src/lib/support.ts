import { t } from '@/lib/i18n';

export interface SupportPlan { id: string; name: string; summary: string; features: string[]; targets: Record<string, number | null>; maxOpen: number; currency: string; monthlyMinor: number }
export interface TicketSummary { id: string; number: number; subject: string; status: 'open' | 'answered' | 'closed'; priority: string; plan: string; resource: string | null; firstResponseDueAt: string | null; firstRespondedAt: string | null; updatedAt: string; createdAt: string; messageCount: number }
export interface Current { plan: string; since: string | null; openTickets: number; details?: SupportPlan }

export const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export function targetLabel(h: number | null, locale: Parameters<typeof t>[0]) {
  if (h === null) return t(locale, 'notOnPlan');
  if (h < 1) return `${Math.round(h * 60)} ${t(locale, 'minutesShort')}`;
  if (h >= 48) return `${h / 24} ${t(locale, 'daysShort')}`;
  return `${h} ${t(locale, 'hoursShort')}`;
}

