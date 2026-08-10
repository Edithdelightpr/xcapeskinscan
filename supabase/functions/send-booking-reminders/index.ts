import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  buildWhatsAppDeepLink,
  ensureManageToken,
  formatHumanDate,
  formatHumanTime,
} from '../_shared/booking-helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_URL = Deno.env.get('APP_PUBLIC_URL') || 'https://tropics-medspa-pro.lovable.app';

/**
 * Sends 24h reminder emails for tomorrow's scheduled appointments.
 * Triggered by pg_cron once a day. Idempotent — uses
 * `appointments.reminder_24h_sent_at` to skip already-reminded rows and
 * `idempotencyKey` so retries don't double-send.
 * Re-checks each appointment's status before sending so cancelled or
 * rescheduled bookings (changed since the initial query) are skipped.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Tomorrow in UTC (matches how appointments.date is stored)
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const ymd = tomorrow.toISOString().slice(0, 10);

    const { data: appts, error } = await supabase
      .from('appointments')
      .select('id, client_id, date, time, treatment, assigned_aesthetician_id, reminder_24h_sent_at')
      .eq('date', ymd)
      .eq('status', 'scheduled')
      .is('reminder_24h_sent_at', null);
    if (error) throw error;

    let queued = 0;
    let skipped = 0;

    for (const a of (appts ?? [])) {
      // Re-check status — caller may have cancelled/rescheduled since the query started
      const { data: fresh } = await supabase
        .from('appointments')
        .select('status, date, reminder_24h_sent_at')
        .eq('id', a.id)
        .maybeSingle();
      if (!fresh || fresh.status !== 'scheduled' || fresh.date !== ymd || fresh.reminder_24h_sent_at) {
        skipped++;
        continue;
      }

      const { data: client } = await supabase
        .from('clients').select('full_name, email').eq('id', a.client_id).maybeSingle();
      if (!client?.email) { skipped++; continue; }

      let practitionerName: string | undefined;
      if (a.assigned_aesthetician_id) {
        const { data: s } = await supabase
          .from('staff_users').select('full_name').eq('id', a.assigned_aesthetician_id).maybeSingle();
        practitionerName = s?.full_name ?? undefined;
      }

      // Reuse-or-mint manage token (avoids piling up unused tokens per booking)
      const token = await ensureManageToken(supabase, a.id, a.date as string, a.time as string);
      const manageUrl = `${APP_URL}/manage-booking?token=${token}`;
      const niceDate = formatHumanDate(a.date as string);
      const niceTime = formatHumanTime(a.time as string);
      const whatsappUrl = await buildWhatsAppDeepLink(
        supabase, client.full_name, a.treatment as string, niceDate, niceTime,
      );

      const inv = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'booking-reminder-24h',
          recipientEmail: client.email,
          idempotencyKey: `reminder-24h-${a.id}`,
          templateData: {
            clientName: client.full_name ?? undefined,
            treatment: a.treatment,
            date: niceDate,
            time: niceTime,
            practitionerName,
            manageUrl,
            whatsappUrl,
          },
        },
      });
      if (inv.error) {
        console.warn('reminder enqueue failed', a.id, inv.error.message);
        continue;
      }
      await supabase.from('appointments')
        .update({ reminder_24h_sent_at: new Date().toISOString() })
        .eq('id', a.id);
      queued++;
    }

    return new Response(JSON.stringify({ ok: true, date: ymd, queued, skipped, candidates: appts?.length ?? 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('send-booking-reminders error', e);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});