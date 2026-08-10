import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";

/**
 * generate-daily-snapshot
 * Reads `daily_ops_metrics` for a target date (default: yesterday in
 * Africa/Lagos) and freezes one snapshot row per staff into
 * `daily_ops_snapshots`. Idempotent via UPSERT on (snapshot_date, staff_user_id).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Restrict invocation to trusted callers (scheduled jobs / service role).
  // The cron secret is verified against the vault-stored value.
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authHeader = req.headers.get('authorization') ?? '';
  const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const providedCron = req.headers.get('x-cron-secret') ?? '';
  let allowed = !!(serviceKey && bearer && bearer === serviceKey);
  if (!allowed && providedCron) {
    const gate = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);
    const { data: cronOk } = await gate.rpc('verify_cron_secret', { candidate: providedCron });
    allowed = cronOk === true;
  }
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let targetDate: string;
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    targetDate = body?.date ?? lagosDateOffset(-1);
  } catch {
    targetDate = lagosDateOffset(-1);
  }

  const { data: rows, error } = await supabase
    .from("daily_ops_metrics")
    .select("*")
    .eq("metric_date", targetDate);
  if (error) {
    console.error('generate-daily-snapshot select error', error);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Upsert per-staff snapshots
  const payload = (rows ?? []).map((r: Record<string, unknown>) => ({
    snapshot_date: targetDate,
    staff_user_id: r.staff_user_id,
    metrics: r,
  }));
  if (payload.length > 0) {
    const { error: upErr } = await supabase
      .from("daily_ops_snapshots")
      .upsert(payload, { onConflict: "snapshot_date,staff_user_id" });
    if (upErr) {
      console.error('generate-daily-snapshot upsert error', upErr);
      return new Response(JSON.stringify({ error: 'Server error' }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(
    JSON.stringify({ ok: true, date: targetDate, staff_rows: payload.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

function lagosDateOffset(days: number): string {
  const now = new Date();
  // Africa/Lagos = UTC+1, no DST
  const lagos = new Date(now.getTime() + (1 * 3600_000) + days * 86400_000);
  return lagos.toISOString().slice(0, 10);
}