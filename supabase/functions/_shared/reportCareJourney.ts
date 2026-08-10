// Shared builder for the "Your care journey" block on the personal report.
// Used by BOTH `public-report-fetch` and `admin-preview-report` so preview
// and public report render identically. All queries are scoped to a single
// `client_id` and honour immutable-ledger semantics (`status = 'active'`
// only — voided/removed records never leak into the client view).
//
// Everything here is derived; there is NO client-specific special-casing.

// deno-lint-ignore-file no-explicit-any

interface AdminClient { from: (t: string) => any }

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export interface CareJourneyCompletedTreatment {
  id: string;
  service_name: string;
  performed_on: string; // YYYY-MM-DD
  plan_sequence_number: number | null;
}

export interface CareJourneyProduct {
  id: string;
  product_name: string;
  purchased_on: string; // YYYY-MM-DD
  amount: number;
  quantity: number;
}

export interface CareJourneyBlock {
  visits_count: number;                        // canonical physical visits
  total_received: number;                      // sum active revenue for client
  completed_treatments: CareJourneyCompletedTreatment[];
  products_purchased: CareJourneyProduct[];
  sessions_completed: number;
  sessions_total: number;
  sessions_remaining: number;
  next_treatment: {
    service_name: string | null;
    planned_date: string | null;
  } | null;
  has_any: boolean;                            // convenience for empty-state hiding
}

export async function buildCareJourneyBlock(
  admin: AdminClient,
  clientId: string,
  planId: string | null,
): Promise<CareJourneyBlock> {
  const [
    { data: visits },
    { data: revenues },
  ] = await Promise.all([
    admin.from('client_visit_logs')
      .select('id')
      .eq('client_id', clientId)
      .eq('status', 'active'),
    admin.from('finance_entries')
      .select('amount, product_id, quantity, date')
      .eq('source_client_id', clientId)
      .eq('status', 'active')
      .eq('kind', 'revenue'),
  ]);
  const visitsCount = Array.isArray(visits) ? visits.length : 0;

  const totalReceived = ((revenues ?? []) as any[])
    .reduce((acc, r) => acc + num(r.amount), 0);

  // Product purchases — resolve names from `products` table.
  const productRows = ((revenues ?? []) as any[]).filter((r) => r.product_id);
  const productIds = Array.from(new Set(productRows.map((r) => r.product_id)));
  let productNamesById: Record<string, string> = {};
  if (productIds.length) {
    const { data: prods } = await admin
      .from('products')
      .select('id, name')
      .in('id', productIds);
    for (const p of (prods ?? []) as any[]) productNamesById[p.id] = p.name ?? '';
  }
  const products_purchased: CareJourneyProduct[] = productRows
    .map((r) => ({
      id: r.product_id as string,
      product_name: productNamesById[r.product_id] || 'Product',
      purchased_on: (r.date as string) ?? '',
      amount: num(r.amount),
      quantity: num(r.quantity) || 1,
    }))
    .sort((a, b) => a.purchased_on.localeCompare(b.purchased_on));

  // Completed treatments from schedule items (if a plan exists) — this is
  // the authoritative record of delivered plan sessions.
  let completed_treatments: CareJourneyCompletedTreatment[] = [];
  let sessions_completed = 0;
  let sessions_total = 0;
  let next_treatment: CareJourneyBlock['next_treatment'] = null;

  if (planId) {
    const [{ data: performed }, { data: proj }] = await Promise.all([
      admin.from('treatment_plan_schedule_items')
        .select('id, plan_sequence_number, performed_at, planned_date, treatment_plan_session_id')
        .eq('treatment_plan_id', planId)
        .eq('status', 'performed')
        .order('performed_at', { ascending: true }),
      admin.from('treatment_plan_projections')
        .select('sessions_completed, sessions_total, next_schedule_item_summary')
        .eq('treatment_plan_id', planId)
        .maybeSingle(),
    ]);

    const sessionIds = Array.from(new Set(
      ((performed ?? []) as any[]).map((r) => r.treatment_plan_session_id).filter(Boolean),
    ));
    let sessionNamesById: Record<string, string> = {};
    if (sessionIds.length) {
      const { data: sess } = await admin
        .from('treatment_plan_sessions')
        .select('id, service_name')
        .in('id', sessionIds);
      for (const s of (sess ?? []) as any[]) sessionNamesById[s.id] = s.service_name ?? '';
    }

    completed_treatments = ((performed ?? []) as any[]).map((r) => {
      const iso: string = r.performed_at ?? r.planned_date ?? '';
      return {
        id: r.id as string,
        service_name: sessionNamesById[r.treatment_plan_session_id] || 'Treatment',
        performed_on: typeof iso === 'string' ? iso.slice(0, 10) : '',
        plan_sequence_number: r.plan_sequence_number ?? null,
      };
    });

    sessions_completed = num(proj?.sessions_completed);
    sessions_total = num(proj?.sessions_total);

    const nxt = (proj?.next_schedule_item_summary ?? null) as any;
    if (nxt && (nxt.service_name || nxt.planned_date)) {
      next_treatment = {
        service_name: nxt.service_name ?? null,
        planned_date: nxt.planned_date ?? null,
      };
    }
  }

  const sessions_remaining = Math.max(sessions_total - sessions_completed, 0);

  const has_any =
    visitsCount > 0 ||
    totalReceived > 0 ||
    completed_treatments.length > 0 ||
    products_purchased.length > 0 ||
    sessions_total > 0 ||
    next_treatment !== null;

  return {
    visits_count: visitsCount,
    total_received: totalReceived,
    completed_treatments,
    products_purchased,
    sessions_completed,
    sessions_total,
    sessions_remaining,
    next_treatment,
    has_any,
  };
}