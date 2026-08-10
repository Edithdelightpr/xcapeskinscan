import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const normalizePhone = (p: string) => p.replace(/\D/g, '');
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const SUSPICIOUS_PATTERNS = [
  /<\s*script/i,
  /https?:\/\/[^\s]+\.(ru|cn|tk|xyz)\b/i,
  /\b(viagra|casino|loan|crypto airdrop)\b/i,
];
const looksSuspicious = (s?: string | null) =>
  !!s && SUSPICIOUS_PATTERNS.some((re) => re.test(s));

interface BookingInput {
  full_name: string;
  phone: string;
  email: string;
  gender?: string;
  age_group?: string;
  treatment: string;
  /** Optional cart of service IDs. When provided, one appointment per service is
      created back-to-back starting at the chosen time. */
  service_ids?: string[];
  /** Booking purpose. When omitted, falls back to legacy detection:
      - 'consultation' / 'skin_analysis' / 'follow_up' / 'product_enquiry' /
        'treatment_discussion' → free, no service required, no payment flow.
      - 'service' → existing paid-service flow (requires service_ids or
        a treatment label). */
  appointment_type?: 'consultation' | 'skin_analysis' | 'service' | 'follow_up' | 'product_enquiry' | 'treatment_discussion';
  date: string;
  time: string;
  notes?: string;
  slug?: string;
  /** Campaign attribution captured from URL query params on the public site.
      Stored on the new client row inside `referral_meta` so admin reports
      can group leads by campaign / source / medium. */
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  website?: string;
  rendered_at?: number;
  /** Returning client picked themselves from the autocomplete; if set we skip
      the find-or-create scan and use this client_id directly so attribution
      stays with the original recommender. */
  returning_client_id?: string;
  /** True when the client is filling the form at the front-desk QR.
      We force the date to today and tag the appointment as a walk-in so
      reception sees it land in real time. */
  walkin?: boolean;
}

