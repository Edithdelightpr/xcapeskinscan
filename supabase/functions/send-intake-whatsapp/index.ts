import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Payload {
  client_id: string;
  consultation_link?: string;
}

const cleanDigits = (raw: string) => raw.replace(/\D/g, '').replace(/^0+/, '');

const APP_URL =
  Deno.env.get('APP_PUBLIC_URL') || 'https://tropics-medspa-pro.lovable.app';

const renderTemplate = (
  body: string,
  vars: Record<string, string>,
): string =>
  body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) => vars[key] ?? '');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Require service-role bearer. This function is internal-only — called
    // by public-submit-intake (and any future trusted server flows). It must
    // never be reachable from a browser or unauthenticated client.
    const authHeader = req.headers.get('authorization') ?? '';
    const bearer = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!bearer || !serviceKey || bearer !== serviceKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { client_id, consultation_link: rawLink } = (await req.json()) as Payload;
    if (!client_id) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Defence-in-depth: even though the caller is now trusted, only accept
    // a consultation_link that points at our own app. Otherwise derive it
    // server-side from the client record.
    const linkAllowed =
      typeof rawLink === 'string' &&
      rawLink.length > 0 &&
      rawLink.startsWith(`${APP_URL}/consult/`);
    const consultation_link = linkAllowed ? rawLink! : `${APP_URL}/consult/${client_id}`;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const [{ data: client }, { data: settings }] = await Promise.all([
      admin.from('clients').select('id, full_name, phone, attributed_staff_id').eq('id', client_id).single(),
      admin.from('outreach_settings').select('*').eq('id', true).single(),
    ]);

    if (!client || !settings) {
      return new Response(JSON.stringify({ error: 'Client or settings missing' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const c = client as { full_name: string; phone: string | null; attributed_staff_id: string | null };
    const s = settings as {
      address: string; instagram_handle: string; tiktok_handle: string;
      website_url: string; whatsapp_template_body: string;
    };

    const messageBody = renderTemplate(s.whatsapp_template_body, {
      name: c.full_name.split(' ')[0] ?? c.full_name,
      consultation_link,
      address: s.address,
      instagram: s.instagram_handle.replace(/^@/, ''),
      tiktok: s.tiktok_handle.replace(/^@/, ''),
      website: s.website_url,
    });

    const phoneDigits = cleanDigits(c.phone ?? '');
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    let status = 'fallback';
    let providerReference: string | null = null;
    let errorMessage: string | null = null;

    if (accessToken && phoneNumberId && phoneDigits) {
      // WhatsApp Business Cloud API send
      try {
        const resp = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phoneDigits,
            type: 'text',
            text: { body: messageBody, preview_url: true },
          }),
        });
        const json = await resp.json();
        if (resp.ok) {
          status = 'sent';
          providerReference = json?.messages?.[0]?.id ?? null;
        } else {
          status = 'failed';
          errorMessage = JSON.stringify(json).slice(0, 500);
        }
      } catch (e) {
        status = 'failed';
        errorMessage = e instanceof Error ? e.message : 'Network error';
      }
    }

    // Always log; fallback wa.me link is built client-side from this row
    const fallbackLink = phoneDigits
      ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(messageBody)}`
      : `https://wa.me/?text=${encodeURIComponent(messageBody)}`;

    await admin.from('outreach_logs').insert({
      client_id,
      staff_user_id: c.attributed_staff_id,
      template_category: 'intake_acknowledgement',
      message_text: messageBody,
      phone_number: c.phone,
      status,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        status,
        provider_reference: providerReference,
        error: errorMessage,
        fallback_link: fallbackLink,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('send-intake-whatsapp error', e);
    return new Response(
      JSON.stringify({ error: 'Server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});