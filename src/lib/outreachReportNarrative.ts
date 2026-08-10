import type { OutreachSession } from '@/hooks/useOutreachSessions';

const fmt = (n: number) => `₦${Number(n || 0).toLocaleString()}`;

/** Builds a system-of-record narrative paragraph from real data. */
export const buildOutreachNarrative = (
  s: OutreachSession,
  staffName: (id?: string | null) => string,
  totals: {
    leads: number;
    sales_count: number;
    revenue: number;
    cogs: number;
    op_expense: number;
    net: number;
    reward: number;
    products_returned?: number;
  },
): string => {
  const parts: string[] = [];
  parts.push(
    `"${s.name}" was ${s.outreach_type} outreach held on ${s.outreach_date}` +
    (s.location ? ` at ${s.location}` : '') + '.',
  );
  if (s.initiator_staff_id) parts.push(`Proposed by ${staffName(s.initiator_staff_id)}.`);
  if (s.approved_by_user_id) parts.push(`Approved by ${staffName(s.approved_by_user_id)}${s.approved_at ? ` on ${new Date(s.approved_at).toLocaleDateString()}` : ''}.`);
  if (s.coordinator_user_id) parts.push(`Coordinated by ${staffName(s.coordinator_user_id)}.`);
  parts.push(
    `Captured ${totals.leads} lead${totals.leads === 1 ? '' : 's'}, ` +
    `recorded ${totals.sales_count} sale${totals.sales_count === 1 ? '' : 's'}, ` +
    `generated ${fmt(totals.revenue)} in revenue with ${fmt(totals.cogs)} COGS and ${fmt(totals.op_expense)} operational expenses.`,
  );
  if (typeof totals.products_returned === 'number' && totals.products_returned > 0) {
    parts.push(`${totals.products_returned} unit${totals.products_returned === 1 ? '' : 's'} returned to inventory.`);
  }
  parts.push(`Net result: ${fmt(totals.net)}${totals.net >= 0 ? ' profit' : ' loss'}, with ${fmt(totals.reward)} reward pool computed.`);
  if (s.closed_at) parts.push(`Outreach formally closed${s.closed_by_user_id ? ` by ${staffName(s.closed_by_user_id)}` : ''} on ${new Date(s.closed_at).toLocaleDateString()}.`);
  return parts.join(' ');
};