const baseValidate = (b: Partial<BookingInput>): string | null => {
  if (!b.full_name || typeof b.full_name !== 'string' || b.full_name.trim().length < 2 || b.full_name.length > 100)
    return 'Invalid name';
  if (/[<>]|https?:\/\//i.test(b.full_name) || /^\d+$/.test(b.full_name.trim()))
    return 'Invalid name';
  if (!b.phone || typeof b.phone !== 'string') return 'Invalid phone';
  const digits = normalizePhone(b.phone);
  if (digits.length < 7 || digits.length > 15) return 'Invalid phone number';
  if (!b.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email) || b.email.length > 255) return 'Invalid email';
  if (b.treatment !== undefined && b.treatment !== null) {
    if (typeof b.treatment !== 'string' || b.treatment.length > 200) return 'Invalid treatment';
  }
  if (!b.date || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return 'Invalid date';
  if (!b.time || !/^\d{2}:\d{2}$/.test(b.time)) return 'Invalid time';
  if (b.notes && b.notes.length > 500) return 'Notes too long';
  if (b.gender && b.gender.length > 40) return 'Invalid gender';
  if (b.age_group && b.age_group.length > 20) return 'Invalid age group';
  if (b.slug && (typeof b.slug !== 'string' || b.slug.length > 80 || !/^[a-z0-9-]+$/i.test(b.slug)))
    return 'Invalid booking link';
  for (const k of ['utm_source','utm_medium','utm_campaign','utm_content'] as const) {
    const v = (b as Record<string, unknown>)[k];
    if (v !== undefined && v !== null) {
      if (typeof v !== 'string' || v.length > 80) return 'Invalid campaign tag';
    }
  }
  if (b.service_ids !== undefined) {
    if (!Array.isArray(b.service_ids) || b.service_ids.length === 0 || b.service_ids.length > 6) {
      return 'Invalid service selection';
    }
    if (!b.service_ids.every((id) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id))) {
      return 'Invalid service id';
    }
  }
  if (looksSuspicious(b.full_name) || looksSuspicious(b.notes) || looksSuspicious(b.treatment))
    return 'Submission rejected';
  return null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = (await req.json()) as Partial<BookingInput>;

    // Defense in depth: walk-in submissions must always be for today.
    // The client UI also locks the date picker, but we re-pin it here so
    // a tampered request can't book a future date through the QR.
    if (body.walkin === true) {
      const todayIso = new Date().toISOString().slice(0, 10);
      body.date = todayIso;
    }

    // Honeypot
    if (typeof body.website === 'string' && body.website.length > 0) {
      return new Response(JSON.stringify({ booking_reference: 'ok' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Bot timing check
    if (typeof body.rendered_at === 'number' && Number.isFinite(body.rendered_at)) {
      const elapsedMs = Date.now() - body.rendered_at;
      if (elapsedMs >= 0 && elapsedMs < 1500) {
        return new Response(JSON.stringify({ booking_reference: 'ok' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const baseErr = baseValidate(body);
    if (baseErr) {
      return new Response(JSON.stringify({ error: baseErr }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const dow = new Date(`${body.date}T00:00:00Z`).getUTCDay();
    const [hoursRes, settingsRes] = await Promise.all([
      supabase.from('business_hours').select('*').eq('day_of_week', dow).maybeSingle(),
      supabase.from('booking_settings').select('*').eq('id', true).maybeSingle(),
    ]);

    const hours = hoursRes.data;
    const settings = settingsRes.data;
    const slotMinutes = settings?.slot_minutes ?? 60;
    const maxDays = settings?.max_days_ahead ?? 90;

    if (!hours || hours.is_open === false) {
      return new Response(JSON.stringify({ error: 'We are closed on this day' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Date range check
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const target = new Date(`${body.date}T00:00:00Z`);
    const diffDays = Math.floor((target.getTime() - today.getTime()) / 86_400_000);
    if (diffDays < 0) return new Response(JSON.stringify({ error: 'Date cannot be in the past' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (diffDays > maxDays) return new Response(JSON.stringify({ error: `Date too far ahead (max ${maxDays} days)` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Time within hours, aligned to slot
    const reqMin = toMin(body.time!);
    const startMin = hours.is_24h ? 0 : toMin(String(hours.open_time).slice(0, 5));
    const endMin = hours.is_24h ? 24 * 60 : toMin(String(hours.close_time).slice(0, 5));
    if (reqMin < startMin || reqMin + slotMinutes > endMin) {
      return new Response(JSON.stringify({ error: 'Time is outside business hours' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (((reqMin - startMin) % slotMinutes) !== 0) {
      return new Response(JSON.stringify({ error: `Time must align to a ${slotMinutes}-minute slot` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // Reject past times when booking for today (UTC, matching the rest of this fn)
    if (diffDays === 0) {
      const now = new Date();
      const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
      if (reqMin <= nowMin) {
        return new Response(JSON.stringify({ error: 'That time has already passed today' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Lead-attribution staff (slug)
    let attributedStaffId: string | null = null;
    if (body.slug) {
      const { data: staffRows } = await supabase.rpc('get_staff_by_slug', { _slug: body.slug });
      if (staffRows && staffRows.length > 0) attributedStaffId = staffRows[0].id;
    }

    const fullName = body.full_name!.trim();
    const phoneRaw = body.phone!.trim();
    const phoneDigits = normalizePhone(phoneRaw);
    const emailLower = body.email!.trim().toLowerCase();

    // ---- Resolve client (returning client takes precedence) ----
    let clientId: string | null = null;
    let clientOriginalAttribution: string | null = null;

    if (typeof body.returning_client_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.returning_client_id)) {
      const { data: existingC } = await supabase
        .from('clients')
        .select('id, attributed_staff_id, archived')
        .eq('id', body.returning_client_id)
        .maybeSingle();
      if (existingC && !existingC.archived) {
        clientId = existingC.id;
        clientOriginalAttribution = existingC.attributed_staff_id;
      }
    }

    if (!clientId) {
      const { data: candidates, error: candErr } = await supabase
        .from('clients').select('id, full_name, phone, email, attributed_staff_id')
        .eq('archived', false).limit(2000);
      if (candErr) throw candErr;
      const existing = (candidates ?? []).find((c: { phone: string | null; email: string | null }) => {
        if (c.phone && normalizePhone(c.phone) === phoneDigits) return true;
        if (c.email && c.email.toLowerCase() === emailLower) return true;
        return false;
      });
      if (existing) {
        clientId = existing.id;
        clientOriginalAttribution = existing.attributed_staff_id;
      } else {
        // Build referral_meta from any UTM params + the slug, so admin
        // can answer "where did this lead come from?" without joining.
        const referralMeta: Record<string, string> = {};
        if (body.slug) referralMeta.slug = body.slug;
        if (body.utm_source) referralMeta.utm_source = body.utm_source;
        if (body.utm_medium) referralMeta.utm_medium = body.utm_medium;
        if (body.utm_campaign) referralMeta.utm_campaign = body.utm_campaign;
        if (body.utm_content) referralMeta.utm_content = body.utm_content;
        referralMeta.first_seen_at = new Date().toISOString();

        const { data: newClient, error: insErr } = await supabase
          .from('clients').insert({
            full_name: fullName, phone: phoneRaw, email: emailLower,
            gender: body.gender || null,
            age_group: body.age_group || null,
            source_type: 'public_booking',
            status: 'lead', attributed_staff_id: attributedStaffId,
            referral_meta: referralMeta,
            // First-verified-capture-wins: lock acquisition on creation.
            acquisition_owner_id: attributedStaffId,
            original_source: body.slug ? 'referral' : 'public_booking',
            acquisition_locked: true,
            first_seen_at: new Date().toISOString(),
          }).select('id').single();
        if (insErr) throw insErr;
        clientId = newClient.id;
      }
    }

    // Returning clients keep their original attribution; the slug is just a touch-point.
    const effectiveAttribution = clientOriginalAttribution ?? attributedStaffId;

    // ---- Resolve cart (services) ----
    type Svc = { id: string; name: string; price: number; duration: number };
    let cart: Svc[] = [];
    if (Array.isArray(body.service_ids) && body.service_ids.length > 0) {
      const { data: svcRows, error: svcErr } = await supabase
        .from('services')
        .select('id, name, price_per_session, duration_minutes, active')
        .in('id', body.service_ids);
      if (svcErr) throw svcErr;
      const byId = new Map(
        (svcRows ?? []).map((s: { id: string; name: string; price_per_session: number | null; duration_minutes: number | null; active: boolean }) =>
          [s.id, s] as const,
        ),
      );
      // Preserve user's chosen order
      for (const id of body.service_ids) {
        const s = byId.get(id);
        if (!s || !s.active) {
          return new Response(JSON.stringify({ error: 'Invalid service in cart' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        cart.push({
          id: s.id,
          name: s.name,
          price: Number(s.price_per_session) || 0,
          duration: Number(s.duration_minutes) || slotMinutes,
        });
      }
    } else {
      // Fallback: free-text treatment (or consultation), single appointment.
      // When no treatment label is supplied at all, default to "Free Consultation"
      // so legacy reports always have a human-readable label.
      const fallbackName = body.treatment?.trim() || 'Free Consultation';
      cart = [{ id: '', name: fallbackName, price: 0, duration: slotMinutes }];
    }

    const totalAmount = cart.reduce((sum, s) => sum + s.price, 0);

    // ---- Eligible recipients + service_experts mapping ----
    // Source of truth lives in `public.list_eligible_receivers` so role rules
    // never drift across forms / edge functions. Consultations widen the pool
    // to include admin + front desk; everything else stays clinical-only.
    const CONSULTATION_TYPES = new Set([
      'consultation', 'skin_analysis', 'follow_up', 'product_enquiry', 'treatment_discussion',
    ]);
    // Resolve appointment type. Explicit body.appointment_type wins; otherwise
    // legacy heuristic: real services in cart → 'service'; "free consultation"
    // treatment label → 'consultation'; anything else with a treatment → 'service'.
    const hasRealServices = Array.isArray(body.service_ids) && body.service_ids.length > 0;
    let appointmentType: string;
    if (body.appointment_type && (CONSULTATION_TYPES.has(body.appointment_type) || body.appointment_type === 'service')) {
      appointmentType = body.appointment_type;
    } else if (hasRealServices) {
      appointmentType = 'service';
    } else if (typeof body.treatment === 'string' && body.treatment.trim().toLowerCase() === 'free consultation') {
      appointmentType = 'consultation';
    } else if (!body.treatment || !body.treatment.trim()) {
      appointmentType = 'consultation';
    } else {
      appointmentType = 'service';
    }
    const isConsultation = CONSULTATION_TYPES.has(appointmentType);
    const receiverKind: 'treatment' | 'consultation' = isConsultation ? 'consultation' : 'treatment';
    const { data: receiverRows, error: rErr } = await supabase
      .rpc('list_eligible_receivers', { _kind: receiverKind });
    if (rErr) throw rErr;
    const aestList: { id: string; name: string; email: string | null }[] =
      (receiverRows ?? []).map((s: { id: string; full_name: string | null; email: string | null }) => ({
        id: s.id, name: s.full_name ?? '', email: s.email,
      }));
    if (aestList.length === 0) {
      return new Response(JSON.stringify({
          error: 'NO_AESTHETICIAN',
          message: isConsultation
            ? 'No staff is available to take this consultation right now. Please try again shortly.'
            : 'No aesthetician available right now — please try another time slot.',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Pull the experts mapping for the cart's services
    const cartServiceIds = cart.map((c) => c.id).filter((x) => x);
    let expertsByService = new Map<string, Set<string>>();
    if (cartServiceIds.length > 0) {
      const { data: expertRows } = await supabase
        .from('service_experts')
        .select('service_id, staff_user_id')
        .in('service_id', cartServiceIds);
      (expertRows ?? []).forEach((r: { service_id: string; staff_user_id: string }) => {
        if (!expertsByService.has(r.service_id)) expertsByService.set(r.service_id, new Set());
        expertsByService.get(r.service_id)!.add(r.staff_user_id);
      });
    }

    // Daily and weekly load per practitioner — used for fairness rotation
    const bookingDate = body.date!;
    const weekStart = new Date(`${bookingDate}T00:00:00Z`);
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
    const weekStartIso = weekStart.toISOString().slice(0, 10);

    const [{ data: dayAppts }, { data: weekAppts }] = await Promise.all([
      supabase.from('appointments').select('time, assigned_aesthetician_id, date')
        .eq('date', bookingDate).in('status', ['scheduled', 'arrived']),
      supabase.from('appointments').select('assigned_aesthetician_id')
        .gte('date', weekStartIso).lte('date', bookingDate)
        .in('status', ['scheduled', 'arrived']),
    ]);

    const dailyLoad = new Map<string, number>();
    const weeklyLoad = new Map<string, number>();
    aestList.forEach((a) => { dailyLoad.set(a.id, 0); weeklyLoad.set(a.id, 0); });
    (dayAppts ?? []).forEach((a: { assigned_aesthetician_id: string | null }) => {
      if (a.assigned_aesthetician_id && dailyLoad.has(a.assigned_aesthetician_id)) {
        dailyLoad.set(a.assigned_aesthetician_id, (dailyLoad.get(a.assigned_aesthetician_id) ?? 0) + 1);
      }
    });
    (weekAppts ?? []).forEach((a: { assigned_aesthetician_id: string | null }) => {
      if (a.assigned_aesthetician_id && weeklyLoad.has(a.assigned_aesthetician_id)) {
        weeklyLoad.set(a.assigned_aesthetician_id, (weeklyLoad.get(a.assigned_aesthetician_id) ?? 0) + 1);
      }
    });

    // Track which slots get used by *this booking* so back-to-back appointments
    // don't all double-book the same practitioner.
    const slotOverlap = new Map<string, Set<string>>(); // slotKey "HH:MM" → set of practitioner ids busy at that slot
    (dayAppts ?? []).forEach((a: { time: string; assigned_aesthetician_id: string | null }) => {
      const key = String(a.time).slice(0, 5);
      if (!a.assigned_aesthetician_id) return;
      if (!slotOverlap.has(key)) slotOverlap.set(key, new Set());
      slotOverlap.get(key)!.add(a.assigned_aesthetician_id);
    });

    const pickPractitionerFor = (svc: Svc, slotMin: number): { id: string; name: string; email: string | null } | null => {
      const slotKey = `${String(Math.floor(slotMin / 60)).padStart(2, '0')}:${String(slotMin % 60).padStart(2, '0')}`;
      const busyAtSlot = slotOverlap.get(slotKey) ?? new Set<string>();
      const expertSet = expertsByService.get(svc.id);
      // Prefer experts for this service if any are mapped & not busy
      const candidates = aestList.filter((a) => !busyAtSlot.has(a.id));
      if (candidates.length === 0) return null;
      const preferExperts = expertSet && candidates.some((a) => expertSet.has(a.id))
        ? candidates.filter((a) => expertSet.has(a.id))
        : candidates;
      // Sort by daily then weekly load (fair rotation)
      preferExperts.sort((a, b) => {
        const d = (dailyLoad.get(a.id) ?? 0) - (dailyLoad.get(b.id) ?? 0);
        if (d !== 0) return d;
        return (weeklyLoad.get(a.id) ?? 0) - (weeklyLoad.get(b.id) ?? 0);
      });
      return preferExperts[0];
    };

    // ---- Build appointments back-to-back ----
    const bookingGroupId = crypto.randomUUID();
    const createdAppts: Array<{ id: string; service_name: string; time: string; practitioner: { id: string; name: string; email: string | null } }> = [];
    let cursorMin = reqMin;
    for (const svc of cart) {
      // Confirm slot is within hours
      if (cursorMin + svc.duration > endMin) {
        return new Response(JSON.stringify({
          error: 'OVERFLOW_HOURS',
          message: `Your selection runs past closing time. Please pick an earlier slot or remove a service.`,
        }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const slotMin = cursorMin;
      const practitioner = pickPractitionerFor(svc, slotMin);
      if (!practitioner) {
        return new Response(JSON.stringify({
          error: 'SLOT_FULL',
          message: 'A slot in your selection is fully booked. Please pick a different time.',
        }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const slotKey = `${String(Math.floor(slotMin / 60)).padStart(2, '0')}:${String(slotMin % 60).padStart(2, '0')}`;
      // Reserve in our local map for back-to-back logic
      if (!slotOverlap.has(slotKey)) slotOverlap.set(slotKey, new Set());
      slotOverlap.get(slotKey)!.add(practitioner.id);
      dailyLoad.set(practitioner.id, (dailyLoad.get(practitioner.id) ?? 0) + 1);
      weeklyLoad.set(practitioner.id, (weeklyLoad.get(practitioner.id) ?? 0) + 1);

      const { data: appt, error: apptErr } = await supabase
        .from('appointments').insert({
          client_id: clientId,
          date: body.date,
          time: slotKey,
          treatment: svc.name,
          status: 'scheduled',
          source: 'public_booking',
          attributed_staff_id: effectiveAttribution,
          referral_owner_id: attributedStaffId,
          assigned_aesthetician_id: practitioner.id,
          notes: body.notes || null,
          payment_status: isConsultation ? 'not_applicable' : 'awaiting_confirmation',
          total_amount: isConsultation ? 0 : (svc.price || null),
          appointment_type: appointmentType,
          booking_group_id: bookingGroupId,
          is_walk_in: body.walkin === true,
        }).select('id').single();
      if (apptErr) {
        if ((apptErr as { code?: string }).code === '23505') {
          return new Response(JSON.stringify({
              error: 'SLOT_FULL',
              message: 'That time was just taken. Please pick a different time.',
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        throw apptErr;
      }
      createdAppts.push({ id: appt.id, service_name: svc.name, time: slotKey, practitioner });
      cursorMin += svc.duration;
    }

    const firstAppt = createdAppts[0];
    const chosen = firstAppt.practitioner;
    const treatmentValue = cart.map((c) => c.name).join(' + ');

    // Lead journey log (non-fatal). Supabase query builders are thenables,
    // not real Promises, so use try/await/catch — never `.catch()` on them.
    try {
      const { error: journeyErr } = await supabase.from('lead_journey_events').insert({
        client_id: clientId, status: 'self_scheduled',
        by_staff_id: effectiveAttribution,
        note: `Booked ${treatmentValue} for ${body.date} ${body.time} via public link (assigned: ${chosen.name}) — awaiting payment`,
      });
      if (journeyErr) console.warn('journey log failed', journeyErr.message);
    } catch (e) {
      console.warn('journey log threw', (e as Error)?.message ?? e);
    }

    // Notify all admins about the new booking (non-fatal). Consultations are
    // free, so the alert is a heads-up — not a payment task.
    try {
      const { error: notifyErr } = await supabase.rpc('emit_notification', {
        _category: 'booking',
        _kind: isConsultation ? 'new_booking' : 'payment_pending',
        _severity: 'info',
        _title: isConsultation ? 'New consultation booked' : 'New booking — payment to confirm',
        _body: isConsultation
          ? `${fullName} booked a ${treatmentValue.toLowerCase()} on ${body.date} at ${body.time}.`
          : `${fullName} booked ${treatmentValue} on ${body.date} at ${body.time}. Total ₦${totalAmount.toLocaleString()}.`,
        _subject_user_id: null,
        _target_table: 'appointments',
        _target_id: firstAppt.id,
        _metadata: { booking_group_id: bookingGroupId, total_amount: totalAmount, client_id: clientId },
        _recipient_user_ids: null,
        _include_admins: true,
        _include_subject: false,
      });
      if (notifyErr) console.warn('admin notify failed', notifyErr.message);
    } catch (e) {
      console.warn('admin notify threw', (e as Error)?.message ?? e);
    }

    // ---- Notifications: confirmation to client + alert to assigned aesthetician ----
    try {
      // Single source of truth for booking-created emails is
      // `notify-booking-created` (sends client confirmation + staff alert,
      // or emits a front-desk no-email notification when the client has
      // no email on file). Non-fatal.
      const { error: nErr } = await supabase.functions.invoke('notify-booking-created', {
        body: { appointment_id: firstAppt.id },
      });
      if (nErr) console.warn('notify-booking-created failed', nErr.message);
    } catch (e) {
      console.warn('notification dispatch failed', e instanceof Error ? e.message : e);
    }

    return new Response(JSON.stringify({
      booking_reference: firstAppt.id,
      booking_group_id: bookingGroupId,
      date: body.date, time: body.time,
      treatment: treatmentValue,
      assigned_aesthetician_name: chosen.name,
      slot_minutes: slotMinutes,
      total_amount: totalAmount,
      payment_status: isConsultation ? 'not_applicable' : 'awaiting_confirmation',
      appointment_type: appointmentType,
      appointments: createdAppts.map((a) => ({
        id: a.id, time: a.time, service_name: a.service_name,
        practitioner_name: a.practitioner.name,
      })),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('public-create-booking error', e);
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({
        error: 'SERVER_ERROR',
        message: 'Something went wrong on our end. Please try again, or message us on WhatsApp and we will book you in personally.',
        detail: msg,
      }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
