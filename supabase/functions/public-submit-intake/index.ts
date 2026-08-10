import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { randomToken } from '../_shared/booking-helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_URL =
  Deno.env.get('APP_PUBLIC_URL') || 'https://tropics-medspa-pro.lovable.app';

interface IntakePayload {
  full_name: string;
  phone: string;
  email?: string;
  gender?: string;
  age_group?: string;
  intake_source: string;        // 'outreach' | 'social-media' | 'other'
  intake_source_other?: string;
  consent?: boolean;
  consent_status?: 'granted' | 'denied' | 'unknown';
  slug?: string;                // staff slug for attribution
  outreach_id?: string;         // outreach session ID (from /intake?outreach=<id>)
  website?: string;             // honeypot
  rendered_at?: number;         // bot timing
}

const SUSPICIOUS = [/<\s*script/i, /https?:\/\//i];
const looksSuspicious = (s?: string | null) =>
  !!s && SUSPICIOUS.some((re) => re.test(s));

const validate = (b: Partial<IntakePayload>): string | null => {
  if (!b.full_name || typeof b.full_name !== 'string' || b.full_name.trim().length < 2 || b.full_name.length > 100)
    return 'Please enter your full name.';
  if (looksSuspicious(b.full_name)) return 'Invalid name.';
  if (!b.phone || typeof b.phone !== 'string' || b.phone.replace(/\D/g, '').length < 7)
    return 'Please enter a valid phone number.';
  if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) return 'Invalid email address.';
  if (!b.intake_source || !['outreach', 'social-media', 'other'].includes(b.intake_source))
    return 'Please tell us where you heard about us.';
  if (b.intake_source === 'other' && (!b.intake_source_other || b.intake_source_other.trim().length < 2))
    return 'Please tell us a bit more.';
  return null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as IntakePayload;

    // Honeypot + sub-second submit = bot
    if (body.website && body.website.length > 0) {
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (body.rendered_at && Date.now() - body.rendered_at < 1500) {
      return new Response(JSON.stringify({ error: 'Please take a moment before submitting.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const err = validate(body);
    if (err) {
      return new Response(JSON.stringify({ error: err }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Resolve attributed staff from slug (optional)
    let attributedStaffId: string | null = null;
    if (body.slug) {
      const { data: staffRow } = await admin
        .from('staff_users')
        .select('id')
        .eq('booking_slug', body.slug)
        .eq('status', 'active')
        .maybeSingle();
      if (staffRow) attributedStaffId = (staffRow as { id: string }).id;
    }

    const sourceLabel =
      body.intake_source === 'outreach' ? 'Outreach'
      : body.intake_source === 'social-media' ? 'Social Media'
      : `Other: ${body.intake_source_other?.slice(0, 80) ?? ''}`;

    // Normalize consent (non-blocking)
    const consentStatus: 'granted' | 'denied' | 'unknown' =
      body.consent_status === 'granted' || body.consent_status === 'denied' || body.consent_status === 'unknown'
        ? body.consent_status
        : body.consent === true ? 'granted'
        : body.consent === false ? 'denied'
        : 'unknown';
    const marketingConsent = consentStatus === 'granted';
    const consentTimestamp = new Date().toISOString();

    // Validate outreach_id if provided
    let outreachId: string | null = null;
    if (body.outreach_id && /^[0-9a-f-]{36}$/i.test(body.outreach_id)) {
      const { data: oRow } = await admin
        .from('outreach_sessions')
        .select('id, status')
        .eq('id', body.outreach_id)
        .maybeSingle();
      if (oRow) outreachId = (oRow as { id: string }).id;
    }

    // Find existing client by phone (last 10 digits) or email
    const phoneDigits = body.phone.replace(/\D/g, '');
    const phoneTail = phoneDigits.slice(-10);
    let clientId: string | null = null;
    {
      const { data: existing } = await admin
        .from('clients')
        .select('id, phone, email')
        .or(body.email ? `email.eq.${body.email.toLowerCase()},phone.ilike.%${phoneTail}` : `phone.ilike.%${phoneTail}`)
        .limit(1);
      if (existing && existing.length > 0) clientId = (existing[0] as { id: string }).id;
    }

    if (!clientId) {
      const { data: created, error: createErr } = await admin
        .from('clients')
        .insert({
          full_name: body.full_name.trim(),
          phone: body.phone.trim(),
          email: body.email?.trim().toLowerCase() ?? null,
          gender: body.gender ?? null,
          age_group: body.age_group ?? null,
          status: 'lead',
          source_type: sourceLabel,
          intake_source: body.intake_source,
          intake_source_other: body.intake_source === 'other' ? body.intake_source_other?.trim() ?? null : null,
          consent_given_at: marketingConsent ? consentTimestamp : null,
          marketing_consent: marketingConsent,
          consent_status: consentStatus,
          consent_captured_at: consentTimestamp,
          attributed_staff_id: attributedStaffId,
          outreach_id: outreachId,
          captured_via: outreachId ? 'outreach' : 'public_intake',
        })
        .select('id')
        .single();
      if (createErr) throw createErr;
      clientId = (created as { id: string }).id;
    } else {
      // Update soft fields if missing; never overwrite an existing attribution
      const update: Record<string, unknown> = {
        full_name: body.full_name.trim(),
        gender: body.gender ?? undefined,
        age_group: body.age_group ?? undefined,
        intake_source: body.intake_source,
        intake_source_other: body.intake_source === 'other' ? body.intake_source_other?.trim() ?? null : null,
        marketing_consent: marketingConsent,
        consent_status: consentStatus,
        consent_captured_at: consentTimestamp,
      };
      if (marketingConsent) update.consent_given_at = consentTimestamp;
      // Only stamp outreach attribution if the existing client wasn't already tied to an outreach
      if (outreachId) {
        const { data: existingClient } = await admin
          .from('clients')
          .select('outreach_id')
          .eq('id', clientId)
          .maybeSingle();
        if (existingClient && !(existingClient as { outreach_id: string | null }).outreach_id) {
          update.outreach_id = outreachId;
          update.captured_via = 'outreach';
        }
      }
      await admin.from('clients').update(update).eq('id', clientId);
    }

    // Audit row
    await admin.from('intake_submissions').insert({
      client_id: clientId,
      attributed_staff_id: attributedStaffId,
      full_name: body.full_name.trim(),
      phone: body.phone.trim(),
      email: body.email?.trim().toLowerCase() ?? null,
      gender: body.gender ?? null,
      age_group: body.age_group ?? null,
      intake_source: body.intake_source,
      intake_source_other: body.intake_source === 'other' ? body.intake_source_other?.trim() ?? null : null,
      consent_given: marketingConsent,
      user_agent: req.headers.get('user-agent')?.slice(0, 240) ?? null,
    });

    // Journey event
    await admin.from('lead_journey_events').insert({
      client_id: clientId,
      status: 'intake_submitted',
      note: sourceLabel,
      by_staff_id: attributedStaffId,
    });

    // Mint consultation token (14 days)
    const token = randomToken();
    await admin.from('consultation_tokens').insert({
      client_id: clientId,
      token,
    });
    const consultationLink = `${APP_URL}/consult/${token}`;

    // Build the client-initiated WhatsApp link so the front end can redirect immediately.
    // This works WITHOUT Meta verification because the *client* initiates the chat.
    let businessWhatsappLink: string | null = null;
    try {
      const { data: settingsRow } = await admin
        .from('outreach_settings')
        .select('business_whatsapp_number, whatsapp_client_initiated_body')
        .eq('id', true)
        .single();
      const settings = settingsRow as {
        business_whatsapp_number: string | null;
        whatsapp_client_initiated_body: string | null;
      } | null;
      const bizDigits = (settings?.business_whatsapp_number ?? '').replace(/\D/g, '').replace(/^0+/, '');
      const tplBody = settings?.whatsapp_client_initiated_body
        ?? "Hi Tropics MedSpa! 👋 I'm {name}. I just filled out your form after meeting you through {source}, and I'd love to claim my free 20-minute consultation. Looking forward to hearing from you!";
      // First name only — feels more natural when the client sends it.
      const firstName = body.full_name.trim().split(/\s+/)[0] || body.full_name.trim();
      // Natural, client-voice phrasing for how they heard about us.
      const sourcePhrase =
        body.intake_source === 'outreach' ? 'one of your outreach team'
        : body.intake_source === 'social-media' ? 'your social media'
        : body.intake_source === 'other' ? (body.intake_source_other?.trim().toLowerCase() || 'a friend')
        : 'one of your channels';
      const rendered = tplBody
        .replaceAll('{name}', firstName)
        .replaceAll('{source}', sourcePhrase)
        .replaceAll('{consultation_link}', consultationLink);
      if (bizDigits) {
        businessWhatsappLink = `https://wa.me/${bizDigits}?text=${encodeURIComponent(rendered)}`;
      }
    } catch (waErr) {
      console.warn('Could not build business WhatsApp link', waErr);
    }

    // Trigger WhatsApp acknowledgement (fire-and-forget, never blocks the response)
    const sendUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-intake-whatsapp`;
    fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ client_id: clientId, consultation_link: consultationLink }),
    }).catch(() => {});

    return new Response(
      JSON.stringify({
        ok: true,
        client_id: clientId,
        consultation_link: consultationLink,
        business_whatsapp_link: businessWhatsappLink,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('public-submit-intake error', e);
    return new Response(
      JSON.stringify({ error: 'Server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});