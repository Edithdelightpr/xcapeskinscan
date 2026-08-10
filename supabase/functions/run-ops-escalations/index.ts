import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";

/**
 * run-ops-escalations
 * Sweeps overdue follow-ups and bottlenecks, then:
 *   - logs an accountability event (rule-driven deduction)
 *   - emits a notification to the responsible staff + admins
 * Idempotent within the same calendar day via a staging table check.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Restrict invocation to trusted callers (scheduled jobs / service role).
  const cronSecret = Deno.env.get('CRON_SECRET');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authHeader = req.headers.get('authorization') ?? '';
  const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const providedCron = req.headers.get('x-cron-secret') ?? '';
  const allowed =
    (cronSecret && providedCron && providedCron === cronSecret) ||
    (serviceKey && bearer && bearer === serviceKey);
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const today = new Date().toISOString().slice(0, 10);
  const stats = { followups: 0, stale_verifications: 0 };

  // 1. Overdue follow-ups → missed_followup
  const { data: overdue } = await supabase
    .from("overdue_followups_view")
    .select("*");

  for (const row of overdue ?? []) {
    const staffId = row.attributed_staff_id ?? row.last_logged_by;
    if (!staffId) continue;

    // Has this client already triggered an event today?
    const { data: existing } = await supabase
      .from("staff_accountability_events")
      .select("id")
      .eq("kind", "missed_followup")
      .eq("client_id", row.client_id)
      .gte("created_at", `${today}T00:00:00Z`)
      .maybeSingle();
    if (existing) continue;

    await supabase.rpc("log_accountability_event", {
      _staff_user_id: staffId,
      _kind: "missed_followup",
      _client_id: row.client_id,
      _source: "auto_sweep",
      _notes: `Follow-up was due ${row.next_action_date} (${row.days_overdue}d overdue)`,
    });

    await supabase.rpc("emit_notification", {
      _category: "accountability",
      _kind: "missed_followup",
      _severity: "warning",
      _title: "Overdue follow-up",
      _body: `${row.client_name}: follow-up was due ${row.next_action_date} (${row.days_overdue}d ago).`,
      _subject_user_id: staffId,
      _target_table: "clients",
      _target_id: row.client_id,
      _metadata: { source: "ops_escalation" },
      _recipient_user_ids: [staffId],
      _include_admins: true,
      _include_subject: false,
    });
    stats.followups++;
  }

  // 2. Deliverables awaiting verification > 48h → stale_verification
  const { data: stale } = await supabase
    .from("deliverables")
    .select("id, owner_staff_id, title, proof_uploaded_at, updated_at")
    .eq("status", "awaiting_verification")
    .lt(
      "proof_uploaded_at",
      new Date(Date.now() - 48 * 3600_000).toISOString(),
    );

  for (const d of stale ?? []) {
    if (!d.owner_staff_id) continue;
    const { data: existing } = await supabase
      .from("staff_accountability_events")
      .select("id")
      .eq("kind", "stale_verification")
      .gte("created_at", `${today}T00:00:00Z`)
      .ilike("notes", `%${d.id}%`)
      .maybeSingle();
    if (existing) continue;

    await supabase.rpc("log_accountability_event", {
      _staff_user_id: d.owner_staff_id,
      _kind: "stale_verification",
      _source: "auto_sweep",
      _notes: `Deliverable ${d.id} ('${d.title}') unverified >48h`,
    });
    stats.stale_verifications++;
  }

  return new Response(
    JSON.stringify({ ok: true, ...stats }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});