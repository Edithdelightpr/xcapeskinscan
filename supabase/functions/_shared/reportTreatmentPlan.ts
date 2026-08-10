// Shared builder for the treatment-plan block of the personal-report payload.
// Used by BOTH `public-report-fetch` and `admin-preview-report` so the public
// report and the staff preview receive identical data.
//
// The builder returns:
//   - `treatment_plan`: null | { header, totals, discount, lines, next_step }
//   - `payment_settings`: bank/transfer instructions (never null; falls back)
//
// Every price is a plain number in Naira. Session counts and progress come
// straight from the projection so financial figures (total_paid,
// total_allocated, total_unallocated) remain the single source of truth for
// Stage 6 (payment engine) to overwrite atomically.

// deno-lint-ignore-file no-explicit-any

export interface ReportPaymentSettings {
  instructions_markdown: string | null;
  whatsapp_number: string | null;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
}

interface AdminClient {
  from: (t: string) => any;
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function buildTreatmentPlanBlock(
  admin: AdminClient,
  assessmentId: string,
): Promise<{
  treatment_plan: Record<string, unknown> | null;
  payment_settings: ReportPaymentSettings;
}> {
  const { data: plan } = await admin
    .from('treatment_plans')
    .select('id, status, accepted_at, activated_at, discount_scope, plan_discount_type, plan_discount_value, plan_discount_reason, plan_discount_authorized_by, total_catalogue_value, total_agreed_value')
    .eq('assessment_id', assessmentId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let treatment_plan: Record<string, unknown> | null = null;

  if (plan) {
    const [{ data: proj }, { data: sessions }] = await Promise.all([
      admin
        .from('treatment_plan_projections')
        .select('plan_status, total_paid, total_allocated, total_unallocated, financial_readiness_summary, next_schedule_item_summary, sessions_completed, sessions_total, progress_percent')
        .eq('treatment_plan_id', plan.id)
        .maybeSingle(),
      admin
        .from('treatment_plan_sessions')
        .select('id, service_id, service_name, sessions_total, sessions_completed, catalogue_unit_price, agreed_unit_price, line_total_agreed, line_discount_type, line_discount_value, line_discount_reason, line_discount_authorized_by, discount_scope_snapshot, status')
        .eq('treatment_plan_id', plan.id)
        .order('created_at', { ascending: true }),
    ]);

    // Latest performed schedule item — used by the client report to show
    // the most recent completed treatment and its date.
    const { data: latestPerformed } = await admin
      .from('treatment_plan_schedule_items')
      .select('id, plan_sequence_number, performed_at, planned_date, treatment_plan_session_id')
      .eq('treatment_plan_id', plan.id)
      .eq('status', 'performed')
      .order('performed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Resolve staff names for any authorising uids
    const staffIds = new Set<string>();
    if (plan.plan_discount_authorized_by) staffIds.add(plan.plan_discount_authorized_by);
    for (const s of (sessions ?? []) as any[]) {
      if (s.line_discount_authorized_by) staffIds.add(s.line_discount_authorized_by);
    }
    const staffNames: Record<string, string> = {};
    if (staffIds.size) {
      const { data: staff } = await admin
        .from('staff_users')
        .select('id, full_name')
        .in('id', Array.from(staffIds));
      for (const r of (staff ?? []) as any[]) staffNames[r.id] = r.full_name ?? '';
    }

    const catalogue = num(plan.total_catalogue_value);
    const agreed = num(plan.total_agreed_value);
    // A discount is only real when an explicit plan-level discount is recorded.
    // A catalogue vs. agreed difference alone is NOT a discount — it may simply
    // be package/agreed/receipt pricing. Do not infer.
    const planHasExplicitDiscount =
      plan.discount_scope === 'plan' &&
      plan.plan_discount_type != null &&
      plan.plan_discount_value != null;
    let discount_amount = 0;
    let discount_percent = 0;
    if (planHasExplicitDiscount) {
      const val = num(plan.plan_discount_value);
      if (plan.plan_discount_type === 'percent') {
        discount_percent = Math.max(0, Math.min(100, Math.round(val)));
        discount_amount = Math.round((catalogue * discount_percent) / 100);
      } else if (plan.plan_discount_type === 'amount') {
        discount_amount = Math.max(0, Math.round(val));
        discount_percent = catalogue > 0 ? Math.round((discount_amount / catalogue) * 100) : 0;
      }
    }
    const total_paid       = num(proj?.total_paid);
    const total_allocated  = num(proj?.total_allocated);
    const unallocated_credit = Math.max(total_paid - total_allocated, 0);
    const remaining_plan_balance = Math.max(agreed - total_paid, 0);

    const lines = ((sessions ?? []) as any[]).map((s) => {
      const cat = num(s.catalogue_unit_price);
      const agr = num(s.agreed_unit_price);
      const sessionsTotal = num(s.sessions_total);
      const sessionsPaidFor = s.sessions_paid_for == null
        ? sessionsTotal
        : Math.max(0, Math.min(sessionsTotal, num(s.sessions_paid_for)));
      const complimentarySessions = Math.max(sessionsTotal - sessionsPaidFor, 0);
      const sessionsCompleted = num(s.sessions_completed);
      const sessionsRemaining = Math.max(sessionsTotal - sessionsCompleted, 0);
      const lineTotalAgreed = num(s.line_total_agreed);
      // Standard value considers ONLY paid sessions.
      const paidStandardValue = cat * sessionsPaidFor;
      // Price discount = shortfall between what paid sessions would cost at
      // catalogue vs. what the client actually agreed to pay.
      const priceDiscountAmount = Math.max(paidStandardValue - lineTotalAgreed, 0);
      const complimentaryValue = cat * complimentarySessions;
      const totalClientBenefit = priceDiscountAmount + complimentaryValue;
      const effectivePaidUnitPrice = sessionsPaidFor > 0
        ? Number((lineTotalAgreed / sessionsPaidFor).toFixed(2))
        : 0;
      // Only surface a line discount when explicit fields are set. Never
      // derive from catalogue - agreed.
      const lineHasExplicitDiscount =
        s.line_discount_type != null && s.line_discount_value != null;
      let lineDiscountAmount = 0;
      if (lineHasExplicitDiscount) {
        const v = num(s.line_discount_value);
        if (s.line_discount_type === 'percent') {
          const pct = Math.max(0, Math.min(100, v));
          lineDiscountAmount = Math.round((paidStandardValue * pct) / 100);
        } else if (s.line_discount_type === 'amount') {
          lineDiscountAmount = Math.max(0, Math.round(v));
        }
      }
      // Prefer explicit discount when present; otherwise use the derived
      // paid-standard-vs-agreed shortfall. This is NOT catalogue-total inference —
      // it's grounded in the paid-session count only, so it stays 0 when
      // sessions_paid_for × catalogue_unit_price == line_total_agreed.
      const effectivePriceDiscount = lineHasExplicitDiscount
        ? lineDiscountAmount
        : priceDiscountAmount;
      return {
        id: s.id,
        service_id: s.service_id,
        service_name: s.service_name,
        sessions_total: sessionsTotal,
        sessions_completed: sessionsCompleted,
        sessions_paid_for: sessionsPaidFor,
        complimentary_sessions: complimentarySessions,
        sessions_remaining: sessionsRemaining,
        catalogue_unit_price: cat,
        agreed_unit_price: agr,
        effective_paid_unit_price: effectivePaidUnitPrice,
        line_total_agreed: num(s.line_total_agreed),
        line_total_catalogue: cat * sessionsTotal,
        paid_sessions_standard_value: paidStandardValue,
        agreed_paid_amount: lineTotalAgreed,
        price_discount_amount: effectivePriceDiscount,
        complimentary_value: complimentaryValue,
        total_client_benefit: effectivePriceDiscount + complimentaryValue,
        // Legacy alias kept for existing UI consumers.
        line_discount_amount: effectivePriceDiscount,
        line_discount_percent:
          lineHasExplicitDiscount && s.line_discount_type === 'percent'
            ? Math.max(0, Math.min(100, num(s.line_discount_value)))
            : 0,
        has_explicit_discount: lineHasExplicitDiscount || priceDiscountAmount > 0,
        has_complimentary: complimentarySessions > 0,
        line_discount_type: s.line_discount_type ?? null,
        line_discount_value: s.line_discount_value == null ? null : num(s.line_discount_value),
        line_discount_reason: s.line_discount_reason ?? null,
        line_discount_authorized_by_name: s.line_discount_authorized_by
          ? (staffNames[s.line_discount_authorized_by] || null)
          : null,
        discount_scope_snapshot: s.discount_scope_snapshot ?? 'none',
        status: s.status,
      };
    });

    const anyLineExplicit = lines.some((l) => l.has_explicit_discount);
    const has_explicit_discount = planHasExplicitDiscount || anyLineExplicit;

    // Plan-level benefit rollups (generic across all clients).
    const plan_total_standard_value = lines.reduce((s, l) => s + l.line_total_catalogue, 0);
    const plan_price_discount_total = lines.reduce((s, l) => s + l.price_discount_amount, 0);
    const plan_complimentary_value_total = lines.reduce((s, l) => s + l.complimentary_value, 0);
    const plan_complimentary_sessions_total = lines.reduce((s, l) => s + l.complimentary_sessions, 0);
    const plan_total_benefit = plan_price_discount_total + plan_complimentary_value_total;
    const plan_paid_sessions_total = lines.reduce((s, l) => s + l.sessions_paid_for, 0);

    treatment_plan = {
      id: plan.id,
      status: plan.status,
      accepted_at: plan.accepted_at,
      activated_at: plan.activated_at,
      discount_scope: plan.discount_scope,
      // Totals
      total_catalogue_value: Math.max(catalogue, plan_total_standard_value),
      total_agreed_value: agreed,
      discount_amount,
      discount_percent,
      has_explicit_discount,
      // Benefit model rollups
      price_discount_total: plan_price_discount_total,
      complimentary_value_total: plan_complimentary_value_total,
      complimentary_sessions_total: plan_complimentary_sessions_total,
      total_client_benefit: plan_total_benefit,
      paid_sessions_total: plan_paid_sessions_total,
      // Financials
      total_paid,
      total_allocated,
      unallocated_credit,
      remaining_plan_balance,
      // Legacy alias — kept for backwards compat but no longer means "remaining balance"
      total_unallocated: unallocated_credit,
      financial_readiness: proj?.financial_readiness_summary ?? 'awaiting_payment',
      // Progress
      sessions_completed: num(proj?.sessions_completed),
      sessions_total: num(proj?.sessions_total),
      progress_percent: num(proj?.progress_percent),
      // Sequencing
      next_treatment: proj?.next_schedule_item_summary ?? null,
      is_sequenced: !!proj?.next_schedule_item_summary,
      latest_completed: latestPerformed
        ? {
          id: (latestPerformed as any).id,
          plan_sequence_number: (latestPerformed as any).plan_sequence_number,
          performed_at: (latestPerformed as any).performed_at,
          service_name: (((sessions ?? []) as any[]).find(
            (s) => s.id === (latestPerformed as any).treatment_plan_session_id,
          )?.service_name) ?? null,
        }
        : null,
      // Plan-level discount details
      plan_discount: plan.discount_scope === 'plan'
        ? {
          type: plan.plan_discount_type,
          value: plan.plan_discount_value == null ? null : num(plan.plan_discount_value),
          reason: plan.plan_discount_reason ?? null,
          authorized_by_name: plan.plan_discount_authorized_by
            ? (staffNames[plan.plan_discount_authorized_by] || null)
            : null,
        }
        : null,
      lines,
    };
  }

  // Payment settings — singleton row keyed on id=true
  const { data: settings } = await admin
    .from('payment_settings')
    .select('instructions_markdown, whatsapp_number, bank_name, account_name, account_number')
    .maybeSingle();

  return {
    treatment_plan,
    payment_settings: {
      instructions_markdown: settings?.instructions_markdown ?? null,
      whatsapp_number: settings?.whatsapp_number ?? null,
      bank_name: settings?.bank_name ?? null,
      account_name: settings?.account_name ?? null,
      account_number: settings?.account_number ?? null,
    },
  };
}