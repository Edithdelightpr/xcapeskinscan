// Public endpoint: checks whether an email address exists in staff_users
// (i.e. has a Tropics staff account). Used by the /auth page so that
// sign-in / sign-up / forgot-password can give accurate, non-confusing
// messages instead of Supabase's generic errors. No secrets are exposed:
// only a boolean is returned.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  try {
    const { email } = await req.json();
    if (typeof email !== 'string' || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const url = Deno.env.get('SUPABASE_URL')!;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, key);
    const normalized = email.trim().toLowerCase();
    const { data, error } = await admin
      .from('staff_users')
      .select('id, status')
      .ilike('email', normalized)
      .maybeSingle();
    if (error) {
      console.error('check-staff-email lookup failed', error);
      return new Response(
        JSON.stringify({ error: error.message ?? 'Lookup failed', code: error.code ?? null }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    return new Response(
      JSON.stringify({ exists: !!data, status: data?.status ?? null }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : typeof e === 'object' && e !== null
          ? JSON.stringify(e)
          : String(e);
    console.error('check-staff-email error', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});