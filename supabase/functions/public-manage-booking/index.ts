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
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

interface InspectBody { token: string; action?: never; date?: never; time?: never }
interface CancelBody { token: string; action: 'cancel' }
interface RescheduleBody {
  token: string; action: 'reschedule'; date: string; time: string;
}
interface PortalBody { token: string; action: 'portal' }
interface UpdateProfileBody {
  token: string;
  action: 'update_profile';
  phone?: string;
  email?: string;
  location?: string;
  notes?: string;
}
interface ReportDataBody { token: string; action: 'report_data' }
interface ListPhotosBody { token: string; action: 'list_photos' }
interface PhotoUrlBody { token: string; action: 'photo_url'; media_id: string }
type Body =
  | InspectBody
  | CancelBody
  | RescheduleBody
  | PortalBody
  | UpdateProfileBody
  | ReportDataBody
  | ListPhotosBody
  | PhotoUrlBody;

// Light, dependency-free input validation for self-service profile edits.
const sanitizeStr = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
};
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const isPhone = (s: string) => /^[+\d][\d\s\-()]{5,24}$/.test(s);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  // Helper: handled client-facing failure. Returns HTTP 200 with
  // { ok:false, error, code } so supabase-js does NOT throw a
  // "non-2xx status code" error and the UI can map a friendly message.
  const fail = (code: string, error: string) =>
    new Response(JSON.stringify({ ok: false, error, code }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  try {
    const body = (await req.json()) as Body;
    if (!body?.token || typeof body.token !== 'string' || body.token.length < 16) {
      return fail('invalid_token', 'This link is invalid or has expired.');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: tokenRow, error: tokErr } = await supabase
      .from('booking_management_tokens')
      .select('id, appointment_id, expires_at, allowed_actions, used_at, used_action')
      .eq('token', body.token)
      .maybeSingle();
    if (tokErr) throw tokErr;
    if (!tokenRow) {
      return fail('token_not_found', 'This reschedule link is invalid or expired.');
    }
    if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
      return fail('token_expired', 'This reschedule link is invalid or expired.');
    }
    if (tokenRow.used_at) {
      return new Response(JSON.stringify({
        ok: false,
        code: 'token_used',
        error: 'This reschedule link has already been used.',
        used_action: tokenRow.used_action,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: appt, error: aErr } = await supabase
      .from('appointments')
      .select('id, client_id, date, time, treatment, status, assigned_aesthetician_id')
      .eq('id', tokenRow.appointment_id)
      .maybeSingle();
    if (aErr) throw aErr;
    if (!appt) {
      return fail('appointment_not_found', 'We could not find your appointment. Please contact Tropics MedSpa.');
    }

    const { data: client } = await supabase
      .from('clients').select('full_name, email').eq('id', appt.client_id).maybeSingle();

    // ---- Inspect (no action): return safe details for the manage page ----
    if (!body.action) {
      return new Response(JSON.stringify({
        appointment: {
          id: appt.id,
          date: appt.date, time: appt.time, treatment: appt.treatment, status: appt.status,
          client_name: client?.full_name ?? null,
        },
        allowed_actions: tokenRow.allowed_actions,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ---- Portal: rich client-facing dashboard payload ----
    // Returns: full client (subset), all visible appointments, journey timeline,
    // membership/spend snapshot, photos count. Token does not get consumed.
    if (body.action === 'portal' || body.action === 'report_data') {
      const { data: fullClient } = await supabase
        .from('clients')
        .select(
          'id, full_name, client_code, phone, email, gender, dob, location, notes, membership_type, status, treatment_plan, created_at',
        )
        .eq('id', appt.client_id)
        .maybeSingle();

      const { data: appointments } = await supabase
        .from('appointments')
        .select('id, date, time, treatment, status, notes, created_at')
        .eq('client_id', appt.client_id)
        .order('date', { ascending: false })
        .order('time', { ascending: false })
        .limit(50);

      const { data: journey } = await supabase
        .from('lead_journey_events')
        .select('id, status, note, occurred_at')
        .eq('client_id', appt.client_id)
        .order('occurred_at', { ascending: false })
        .limit(40);

      // Spend / membership snapshot from view (current month)
      const { data: spend } = await supabase
        .from('member_spend_monthly')
        .select('membership_type, spend_this_month, threshold, remaining_to_threshold, period')
        .eq('client_id', appt.client_id)
        .order('period', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Photo / report counts (no signed URLs returned to client)
      const { count: photoCount } = await supabase
        .from('client_media')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', appt.client_id)
        .eq('archived', false);

      // Recent photos preview (latest 6) – signed URLs valid for 1 hour.
      const { data: recentMedia } = await supabase
        .from('client_media')
        .select('id, kind, category, caption, file_name, mime_type, bucket_path, upload_date')
        .eq('client_id', appt.client_id)
        .eq('archived', false)
        .order('upload_date', { ascending: false })
        .limit(6);

      const recentPhotos = await Promise.all(
        (recentMedia ?? []).map(async (m: { id: string; kind: string; category: string | null; caption: string | null; file_name: string | null; mime_type: string | null; bucket_path: string; upload_date: string }) => {
          const { data: signed } = await supabase.storage
            .from('client-media')
            .createSignedUrl(m.bucket_path, 60 * 60);
          return {
            id: m.id,
            kind: m.kind,
            category: m.category,
            caption: m.caption,
            file_name: m.file_name,
            mime_type: m.mime_type,
            upload_date: m.upload_date,
            url: signed?.signedUrl ?? null,
          };
        }),
      );

      // Membership benefit allowances + this-month usage for the client's tier.
      const tier = (fullClient?.membership_type ?? 'none') as string;
      const periodYm = new Date().toISOString().slice(0, 7);
      const [allowancesRes, usageRes] = await Promise.all([
        supabase
          .from('membership_benefit_allowances')
          .select('benefit_type, benefit_label, monthly_limit')
          .eq('tier', tier)
          .eq('active', true),
        supabase
          .from('member_benefit_usage')
          .select('benefit_type, benefit_label, used_on')
          .eq('client_id', appt.client_id)
          .eq('period_year_month', periodYm),
      ]);
      const usageByType: Record<string, number> = {};
      (usageRes.data ?? []).forEach((u: { benefit_type: string }) => {
        usageByType[u.benefit_type] = (usageByType[u.benefit_type] ?? 0) + 1;
      });
      const benefits = (allowancesRes.data ?? []).map((a: { benefit_type: string; benefit_label: string; monthly_limit: number }) => ({
        benefit_type: a.benefit_type,
        benefit_label: a.benefit_label,
        monthly_limit: a.monthly_limit,
        used: usageByType[a.benefit_type] ?? 0,
        remaining: Math.max(0, a.monthly_limit - (usageByType[a.benefit_type] ?? 0)),
      }));

      return new Response(
        JSON.stringify({
          appointment: {
            id: appt.id,
            date: appt.date,
            time: appt.time,
            treatment: appt.treatment,
            status: appt.status,
          },
          client: fullClient,
          appointments: appointments ?? [],
          journey: journey ?? [],
          spend: spend ?? null,
          counts: { photos: photoCount ?? 0 },
          recent_photos: recentPhotos,
          benefits,
          allowed_actions: tokenRow.allowed_actions,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ---- List ALL photos for the client (paginated by client) ----
    if (body.action === 'list_photos') {
      const { data: media } = await supabase
        .from('client_media')
        .select('id, kind, category, caption, file_name, mime_type, bucket_path, upload_date, size_bytes')
        .eq('client_id', appt.client_id)
        .eq('archived', false)
        .order('upload_date', { ascending: false })
        .limit(100);

      const photos = await Promise.all(
        (media ?? []).map(async (m: { id: string; kind: string; category: string | null; caption: string | null; file_name: string | null; mime_type: string | null; bucket_path: string; upload_date: string; size_bytes: number | null }) => {
          const { data: signed } = await supabase.storage
            .from('client-media')
            .createSignedUrl(m.bucket_path, 60 * 60);
          return {
            id: m.id,
            kind: m.kind,
            category: m.category,
            caption: m.caption,
            file_name: m.file_name,
            mime_type: m.mime_type,
            size_bytes: m.size_bytes,
            upload_date: m.upload_date,
            url: signed?.signedUrl ?? null,
          };
        }),
      );

      return new Response(JSON.stringify({ photos }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- Single signed download URL on demand (3-hour ttl for downloads) ----
    if (body.action === 'photo_url') {
      const b = body as PhotoUrlBody;
      if (!b.media_id || typeof b.media_id !== 'string') {
        return new Response(JSON.stringify({ error: 'media_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: media } = await supabase
        .from('client_media')
        .select('id, client_id, bucket_path, file_name')
        .eq('id', b.media_id)
        .eq('client_id', appt.client_id)
        .maybeSingle();
      if (!media) {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: signed, error: sErr } = await supabase.storage
        .from('client-media')
        .createSignedUrl(media.bucket_path, 60 * 60 * 3, {
          download: media.file_name ?? undefined,
        });
      if (sErr || !signed) throw sErr ?? new Error('No signed URL');
      return new Response(JSON.stringify({ url: signed.signedUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- Self-service profile update (no token consumption) ----
    if (body.action === 'update_profile') {
      const b = body as UpdateProfileBody;
      const patch: Record<string, string> = {};
      if (b.phone !== undefined) {
        const p = sanitizeStr(b.phone, 32);
        if (p && !isPhone(p)) {
          return new Response(JSON.stringify({ error: 'Invalid phone number' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (p) patch.phone = p;
      }
      if (b.email !== undefined) {
        const e = sanitizeStr(b.email, 255);
        if (e && !isEmail(e)) {
          return new Response(JSON.stringify({ error: 'Invalid email address' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (e) patch.email = e.toLowerCase();
      }
      if (b.location !== undefined) {
        const l = sanitizeStr(b.location, 200);
        if (l) patch.location = l;
      }
      if (b.notes !== undefined) {
        const n = sanitizeStr(b.notes, 1000);
        if (n) patch.notes = n;
      }
      if (Object.keys(patch).length === 0) {
        return new Response(JSON.stringify({ error: 'Nothing to update' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { error: upErr } = await supabase
        .from('clients')
        .update(patch)
        .eq('id', appt.client_id);
      if (upErr) throw upErr;
      await supabase.from('lead_journey_events').insert({
        client_id: appt.client_id,
        status: 'profile_updated',
        note: `Self-service edit: ${Object.keys(patch).join(', ')}`,
      });
      return new Response(JSON.stringify({ ok: true, updated: Object.keys(patch) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!tokenRow.allowed_actions?.includes(body.action)) {
      return fail('action_not_allowed', 'This link does not allow that action.');
    }

    if (appt.status !== 'scheduled' && appt.status !== 'arrived') {
      return fail('appointment_locked', 'This appointment can no longer be rescheduled.');
    }

    let newDate = appt.date as string;
    let newTime = appt.time as string;

    if (body.action === 'cancel') {
      await supabase.from('appointments')
        .update({ status: 'cancelled' }).eq('id', appt.id);
      await supabase.from('lead_journey_events').insert({
        client_id: appt.client_id, status: 'cancelled',
        note: `Cancelled by client via secure link`,
      });
    } else if (body.action === 'reschedule') {
      const b = body as RescheduleBody;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date) || !/^\d{2}:\d{2}$/.test(b.time)) {
        return fail('invalid_datetime', 'Please pick a valid date and time.');
      }

      // Re-validate against business hours and capacity
      const dow = new Date(`${b.date}T00:00:00Z`).getUTCDay();
      const [hoursRes, settingsRes] = await Promise.all([
        supabase.from('business_hours').select('*').eq('day_of_week', dow).maybeSingle(),
        supabase.from('booking_settings').select('*').eq('id', true).maybeSingle(),
      ]);
      const hours = hoursRes.data;
      const slotMinutes = settingsRes.data?.slot_minutes ?? 60;
      if (!hours || hours.is_open === false) {
        return fail('closed_day', 'We are closed on that day. Please pick another date.');
      }
      const reqMin = toMin(b.time);
      const startMin = hours.is_24h ? 0 : toMin(String(hours.open_time).slice(0, 5));
      const endMin = hours.is_24h ? 24 * 60 : toMin(String(hours.close_time).slice(0, 5));
      if (reqMin < startMin || reqMin + slotMinutes > endMin || ((reqMin - startMin) % slotMinutes) !== 0) {
        return fail('outside_hours', 'That time is outside our business hours.');
      }

      // ---- Capacity check: don't move into a slot already saturated ----
      const activeAest = await supabase.rpc('count_active_aestheticians');
      const capacity = (activeAest.data ?? 0) as number;
      if (capacity > 0) {
        const reqEnd = reqMin + slotMinutes;
        const { data: dayAppts } = await supabase
          .from('appointments')
          .select('id, time')
          .eq('date', b.date)
          .in('status', ['scheduled', 'arrived']);
        const overlap = (dayAppts ?? []).filter((row: { id: string; time: string }) => {
          if (row.id === appt.id) return false;
          const s = toMin(String(row.time).slice(0, 5));
          return s < reqEnd && s + slotMinutes > reqMin;
        }).length;
        if (overlap >= capacity) {
          return fail('slot_full', 'The selected time is no longer available.');
        }
      }

      const { error: upErr } = await supabase
        .from('appointments')
        .update({
          date: b.date,
          time: b.time,
          status: 'scheduled',
          // Reset reminder stamps so 24h + 1h reminders fire for the new time
          reminder_sent_at: null,
          reminder_1h_sent_at: null,
        })
        .eq('id', appt.id);
      if (upErr) {
        console.error('reschedule: appointment update failed', {
          appointment_id: appt.id, client_id: appt.client_id,
          old: { date: appt.date, time: appt.time },
          new: { date: b.date, time: b.time },
          code: (upErr as { code?: string }).code, message: upErr.message,
        });
        if ((upErr as { code?: string }).code === '23505') {
          return fail('slot_full', 'The selected time is no longer available.');
        }
        return fail('update_failed', 'We could not update your appointment. Please contact Tropics MedSpa.');
      }
      newDate = b.date; newTime = b.time;
      await supabase.from('lead_journey_events').insert({
        client_id: appt.client_id, status: 'rescheduled',
        note: `Rescheduled by client via secure link to ${b.date} ${b.time}`,
      });
      console.info('reschedule: appointment updated', {
        appointment_id: appt.id, client_id: appt.client_id,
        old: { date: appt.date, time: appt.time },
        new: { date: b.date, time: b.time },
      });
    }

    // Mark token used (single use)
    await supabase.from('booking_management_tokens')
      .update({ used_at: new Date().toISOString(), used_action: body.action })
      .eq('id', tokenRow.id);

    // Send a small confirmation email of the change.
    // - Cancel  → use the cancel-reschedule template (with a Book again CTA)
    // - Reschedule → use the booking-confirmation template, but mint a NEW
    //   manage token (the original one was just consumed) so the email links
    //   actually work for the new appointment time.
    let emailStatus: 'sent' | 'failed' | 'skipped' = client?.email ? 'sent' : 'skipped';
    if (client?.email) {
      const niceDate = formatHumanDate(newDate);
      const niceTime = formatHumanTime(newTime);
      const action = body.action;
      const whatsappUrl = await buildWhatsAppDeepLink(
        supabase, client.full_name, appt.treatment as string, niceDate, niceTime,
      );
      if (action === 'cancel') {
        const { error: eErr } = await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'booking-cancel-reschedule',
            recipientEmail: client.email,
            idempotencyKey: `booking-cancel-${appt.id}`,
            templateData: {
              clientName: client.full_name ?? undefined,
              treatment: appt.treatment,
              date: formatHumanDate(appt.date as string),
              time: formatHumanTime(appt.time as string),
              rebookUrl: `${APP_URL}/book`,
              whatsappUrl,
            },
          },
        }).catch((e) => ({ error: e }));
        if (eErr) { emailStatus = 'failed'; console.warn('cancel email failed', (eErr as Error)?.message ?? eErr); }
      } else {
        const newToken = await ensureManageToken(supabase, appt.id, newDate, newTime);
        const manageUrl = `${APP_URL}/manage-booking?token=${newToken}`;
        const { error: eErr } = await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'booking-confirmation',
            // Distinct key per (date,time) so reschedule retries don't dedupe
            // against the original confirmation
            idempotencyKey: `booking-reschedule-${appt.id}-${newDate}-${newTime}`,
            recipientEmail: client.email,
            templateData: {
              clientName: client.full_name ?? undefined,
              treatment: appt.treatment,
              date: niceDate, time: niceTime,
              manageUrl,
              whatsappUrl,
              location: 'Tropics MedSpa, Wonderland Estate, Kukwaba, Abuja',
            },
          },
        }).catch((e) => ({ error: e }));
        if (eErr) { emailStatus = 'failed'; console.warn('reschedule email failed', (eErr as Error)?.message ?? eErr); }
      }
    }

    // If the confirmation email failed, notify front desk to follow up
    // manually. The appointment change has already been persisted.
    if (emailStatus === 'failed') {
      try {
        await supabase.rpc('emit_notification', {
          _category: 'booking',
          _kind: body.action === 'cancel' ? 'cancel_email_failed' : 'reschedule_email_failed',
          _severity: 'warning',
          _title: body.action === 'cancel'
            ? 'Cancellation email failed — contact client'
            : 'Reschedule confirmation email failed — contact client',
          _body: [
            `${client?.full_name ?? 'Client'} ${body.action === 'cancel' ? 'cancelled' : 'rescheduled'} via secure link.`,
            `Treatment: ${appt.treatment ?? '—'}`,
            `When: ${formatHumanDate(newDate)} at ${formatHumanTime(newTime)}`,
            client?.email ? `Email on file: ${client.email}` : 'No email on file',
          ].join('\n'),
          _subject_user_id: null,
          _target_table: 'appointments',
          _target_id: appt.id,
          _metadata: { client_id: appt.client_id, reason: 'email_send_failed', action: body.action },
          _recipient_user_ids: [],
          _include_admins: true,
          _include_subject: false,
        });
      } catch (e) {
        console.warn('reschedule: staff notify threw', (e as Error)?.message ?? e);
      }
    }

    console.info('public-manage-booking: done', {
      action: body.action, appointment_id: appt.id, client_id: appt.client_id,
      email_status: emailStatus,
    });

    return new Response(JSON.stringify({
      ok: true, action: body.action,
      email_status: emailStatus,
      appointment: { id: appt.id, date: newDate, time: newTime, status: body.action === 'cancel' ? 'cancelled' : 'scheduled' },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('public-manage-booking error', (e as Error)?.message ?? e, (e as Error)?.stack);
    return new Response(JSON.stringify({
      ok: false,
      code: 'server_error',
      error: 'We could not update your appointment. Please contact Tropics MedSpa.',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});