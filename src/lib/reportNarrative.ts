import type { BusinessReport } from '@/hooks/useBusinessReport';
import { formatNaira } from '@/lib/finance';

export function buildExecutiveSummary(
  report: BusinessReport,
  staffNames: Record<string, string> = {},
): string {
  const r = report;
  const totalLeads = r.leads.total;
  const paidRev = r.finance.paidRevenue;
  const pending = r.finance.pendingPayments;
  const hasActivity =
    totalLeads > 0 || paidRev > 0 || pending > 0 || r.outreach.length > 0;
  if (!hasActivity) {
    return 'No activity recorded in this time period.';
  }
  const sentences: string[] = [];
  sentences.push(
    `Over the selected period, the business acquired ${totalLeads} lead${totalLeads === 1 ? '' : 's'}, ` +
    `generated ${formatNaira(paidRev)} in paid product sales, ` +
    `and recorded ${formatNaira(pending)} in pending payments.`
  );
  // Top outreach by lead share
  const topOutreach = [...r.outreach].sort((a, b) => b.leads - a.leads)[0];
  if (topOutreach && totalLeads > 0 && topOutreach.leads > 0) {
    const sharePct = Math.round((topOutreach.leads / totalLeads) * 100);
    const revShare = paidRev > 0 ? Math.round((topOutreach.revenue / paidRev) * 100) : 0;
    sentences.push(
      `${topOutreach.name} accounted for ${sharePct}% of lead acquisition` +
      (paidRev > 0 ? ` and ${revShare}% of product revenue` : '') +
      ' during this window.'
    );
  }
  // Top staff by attributed revenue
  const topStaff = [...r.staff].sort((a, b) => b.revenue - a.revenue)[0];
  if (topStaff && topStaff.revenue > 0) {
    const name = staffNames[topStaff.staff_user_id] ?? 'A team member';
    sentences.push(`${name} generated the highest attributed sales volume.`);
  }
  // COGS / margin closing line if material
  if (paidRev > 0) {
    sentences.push(
      `Gross profit stands at ${formatNaira(r.finance.grossProfit)}, ` +
      `with operating spend of ${formatNaira(r.finance.operatingSpend)} ` +
      `and an estimated net position of ${formatNaira(r.finance.estimatedNet)}.`
    );
  }
  return sentences.join(' ');
}