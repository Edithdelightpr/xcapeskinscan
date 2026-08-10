import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  buildWhatsAppDeepLink,
  formatHumanTime,
} from '../_shared/booking-helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOCATION = 'Tropics MedSpa, Wonderland Estate, Kukwaba, Abuja';

/**
 * Sends 1-hour-out reminder emails for upcoming appointments.
 *
 * Designed to be triggered by pg_cron every 5 minutes. We scan a window
 * of appointments starting 55–75 minutes from now to absorb cron drift;
 * the `reminder_1h_sent_at` column prevents duplicates.
 *
 * Skip rules: status must be `scheduled`; if the appointment is
 * cancelled, completed, or no_show we skip. If the client has no email
 * we don't attempt to send — instead we emit an in-app notification to
 * admins + front_desk so they can WhatsApp the client manually.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const now = new Date();
    // Target exactly 60 min before appointment. With a 5-min cron, a
    // 58–62 min window guarantees exactly one tick per appointment and
    // prevents the reminder from arriving 65–75 min early.
    const winStart = new Date(now.getTime() + 58 * 60_000);
    const winEnd = new Date(now.getTime() + 62 * 60_000);

    // Appointments store date (YYYY-MM-DD) and time (HH:MM[:SS]) in
    // Africa/Lagos LOCAL time (UTC+1, no DST). Derive candidate dates
    // from Lagos-local Y-M-D so a 09:00 UTC start (date = today in
    // Lagos) is fetched even when the UTC clock has crossed midnight.
    const lagosYMD = (d: Date) =>
      new Date(d.getTime() + 60 * 60_000).toISOString().slice(0, 10);
    const dates = Array.from(new Set([lagosYMD(winStart), lagosYMD(winEnd)]));

    const { data: candidates, error } = await supabase
      .from('appointments')
      .select('id, client_id, date, time, treatment, status, assigned_aesthetician_id, reminder_1h_sent_at, created_at, updated_at')
      .in('date', dates)
      .eq('status', 'scheduled')
      .is('reminder_1h_sent_at', null);
    if (error) throw error;

    // Pre-fetch front-desk recipients once for any no-email fallbacks
    const { data: fdRoles } = await supabase
      .from('user_roles').select('user_id').eq('role', 'front_desk');
    const frontDeskRecipients = Array.from(
      new Set((fdRoles ?? []).map((r) => r.user_id as string)),
    );

    let sent = 0;
    let skipped_no_email_notified = 0;
    let skipped_cancelled_or_done = 0;
    let skipped_already_sent = 0;
    let skipped_out_of_window = 0;
    let failed = 0;

    for (const a of (candidates ?? [])) {
      const t = (a.time as string).length === 5 ? `${a.time}:00` : (a.time as string);
      // Africa/Lagos is UTC+1 with no DST — fixed offset is safe.
      const start = new Date(`${a.date}T${t}+01:00`);
      const minutesBefore = Math.round((start.getTime() - now.getTime()) / 60_000);
      const createdAt = a.created_at ? new Date(a.created_at as string) : null;
      const updatedAt = a.updated_at ? new Date(a.updated_at as string) : null;
      // Late-booking detection is logged for visibility only — it no
      // longer bypasses the window. A "1h reminder" sent 20 min before
      // the appointment is worse than not sending one (the booking
      // confirmation already covers that case).
      const lateBooking =
        start >= now && (
          (createdAt && (now.getTime() - createdAt.getTime()) < 90 * 60_000) ||
          (updatedAt && (now.getTime() - updatedAt.getTime()) < 90 * 60_000)
        );
      const inWindow = start >= winStart && start <= winEnd;
      const bookedInsideWindow = !inWindow && start >= now && start < winStart;
      if (!inWindow) {
        skipped_out_of_window++;
        console.info('reminder-1h.tick', JSON.stringify({
          appointment_id: a.id,
          client_id: a.client_id,
          appointment_time_lagos: `${a.date} ${a.time}`,
          appointment_start_utc: start.toISOString(),
          appointment_created_at: a.created_at,
          appointment_updated_at: a.updated_at,
          reminder_target_time_utc: new Date(start.getTime() - 60 * 60_000).toISOString(),
          function_run_time_utc: now.toISOString(),
          minutes_before_appointment: minutesBefore,
          timezone_used: 'Africa/Lagos (+01:00 fixed)',
          idempotency_key: `reminder-1h-${a.id}`,
          late_booking: !!lateBooking,
          skipped_reason: bookedInsideWindow ? 'booked_inside_reminder_window' : 'out_of_window',
        }));
        continue;
      }

      // Re-check freshest status / dedupe stamp
      const { data: fresh } = await supabase
        .from('appointments')
        .select('status, reminder_1h_sent_at')
        .eq('id', a.id)
        .maybeSingle();
      if (!fresh) { failed++; continue; }
      if (fresh.reminder_1h_sent_at) { skipped_already_sent++; continue; }
      if (fresh.status !== 'scheduled') { skipped_cancelled_or_done++; continue; }

      const { data: client } = await supabase
        .from('clients').select('full_name, email, phone')
        .eq('id', a.client_id).maybeSingle();

      let practitionerName: string | undefined;
      if (a.assigned_aesthetician_id) {
        const { data: s } = await supabase
          .from('staff_users').select('full_name')
          .eq('id', a.assigned_aesthetician_id).maybeSingle();
        practitionerName = s?.full_name ?? undefined;
      }

      const niceTime = formatHumanTime(a.time as string);

      // ---- No-email fallback ----
      if (!client?.email) {
        const lines = [
          `${client?.full_name ?? 'Client'} has no email on file.`,
          `Please send the 1-hour appointment reminder by WhatsApp.`,
          `Treatment: ${a.treatment ?? '—'}`,
          `Time: ${niceTime}`,
          practitionerName ? `With: ${practitionerName}` : null,
          client?.phone ? `Phone: ${client.phone}` : 'Phone: not on file',
        ].filter(Boolean).join('\n');

        try {
          const { error: nErr } = await supabase.rpc('emit_notification', {
            _category: 'booking',
            _kind: 'reminder_1h_no_email',
            _severity: 'warning',
            _title: 'Client has no email — send 1h reminder by WhatsApp',
            _body: lines,
            _subject_user_id: null,
            _target_table: 'appointments',
            _target_id: a.id,
            _metadata: {
              client_id: a.client_id,
              reason: 'no_email_at_reminder_1h',
              phone: client?.phone ?? null,
            },
            _recipient_user_ids: frontDeskRecipients,
            _include_admins: true,
            _include_subject: false,
          });
          if (nErr) console.warn('1h no-email notify failed', a.id, nErr.message);
        } catch (e) {
          console.warn('1h no-email notify threw', a.id, (e as Error)?.message ?? e);
        }
        // Stamp so we don't keep firing this every cron tick.
        await supabase.from('appointments')
          .update({ reminder_1h_sent_at: new Date().toISOString() })
          .eq('id', a.id);
        skipped_no_email_notified++;
        console.info('1h reminder skipped (no email)', a.id);
        continue;
      }

      const whatsappUrl = await buildWhatsAppDeepLink(
        supabase, client.full_name, a.treatment as string, '', niceTime,
      );

      const inv = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'booking-reminder-1h',
          recipientEmail: client.email,
          idempotencyKey: `reminder-1h-${a.id}`,
          templateData: {
            clientName: client.full_name ?? undefined,
            treatment: a.treatment,
            time: niceTime,
            practitionerName,
            location: LOCATION,
            whatsappUrl,
          },
        },
      });
      if (inv.error) {
        console.warn('1h reminder enqueue failed', a.id, inv.error.message);
        failed++;
        continue;
      }
      await supabase.from('appointments')
        .update({ reminder_1h_sent_at: new Date().toISOString() })
        .eq('id', a.id);
      sent++;
      console.info('reminder-1h.tick', JSON.stringify({
        appointment_id: a.id,
        client_id: a.client_id,
        appointment_time_lagos: `${a.date} ${a.time}`,
        appointment_start_utc: start.toISOString(),
        appointment_created_at: a.created_at,
        appointment_updated_at: a.updated_at,
        reminder_target_time_utc: new Date(start.getTime() - 60 * 60_000).toISOString(),
        function_run_time_utc: now.toISOString(),
        minutes_before_appointment: minutesBefore,
        timezone_used: 'Africa/Lagos (+01:00 fixed)',
        idempotency_key: `reminder-1h-${a.id}`,
        late_booking: !!lateBooking,
        skipped_reason: null,
      }));
    }

    return new Response(JSON.stringify({
      ok: true,
      window: { start: winStart.toISOString(), end: winEnd.toISOString() },
      candidates: candidates?.length ?? 0,
      sent,
      skipped_no_email_notified,
      skipped_cancelled_or_done,
      skipped_already_sent,
      skipped_out_of_window,
      failed,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('send-booking-reminders-1h error', e);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});