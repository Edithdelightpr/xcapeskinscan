// Turns a finished anonymous public skin-analysis session into a real lead and
// issues the client's persistent Personal Report link.
//
// Authenticated ONLY by the raw session token in the request body — never by a
// user session. The visitor supplies their own name / phone (and optional
// email), which is exactly the contact information the existing outreach
// workflow requires before a report can be delivered.
//
// Nothing sensitive is echoed back: the response carries the report URL, a
// prefilled WhatsApp deep link and nothing else about the session or client.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, json, sha256Hex } from '../_shared/publicAnalysis.ts';
import { deriveToken, reportUrl, sha256Hex as tokenHash } from '../_shared/reportLinkToken.ts';
import { buildReportShareMessage, whatsAppShareUrl } from '../_shared/reportShareMessage.ts';
import {
  buildPublicProtocolSnapshot,
  loadAlignments,
} from '../_shared/publicProtocolSnapshot.ts';

const APP_URL = Deno.env.get('APP_PUBLIC_URL') || 'https://xcapeskinscan.lovable.app';
/** Mirrors `src/lib/brand.ts` — the same contact block staff share. */
const CLINIC_ADDRESS = 'House 8, Wonderland Estate, Kukwaba, Abuja';
const CLINIC_PHONE = '+234 803 769 6910';

interface Body {
  token?: string;
  full_name?: string;
  phone?: string;
  email?: string;
  consent?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  if (t.length < 2 || t.length > 120) return null;
  return t;
}

/** Accepts E.164 only — the browser form always normalises before sending. */
function cleanPhone(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return /^\+[1-9]\d{7,14}$/.test(t) ? t : null;
}

function cleanEmail(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().toLowerCase();
  if (!t) return null;
  return t.length <= 160 && EMAIL_RE.test(t) ? t : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  try {
    let body: Body;
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: 'Invalid request.' }, 400);
    }

    const token = typeof body.token === 'string' ? body.token : '';
    if (!token) return json({ ok: false, code: 'invalid_session', error: 'Session not found.' }, 401);

    const full_name = cleanName(body.full_name);
    const phone = cleanPhone(body.phone);
    const email = body.email ? cleanEmail(body.email) : null;
    if (!full_name) return json({ ok: false, code: 'invalid_name', error: 'Enter your full name.' }, 400);
    if (!phone) {
      return json({ ok: false, code: 'invalid_phone', error: 'Enter a valid mobile number.' }, 400);
    }
    if (body.email && !email) {
      return json({ ok: false, code: 'invalid_email', error: 'Enter a valid email address.' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const token_hash = await sha256Hex(token);

    const { data: claim, error: claimErr } = await admin.rpc('public_analysis_claim_lead', {
      p_token_hash: token_hash,
      p_full_name: full_name,
      p_phone: phone,
      p_email: email,
      p_consent: body.consent === true,
    });
    if (claimErr) throw claimErr;

    const result = claim as {
      ok: boolean;
      http?: number;
      error_code?: string;
      client_id?: string;
      assessment_id?: string;
    } | null;

    if (!result?.ok) {
      const code = result?.error_code ?? 'claim_failed';
      const messages: Record<string, string> = {
        invalid_session: 'This analysis session is no longer available. Start a new analysis.',
        session_expired: 'This analysis session has expired. Start a new analysis.',
        report_not_ready: 'Your report is still being prepared. Try again in a moment.',
        invalid_contact: 'Enter your full name and mobile number.',
        claim_incomplete:
          'We could not match this analysis to your record. Please contact us and we will send your report.',
      };
      return json(
        { ok: false, code, error: messages[code] ?? 'Your report could not be prepared.' },
        result?.http ?? 409,
      );
    }

    const client_id = result.client_id!;
    const assessment_id = result.assessment_id!;

    // ---- Persist the XCAPE protocol recommendation ONCE, write-once ----
    // Resolved from the session's stored engine scores so the shared report
    // shows the same deterministic protocol the scanner showed. The RPC is a
    // no-op when a snapshot already exists, keeping repeat shares idempotent.
    try {
      const { data: sessionRow } = await admin
        .from('public_analysis_sessions')
        .select('engine')
        .eq('token_hash', token_hash)
        .maybeSingle();
      if (sessionRow?.engine) {
        const alignments = await loadAlignments(admin);
        const snapshot = buildPublicProtocolSnapshot(sessionRow.engine, alignments);
        if (snapshot) {
          await admin.rpc('public_analysis_store_protocol_snapshot', {
            p_assessment_id: assessment_id,
            p_snapshot: snapshot,
          });
        }
      }
    } catch (snapErr) {
      // Never block report delivery on the snapshot.
      console.error('public-analysis-share-report snapshot error', snapErr);
    }


    // ---- Issue (or recover) the persistent report link ----
    const nowIso = new Date().toISOString();
    const { data: existing } = await admin
      .from('client_report_links')
      .select('id, token_hash')
      .eq('client_id', client_id)
      .eq('assessment_id', assessment_id)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let linkId = existing?.id ?? null;
    let rawToken: string | null = null;

    if (existing) {
      const candidate = await deriveToken(existing.id);
      if ((await tokenHash(candidate)) === existing.token_hash) {
        rawToken = candidate;
      } else {
        // Legacy random-token row: it cannot be recovered, so retire it and
        // issue a fresh recoverable link for this same assessment.
        await admin
          .from('client_report_links')
          .update({ revoked_at: nowIso })
          .eq('id', existing.id)
          .is('revoked_at', null);
        linkId = null;
      }
    }

    if (!rawToken) {
      const { data: inserted, error: insErr } = await admin
        .from('client_report_links')
        .insert({
          client_id,
          assessment_id,
          token_hash: 'pending',
          token_prefix: 'pending',
          expires_at: null,
        })
        .select('id')
        .single();
      if (insErr) throw insErr;
      linkId = inserted.id;
      rawToken = await deriveToken(inserted.id);
      const { error: updErr } = await admin
        .from('client_report_links')
        .update({ token_hash: await tokenHash(rawToken), token_prefix: rawToken.slice(0, 8) })
        .eq('id', inserted.id);
      if (updErr) throw updErr;
    }

    const url = reportUrl(APP_URL, rawToken);
    // Canonical share text — identical builder to the staff Share dialog.
    const message = buildReportShareMessage({
      firstName: full_name.split(' ')[0],
      reportUrl: url,
      clinicAddress: CLINIC_ADDRESS,
      clinicPhone: CLINIC_PHONE,
    });

    return json(
      {
        ok: true,
        url,
        whatsapp_url: whatsAppShareUrl(phone, message),
        share_text: message,
        already_shared: linkId != null && existing != null && rawToken != null && !!existing.token_hash,
      },
      200,
      true,
    );
  } catch (e) {
    console.error('public-analysis-share-report error', e);
    return json({ ok: false, error: 'Your report could not be prepared. Please try again.' }, 500);
  }
});
