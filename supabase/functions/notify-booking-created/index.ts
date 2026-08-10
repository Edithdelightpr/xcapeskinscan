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
 * Single owner for booking-created notifications.
 *
 * Invoked from public-create-booking and staff-book-on-behalf with an
 * appointment_id. Sends:
 *   1. client booking-confirmation email (if the client has an email)
 *   2. staff-new-booking-alert email to the assigned practitioner (if any)
 *
 * If the client has no email, the booking still succeeds and we instead
 * emit an in-app notification to admins + front_desk asking them to send
 * the confirmation manually via WhatsApp.
 *
 * Accepts either a signed-in staff bearer (admin UI) or the service-role
 * bearer (server-to-server from other edge functions).
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const bearer = authHeader.slice(7).trim();
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const isServiceCall = !!serviceKey && bearer === serviceKey;
    if (!isServiceCall) {
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: userData, error: cErr } = await userClient.auth.getUser();
      if (cErr || !userData?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const body = await req.json() as { appointment_id?: string };
    if (!body.appointment_id || typeof body.appointment_id !== 'string') {
      return new Response(JSON.stringify({ error: 'appointment_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: appt, error: aErr } = await supabase
      .from('appointments')
      .select('id, client_id, date, time, treatment, assigned_aesthetician_id, source, is_walk_in')
      .eq('id', body.appointment_id)
      .maybeSingle();
    if (aErr) throw aErr;
    if (!appt) return new Response(JSON.stringify({ error: 'Appointment not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    // Walk-ins skip the client confirmation email (client is on-site) AND
    // the practitioner alert email (practitioner gets the in-app notification
    // from the appointment-created trigger; emailing them on every walk-in
    // would be noise).
    if (appt.is_walk_in) {
      return new Response(JSON.stringify({ ok: true, skipped: 'walk_in' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: client } = await supabase
      .from('clients').select('full_name, email, phone').eq('id', appt.client_id).maybeSingle();

    let practitionerName: string | undefined;
    let practitionerEmail: string | undefined;
    if (appt.assigned_aesthetician_id) {
      const { data: s } = await supabase
        .from('staff_users').select('full_name, email')
        .eq('id', appt.assigned_aesthetician_id).maybeSingle();
      practitionerName = s?.full_name ?? undefined;
      practitionerEmail = s?.email ?? undefined;
    }

    const niceDate = formatHumanDate(appt.date as string);
    const niceTime = formatHumanTime(appt.time as string);

    // ---- No-email fallback: notify front desk to handle manually ----
    if (!client?.email) {
      // Pull front-desk recipients explicitly so they get the in-app alert
      // even though _include_admins also covers admins.
      const { data: fdRoles } = await supabase
        .from('user_roles').select('user_id').eq('role', 'front_desk');
      const recipients = Array.from(new Set((fdRoles ?? []).map((r) => r.user_id as string)));

      const lines = [
        `${client?.full_name ?? 'Client'} has no email on file.`,
        `Please send the appointment confirmation by WhatsApp.`,
        `Treatment: ${appt.treatment ?? '—'}`,
        `When: ${niceDate} at ${niceTime}`,
        practitionerName ? `With: ${practitionerName}` : null,
        client?.phone ? `Phone: ${client.phone}` : 'Phone: not on file',
      ].filter(Boolean).join('\n');

      try {
        const { error: nErr } = await supabase.rpc('emit_notification', {
          _category: 'booking',
          _kind: 'client_no_email',
          _severity: 'warning',
          _title: 'Client has no email — send confirmation by WhatsApp',
          _body: lines,
          _subject_user_id: null,
          _target_table: 'appointments',
          _target_id: appt.id,
          _metadata: {
            client_id: appt.client_id,
            reason: 'no_email_at_booking',
            phone: client?.phone ?? null,
          },
          _recipient_user_ids: recipients,
          _include_admins: true,
          _include_subject: false,
        });
        if (nErr) console.warn('no-email notify failed', nErr.message);
      } catch (e) {
        console.warn('no-email notify threw', (e as Error)?.message ?? e);
      }
      console.info('notify-booking-created: client has no email, front desk notified', appt.id);
      return new Response(JSON.stringify({ ok: true, skipped: 'no_email_notified' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Reuse-or-mint manage token
    const manageToken = await ensureManageToken(
      supabase, appt.id, appt.date as string, appt.time as string,
    );
    const manageUrl = `${APP_URL}/manage-booking?token=${manageToken}`;
    const whatsappUrl = await buildWhatsAppDeepLink(
      supabase, client.full_name, appt.treatment as string, niceDate, niceTime,
    );

    await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'booking-confirmation',
        recipientEmail: client.email,
        idempotencyKey: `booking-confirm-${appt.id}`,
        templateData: {
          clientName: client.full_name ?? undefined,
          treatment: appt.treatment,
          date: niceDate, time: niceTime,
          practitionerName,
          manageUrl,
          whatsappUrl,
          location: 'Tropics MedSpa, Wonderland Estate, Kukwaba, Abuja',
        },
      },
    });

    if (practitionerEmail) {
      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'staff-new-booking-alert',
          recipientEmail: practitionerEmail,
          idempotencyKey: `staff-alert-${appt.id}`,
          templateData: {
            staffName: practitionerName,
            clientName: client.full_name ?? undefined,
            clientPhone: client.phone ?? undefined,
            clientEmail: client.email,
            treatment: appt.treatment,
            date: niceDate, time: niceTime,
            source: appt.source ?? 'staff_booking',
            adminUrl: `${APP_URL}/admin`,
          },
        },
      }).catch((e) => console.warn('staff alert failed', e?.message ?? e));
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('notify-booking-created error', e);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});