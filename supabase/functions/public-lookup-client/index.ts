import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const maskName = (name: string): string => {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      if (part.length <= 2) return part[0] + '*';
      return part[0] + '*'.repeat(Math.max(1, part.length - 2)) + part[part.length - 1];
    })
    .join(' ');
};

const normalizePhone = (p: string) => p.replace(/\D/g, '');

/**
 * Public endpoint that checks whether a client already exists in our system
 * given a phone number (and optionally an email). Returns ONLY a masked name
 * to avoid leaking PII to phone-stuffing attackers.
 * Body: { phone?: string, email?: string }
 * Response: { exists: boolean, masked_name?: string }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const phone = typeof body.phone === 'string' ? normalizePhone(body.phone) : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!phone && !email) {
      return new Response(JSON.stringify({ exists: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Pull a small candidate set then filter in code (RLS-safe, indexed lookups).
    const { data, error } = await supabase
      .from('clients')
      .select('id, full_name, phone, email')
      .eq('archived', false)
      .limit(2000);
    if (error) throw error;

    const match = (data ?? []).find((c: { phone: string | null; email: string | null }) => {
      if (phone && c.phone && normalizePhone(c.phone) === phone) return true;
      if (email && c.email && c.email.toLowerCase() === email) return true;
      return false;
    });

    if (!match) {
      return new Response(JSON.stringify({ exists: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ exists: true, masked_name: maskName(match.full_name ?? '') }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('public-lookup-client error', e);
    return new Response(JSON.stringify({ exists: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});