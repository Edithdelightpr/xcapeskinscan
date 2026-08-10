import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Auto-flips past `scheduled` appointments to `no_show` after a grace
 * window, logs an accountability event against the assigned practitioner
 * (using the active rule for `no_show`), and pings them in-app.
 * Idempotent — only touches rows still in `scheduled` status.
 */
const GRACE_MINUTES = 30;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    // Restrict invocation to trusted callers (scheduled jobs / service role).
    const cronSecret = Deno.env.get('CRON_SECRET');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const auth = req.headers.get('authorization') ?? '';
    const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
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
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // Pull scheduled appointments from today or earlier
    const { data: appts, error } = await supabase
      .from('appointments')
      .select('id, client_id, date, time, treatment, assigned_aesthetician_id, total_amount, status')
      .eq('status', 'scheduled')
      .lte('date', today);
    if (error) throw error;

    let flipped = 0;
    let logged = 0;

    for (const a of (appts ?? [])) {
      // Build appointment start in UTC and add grace window
      const start = new Date(`${a.date}T${(a.time as string).length === 5 ? a.time + ':00' : a.time}Z`);
      const cutoff = new Date(start.getTime() + GRACE_MINUTES * 60_000);
      if (now < cutoff) continue;

      // Flip status
      const { error: uErr } = await supabase
        .from('appointments')
        .update({ status: 'no_show' })
        .eq('id', a.id)
        .eq('status', 'scheduled'); // guard against race
      if (uErr) {
        console.warn('flip failed', a.id, uErr.message);
        continue;
      }
      flipped++;

      // Log accountability event for the assigned practitioner (if any)
      if (a.assigned_aesthetician_id) {
        const { data: evtId, error: lErr } = await supabase.rpc('log_accountability_event', {
          _staff_user_id: a.assigned_aesthetician_id,
          _kind: 'no_show',
          _appointment_id: a.id,
          _client_id: a.client_id,
          _source: 'auto_no_show',
          _notes: `Auto-flagged ${GRACE_MINUTES}m past start (${a.date} ${a.time}).`,
          _appt_total: a.total_amount ?? null,
        });
        if (lErr) console.warn('accountability log failed', a.id, lErr.message);
        else if (evtId) logged++;

        // In-app ping to the practitioner + admins
        const { data: client } = await supabase
          .from('clients').select('full_name').eq('id', a.client_id).maybeSingle();
        await supabase.rpc('emit_notification', {
          _category: 'appointment',
          _kind: 'no_show',
          _severity: 'warning',
          _title: 'Appointment marked no-show',
          _body: `${client?.full_name ?? 'Client'} — ${a.treatment ?? 'appointment'} on ${a.date} ${a.time} was auto-flagged as no-show.`,
          _subject_user_id: a.assigned_aesthetician_id,
          _target_table: 'appointments',
          _target_id: a.id,
          _metadata: { client_id: a.client_id },
          _recipient_user_ids: [a.assigned_aesthetician_id],
          _include_admins: true,
          _include_subject: false,
        }).catch((e) => console.warn('notify failed', e?.message ?? e));
      }
    }

    return new Response(JSON.stringify({ ok: true, candidates: appts?.length ?? 0, flipped, logged }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('mark-no-shows error', e);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});