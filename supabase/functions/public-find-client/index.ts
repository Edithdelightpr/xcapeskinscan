import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const normalizePhone = (p: string) => p.replace(/\D/g, '');
const normalizeName = (n: string) =>
  n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();

/**
 * Returning-client lookup. Two modes:
 *
 * 1. Suggestion mode (live autocomplete as the user types):
 *      Body: { query: string }   // ≥2 chars
 *      Returns up to 6 partial matches with masked phone for visual confirmation.
 *      Response: { suggestions: [{ id, full_name, phone_masked, email_masked }] }
 *
 * 2. Confirm mode (user clicks a suggestion):
 *      Body: { client_id: string }
 *      Returns ONLY masked phone/email plus name + gender so the wizard can
 *      recognise the visitor. The visitor re-enters their phone/email — we
 *      never expose raw PII to unauthenticated callers.
 *      Response: { found: boolean, client?: { id, full_name, phone_masked, email_masked, gender } }
 */
const maskPhone = (p: string | null) => {
  if (!p) return null;
  const d = p.replace(/\D/g, '');
  if (d.length < 4) return '••••';
  return `••• ••• ${d.slice(-4)}`;
};
const maskEmail = (e: string | null) => {
  if (!e) return null;
  const [local, domain] = e.split('@');
  if (!domain) return null;
  const visible = local.slice(0, 2);
  return `${visible}${'•'.repeat(Math.max(1, local.length - 2))}@${domain}`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Confirm mode ─────────────────────────────────────────────────────
    if (typeof body.client_id === 'string' && body.client_id.length > 0) {
      const { data, error } = await supabase
        .from('clients')
        .select('id, full_name, phone, email, gender, archived')
        .eq('id', body.client_id)
        .maybeSingle();
      if (error) throw error;
      if (!data || data.archived) {
        return new Response(JSON.stringify({ found: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          found: true,
          client: {
            id: data.id,
            full_name: data.full_name,
            phone_masked: maskPhone(data.phone),
            email_masked: maskEmail(data.email),
            gender: data.gender,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Suggestion mode ─────────────────────────────────────────────────
    const query = typeof body.query === 'string' ? normalizeName(body.query) : '';
    if (query.length < 2) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await supabase
      .from('clients')
      .select('id, full_name, phone, email')
      .eq('archived', false)
      .limit(2000);
    if (error) throw error;

    const tokens = query.split(' ').filter((t) => t.length >= 1);
    const suggestions = (data ?? [])
      .map((c: { id: string; full_name: string | null; phone: string | null; email: string | null }) => {
        const cName = normalizeName(c.full_name ?? '');
        if (!cName) return null;
        const allMatch = tokens.every((t) => cName.includes(t));
        if (!allMatch) return null;
        // Score: prefix match on first word ranks higher
        const firstWord = cName.split(' ')[0] ?? '';
        const score = firstWord.startsWith(tokens[0]) ? 0 : 1;
        return { c, score };
      })
      .filter((x): x is { c: { id: string; full_name: string | null; phone: string | null; email: string | null }; score: number } => x !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, 6)
      .map(({ c }) => ({
        id: c.id,
        full_name: c.full_name,
        phone_masked: maskPhone(c.phone),
        email_masked: maskEmail(c.email),
      }));

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('public-find-client error', e);
    return new Response(JSON.stringify({ suggestions: [], error: 'Server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});