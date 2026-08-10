import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const fromMin = (mins: number) => {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * Public availability endpoint.
 * Body:  { date: 'YYYY-MM-DD' }
 * Reply: { open, slots:[{time,available,remaining}], capacity, slot_minutes, open_time, close_time }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { date } = await req.json();
    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response(JSON.stringify({ error: 'Invalid date' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Weekday in UTC (matches how dates are stored). 0 = Sunday.
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();

    const [hoursRes, settingsRes, capacityRes, apptsRes] = await Promise.all([
      supabase.from('business_hours').select('*').eq('day_of_week', dow).maybeSingle(),
      supabase.from('booking_settings').select('*').eq('id', true).maybeSingle(),
      supabase.rpc('count_active_aestheticians'),
      supabase
        .from('appointments')
        .select('time')
        .eq('date', date)
        .in('status', ['scheduled', 'arrived']),
    ]);

    const hours = hoursRes.data;
    const settings = settingsRes.data;
    const capacity = Math.max(0, Number(capacityRes.data ?? 0));
    const slotMinutes = settings?.slot_minutes ?? 60;

    if (!hours || hours.is_open === false) {
      return new Response(
        JSON.stringify({ open: false, slots: [], capacity, slot_minutes: slotMinutes }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Build the slot grid for the day
    const startMin = hours.is_24h ? 0 : toMin(String(hours.open_time).slice(0, 5));
    const endMin = hours.is_24h ? 24 * 60 : toMin(String(hours.close_time).slice(0, 5));

    const slotStarts: number[] = [];
    for (let t = startMin; t + slotMinutes <= endMin; t += slotMinutes) {
      slotStarts.push(t);
    }

    // Existing bookings as [start, end) intervals (assume each consumes one slot)
    const booked = (apptsRes.data ?? []).map((r: { time: string }) => {
      const s = toMin(String(r.time).slice(0, 5));
      return { start: s, end: s + slotMinutes };
    });

    const slots = slotStarts.map((s) => {
      const end = s + slotMinutes;
      const overlapping = booked.filter((b) => b.start < end && b.end > s).length;
      const remaining = Math.max(0, capacity - overlapping);
      return {
        time: fromMin(s),
        available: capacity > 0 && remaining > 0,
        remaining,
      };
    });

    return new Response(
      JSON.stringify({
        open: true,
        slots,
        capacity,
        slot_minutes: slotMinutes,
        open_time: fromMin(startMin),
        close_time: fromMin(endMin),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('public-availability error', e);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
