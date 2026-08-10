import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

interface Body {
  client_id: string;
  /** Optional cart of service UUIDs. Required only when
      appointment_type === 'service'. Consultations / follow-ups / enquiries
      should be booked with no services. */
  service_ids?: string[];
  /** Booking purpose. Defaults to 'consultation' so the staff "book on behalf"
      flow no longer forces a service pick. */
  appointment_type?: 'consultation' | 'skin_analysis' | 'service' | 'follow_up' | 'product_enquiry' | 'treatment_discussion';
  /** Optional human-readable label for non-service bookings
      (e.g. "Skin analysis"). Defaults to a sensible value derived from type. */
  treatment_label?: string;
  date: string;
  time: string;
  notes?: string;
}

const isUuid = (s: unknown): s is string =>
  typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/**
 * Front-desk-only "book on behalf" endpoint. Mirrors the validation in
 * public-create-booking but:
 *  - requires an authenticated admin / front_desk caller
 *  - takes an existing client_id (no find-or-create scan)
 *  - rejects past times even when the requested date is today
 *  - restricts practitioner picking to staff mapped via service_experts
 *    (skill match) when such a mapping exists for the service.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user?.id) return json({ error: 'Unauthorized' }, 401);
    const userId = userData.user.id;

    // Service-role client for DB writes (bypasses RLS, but we already auth-checked).
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Role gate: must be admin or front_desk
    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
    if (!roles.includes('admin') && !roles.includes('front_desk')) {
      return json({ error: 'Forbidden — front desk or admin only' }, 403);
    }

    const body = (await req.json()) as Partial<Body>;
    if (!isUuid(body.client_id)) return json({ error: 'Invalid client' }, 400);
    const CONSULTATION_TYPES = new Set([
      'consultation', 'skin_analysis', 'follow_up', 'product_enquiry', 'treatment_discussion',
    ]);
    const appointmentType = body.appointment_type ?? 'consultation';
    if (!CONSULTATION_TYPES.has(appointmentType) && appointmentType !== 'service') {
      return json({ error: 'Invalid appointment type' }, 400);
    }
    const isConsultation = CONSULTATION_TYPES.has(appointmentType);
    if (appointmentType === 'service') {
      if (!Array.isArray(body.service_ids) || body.service_ids.length === 0 || body.service_ids.length > 6)
        return json({ error: 'Pick at least one service' }, 400);
      if (!body.service_ids.every(isUuid)) return json({ error: 'Invalid service id' }, 400);
    } else if (body.service_ids && body.service_ids.length > 0) {
      return json({ error: 'Consultation bookings cannot include services' }, 400);
    }
    if (body.treatment_label && (typeof body.treatment_label !== 'string' || body.treatment_label.length > 200)) {
      return json({ error: 'Invalid treatment label' }, 400);
    }
    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return json({ error: 'Invalid date' }, 400);
    if (!body.time || !/^\d{2}:\d{2}$/.test(body.time)) return json({ error: 'Invalid time' }, 400);
    if (body.notes && body.notes.length > 500) return json({ error: 'Notes too long' }, 400);

    // ---- Hours / settings ----
    const dow = new Date(`${body.date}T00:00:00Z`).getUTCDay();
    const [hoursRes, settingsRes] = await Promise.all([
      supabase.from('business_hours').select('*').eq('day_of_week', dow).maybeSingle(),
      supabase.from('booking_settings').select('*').eq('id', true).maybeSingle(),
    ]);
    const hours = hoursRes.data;
    const settings = settingsRes.data;
    const slotMinutes = settings?.slot_minutes ?? 60;
    const maxDays = settings?.max_days_ahead ?? 90;

    if (!hours || hours.is_open === false) return json({ error: 'We are closed on this day' }, 400);

    // ---- Date in range ----
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const target = new Date(`${body.date}T00:00:00Z`);
    const diffDays = Math.floor((target.getTime() - today.getTime()) / 86_400_000);
    if (diffDays < 0) return json({ error: 'Date cannot be in the past' }, 400);
    if (diffDays > maxDays) return json({ error: `Date too far ahead (max ${maxDays} days)` }, 400);

    // ---- Time within hours, slot-aligned, and not in the past today ----
    const reqMin = toMin(body.time!);
    const startMin = hours.is_24h ? 0 : toMin(String(hours.open_time).slice(0, 5));
    const endMin = hours.is_24h ? 24 * 60 : toMin(String(hours.close_time).slice(0, 5));
    if (reqMin < startMin || reqMin + slotMinutes > endMin)
      return json({ error: 'Time is outside business hours' }, 400);
    if (((reqMin - startMin) % slotMinutes) !== 0)
      return json({ error: `Time must align to a ${slotMinutes}-minute slot` }, 400);
    if (diffDays === 0) {
      const now = new Date();
      const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
      if (reqMin <= nowMin) return json({ error: 'That time has already passed today' }, 400);
    }

    // ---- Verify client exists ----
    const { data: clientRow } = await supabase
      .from('clients')
      .select('id, full_name, attributed_staff_id, archived')
      .eq('id', body.client_id!)
      .maybeSingle();
    if (!clientRow || clientRow.archived) return json({ error: 'Client not found' }, 404);

    // ---- Resolve cart ----
    type Svc = { id: string; name: string; price: number; duration: number };
    const TYPE_LABELS: Record<string, string> = {
      consultation: 'Free Consultation',
      skin_analysis: 'Skin Analysis',
      follow_up: 'Follow-up',
      product_enquiry: 'Product Enquiry',
      treatment_discussion: 'Treatment Discussion',
    };
    let cart: Svc[] = [];
    if (appointmentType === 'service') {
      const { data: svcRows, error: svcErr } = await supabase
        .from('services')
        .select('id, name, price_per_session, duration_minutes, active')
        .in('id', body.service_ids!);
      if (svcErr) throw svcErr;
      const byId = new Map(
        (svcRows ?? []).map(
          (s: { id: string; name: string; price_per_session: number | null; duration_minutes: number | null; active: boolean }) =>
            [s.id, s] as const,
        ),
      );
      for (const id of body.service_ids!) {
        const s = byId.get(id);
        if (!s || !s.active) return json({ error: 'Invalid or inactive service in cart' }, 400);
        cart.push({
          id: s.id,
          name: s.name,
          price: Number(s.price_per_session) || 0,
          duration: Number(s.duration_minutes) || slotMinutes,
        });
      }
    } else {
      // Consultation / follow-up / enquiry — one zero-cost slot, no service id.
      cart = [{
        id: '',
        name: body.treatment_label?.trim() || TYPE_LABELS[appointmentType] || 'Consultation',
        price: 0,
        duration: slotMinutes,
      }];
    }
    const totalAmount = cart.reduce((sum, s) => sum + s.price, 0);

    // ---- Active aestheticians ----
    const { data: aestRoleRows } = await supabase
      .from('user_roles').select('user_id').eq('role', 'medical_aesthetician');
    const userIds = (aestRoleRows ?? []).map((r: { user_id: string }) => r.user_id);
    let aestList: { id: string; name: string; email: string | null }[] = [];
    if (userIds.length > 0) {
      const { data: staffRows } = await supabase
        .from('staff_users').select('id, full_name, email')
        .in('id', userIds).eq('status', 'active');
      aestList = (staffRows ?? []).map((s: { id: string; full_name: string | null; email: string | null }) => ({
        id: s.id, name: s.full_name ?? '', email: s.email,
      }));
    }
    if (aestList.length === 0) {
      return json(
        { error: 'NO_AESTHETICIAN', message: 'No aesthetician is currently active.' },
        409,
      );
    }

    // ---- Skill mapping (services only) ----
    const expertsByService = new Map<string, Set<string>>();
    const cartServiceIds = cart.map((c) => c.id).filter(Boolean);
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

    // ---- Daily / weekly load for fairness ----
    const weekStart = new Date(`${body.date}T00:00:00Z`);
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
    const weekStartIso = weekStart.toISOString().slice(0, 10);
    const [{ data: dayAppts }, { data: weekAppts }] = await Promise.all([
      supabase.from('appointments').select('time, assigned_aesthetician_id, date')
        .eq('date', body.date!).in('status', ['scheduled', 'arrived']),
      supabase.from('appointments').select('assigned_aesthetician_id')
        .gte('date', weekStartIso).lte('date', body.date!)
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
    const slotOverlap = new Map<string, Set<string>>();
    (dayAppts ?? []).forEach((a: { time: string; assigned_aesthetician_id: string | null }) => {
      const key = String(a.time).slice(0, 5);
      if (!a.assigned_aesthetician_id) return;
      if (!slotOverlap.has(key)) slotOverlap.set(key, new Set());
      slotOverlap.get(key)!.add(a.assigned_aesthetician_id);
    });

    const pickPractitioner = (svc: Svc, slotMin: number) => {
      const slotKey = `${String(Math.floor(slotMin / 60)).padStart(2, '0')}:${String(slotMin % 60).padStart(2, '0')}`;
      const busy = slotOverlap.get(slotKey) ?? new Set<string>();
      const expertSet = expertsByService.get(svc.id);
      // Skill-match: if any experts are mapped, restrict to them only.
      const pool = expertSet && expertSet.size > 0
        ? aestList.filter((a) => expertSet.has(a.id))
        : aestList;
      const free = pool.filter((a) => !busy.has(a.id));
      if (free.length === 0) return null;
      free.sort((a, b) => {
        const d = (dailyLoad.get(a.id) ?? 0) - (dailyLoad.get(b.id) ?? 0);
        if (d !== 0) return d;
        return (weeklyLoad.get(a.id) ?? 0) - (weeklyLoad.get(b.id) ?? 0);
      });
      return free[0];
    };

    // ---- Build appointments back-to-back ----
    const bookingGroupId = crypto.randomUUID();
    const created: Array<{ id: string; service_name: string; time: string; practitioner: { id: string; name: string; email: string | null } }> = [];
    let cursorMin = reqMin;
    for (const svc of cart) {
      if (cursorMin + svc.duration > endMin) {
        return json({
          error: 'OVERFLOW_HOURS',
          message: 'Your selection runs past closing time. Pick an earlier slot or remove a service.',
        }, 409);
      }
      const slotMin = cursorMin;
      const practitioner = pickPractitioner(svc, slotMin);
      if (!practitioner) {
        const expertSet = expertsByService.get(svc.id);
        const reason = expertSet && expertSet.size > 0 ? 'NO_SKILLED_PRACTITIONER' : 'SLOT_FULL';
        return json({
          error: reason,
          message: reason === 'NO_SKILLED_PRACTITIONER'
            ? `No skilled practitioner is free at this time for "${svc.name}". Try a different slot.`
            : 'A slot in your selection is fully booked. Pick a different time.',
        }, 409);
      }
      const slotKey = `${String(Math.floor(slotMin / 60)).padStart(2, '0')}:${String(slotMin % 60).padStart(2, '0')}`;
      if (!slotOverlap.has(slotKey)) slotOverlap.set(slotKey, new Set());
      slotOverlap.get(slotKey)!.add(practitioner.id);
      dailyLoad.set(practitioner.id, (dailyLoad.get(practitioner.id) ?? 0) + 1);
      weeklyLoad.set(practitioner.id, (weeklyLoad.get(practitioner.id) ?? 0) + 1);

      const { data: appt, error: apptErr } = await supabase
        .from('appointments').insert({
          client_id: body.client_id,
          date: body.date,
          time: slotKey,
          treatment: svc.name,
          status: 'scheduled',
          source: 'staff_booking',
          attributed_staff_id: clientRow.attributed_staff_id ?? null,
          assigned_aesthetician_id: practitioner.id,
          notes: body.notes || null,
          payment_status: isConsultation ? 'not_applicable' : 'awaiting_confirmation',
          total_amount: isConsultation ? 0 : (svc.price || null),
          appointment_type: appointmentType,
          booking_group_id: bookingGroupId,
          is_walk_in: false,
          created_by: userId,
        }).select('id').single();
      if (apptErr) {
        if ((apptErr as { code?: string }).code === '23505') {
          return json({ error: 'SLOT_FULL', message: 'That time was just taken.' }, 409);
        }
        throw apptErr;
      }
      created.push({ id: appt.id, service_name: svc.name, time: slotKey, practitioner });
      cursorMin += svc.duration;
    }

    const first = created[0];
    const treatmentValue = cart.map((c) => c.name).join(' + ');

    // Notify the assigned aestheticians so their dashboard updates.
    // Note: the appointments INSERT trigger `notify_practitioner_on_appointment_created`
    // already fans out a per-appointment notification to each assigned practitioner,
    // so this RPC is a roll-up alert for admins/front-desk only. Failure is non-fatal.
    const recipientIds = Array.from(new Set(created.map((c) => c.practitioner.id)));
    try {
      const { error: notifyErr } = await supabase.rpc('emit_notification', {
        _category: 'booking',
        _kind: 'new_assignment',
        _severity: 'info',
        _title: isConsultation ? 'New consultation booked on behalf' : 'New appointment booked on behalf',
        _body: isConsultation
          ? `${clientRow.full_name} — ${treatmentValue} on ${body.date} at ${body.time}.`
          : `${clientRow.full_name} — ${treatmentValue} on ${body.date} at ${body.time}. Awaiting payment confirmation.`,
        _subject_user_id: null,
        _target_table: 'appointments',
        _target_id: first.id,
        _metadata: { booking_group_id: bookingGroupId, total_amount: totalAmount, client_id: body.client_id },
        _recipient_user_ids: recipientIds,
        _include_admins: true,
        _include_subject: false,
      });
      if (notifyErr) console.warn('notify failed', notifyErr.message);
    } catch (e) {
      console.warn('notify threw', e instanceof Error ? e.message : e);
    }

    // Client confirmation email (or front-desk no-email fallback) + staff
    // alert email. Single source of truth is `notify-booking-created`, so
    // we don't duplicate the send logic here. Non-fatal.
    try {
      const { error: cErr } = await supabase.functions.invoke('notify-booking-created', {
        body: { appointment_id: first.id },
      });
      if (cErr) console.warn('notify-booking-created failed', cErr.message);
    } catch (e) {
      console.warn('notify-booking-created threw', e instanceof Error ? e.message : e);
    }

    return json({
      booking_reference: first.id,
      booking_group_id: bookingGroupId,
      date: body.date,
      time: body.time,
      treatment: treatmentValue,
      assigned_aesthetician_name: first.practitioner.name,
      total_amount: totalAmount,
      payment_status: isConsultation ? 'not_applicable' : 'awaiting_confirmation',
      appointment_type: appointmentType,
      appointments: created.map((a) => ({
        id: a.id, time: a.time, service_name: a.service_name,
        practitioner_name: a.practitioner.name,
      })),
    });
  } catch (e) {
    console.error('staff-book-on-behalf error', e);
    return json({ error: 'Server error' }, 500);
  }
});