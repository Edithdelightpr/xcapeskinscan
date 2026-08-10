// Public edge function: generates a PDF snapshot of the Personal Report for
// a given token. Validates the token exactly like public-report-fetch, then
// renders a self-contained PDF with pdf-lib (standard fonts only — no
// network font loading). Logs `pdf_downloaded` (deduped within 60s).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { resolveClientFirstName } from '../_shared/clientName.ts';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import {
  formatReport,
  CONCERN_FIELD_ORDER,
  type FormattedConcern,
  type FormattedReport,
} from '../_shared/reportConcernFormatter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonErr(body: unknown, status = 400) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---- Simple layout engine ----
const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

const COCOA = rgb(0.2, 0.13, 0.09);
const COCOA_SOFT = rgb(0.32, 0.24, 0.2);
const BRONZE = rgb(0.62, 0.44, 0.24);
const BG_TINT = rgb(0.98, 0.96, 0.93);
const CARD_BORDER = rgb(0.86, 0.78, 0.66);

const BAND_COLOR: Record<FormattedConcern['band'], ReturnType<typeof rgb>> = {
  critical: rgb(0.72, 0.28, 0.18),
  low: rgb(0.78, 0.48, 0.2),
  fair: rgb(0.72, 0.55, 0.16),
  good: rgb(0.28, 0.5, 0.32),
  strong: rgb(0.2, 0.44, 0.28),
};

function wrap(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const trial = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(trial, size) > maxWidth) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function buildPdf(payload: {
  report: FormattedReport;
  homeCare: string | null;
  followUp: string | null;
  nextVisitInWeeks: number | null;
  services: Array<{ name: string; description?: string | null; price_per_session?: number | null }>;
  products: Array<{ name: string; short_description?: string | null; selling_price?: number | null }>;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };
  const ensure = (h: number) => { if (y - h < MARGIN) newPage(); };

  const drawText = (text: string, opts: { size?: number; bold?: boolean; italic?: boolean; color?: any; x?: number; maxWidth?: number; lineGap?: number } = {}) => {
    const size = opts.size ?? 11;
    const f = opts.bold ? fontBold : opts.italic ? fontItalic : font;
    const color = opts.color ?? COCOA_SOFT;
    const x = opts.x ?? MARGIN;
    const maxWidth = opts.maxWidth ?? CONTENT_W;
    const lineHeight = size * 1.45 + (opts.lineGap ?? 0);
    const lines = wrap(text, f, size, maxWidth);
    for (const line of lines) {
      ensure(lineHeight);
      page.drawText(line, { x, y: y - size, size, font: f, color });
      y -= lineHeight;
    }
  };

  // ---- Cover / header band ----
  page.drawRectangle({ x: 0, y: PAGE_H - 120, width: PAGE_W, height: 120, color: BG_TINT });
  page.drawText('PERSONAL REPORT', {
    x: MARGIN, y: PAGE_H - 52, size: 9, font: fontBold, color: BRONZE,
  });
  page.drawText('Tropics MedSpa', {
    x: MARGIN, y: PAGE_H - 74, size: 16, font: fontBold, color: COCOA,
  });
  const dateNice = new Date(payload.report.assessment.createdAt).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  page.drawText(`Assessment · ${dateNice}`, {
    x: MARGIN, y: PAGE_H - 96, size: 10, font, color: COCOA_SOFT,
  });
  y = PAGE_H - 150;

  // Headline — shared formatter (personalised with first name when available).
  drawText(payload.report.client.pdfHeadline, { size: 22, bold: true, color: COCOA });
  y -= 10;
  drawText('A tailored view of what your skin is asking for right now, what your practitioner observed, and the next steps designed for you.', {
    size: 11, color: COCOA_SOFT,
  });
  y -= 14;

  // Main concern
  const { mainConcern, clientGoal } = payload.report.assessment;
  if (mainConcern || clientGoal) {
    drawText('Main focus', { size: 12, bold: true, color: BRONZE });
    y -= 2;
    if (mainConcern) drawText(`Concern: ${mainConcern}`, { size: 11, color: COCOA });
    if (clientGoal) drawText(`Your goal: ${clientGoal}`, { size: 11, color: COCOA_SOFT });
    y -= 10;
  }

  // Concerns — shared canonical formatter output. Same fields, same order,
  // as the live report page. Empty fields are omitted rather than rendered
  // as blank labelled lines.
  if (payload.report.concerns.length > 0) {
    drawText('Your key readings', { size: 12, bold: true, color: BRONZE });
    y -= 6;
    for (const c of payload.report.concerns) {
      ensure(80);
      drawText(`${c.clinicalName} — ${c.scoreLabel}`, {
        size: 13, bold: true, color: COCOA,
      });
      drawText(`${c.bandLabel} · ${c.stageName}`, {
        size: 10, color: BAND_COLOR[c.band],
      });
      y -= 2;
      // Score bar
      ensure(10);
      const barY = y - 6;
      page.drawRectangle({ x: MARGIN, y: barY, width: CONTENT_W, height: 4, color: rgb(0.93, 0.9, 0.85) });
      page.drawRectangle({
        x: MARGIN, y: barY, width: CONTENT_W * (c.score / 100), height: 4, color: BAND_COLOR[c.band],
      });
      y -= 14;

      // Six required labelled fields in fixed order.
      for (const field of CONCERN_FIELD_ORDER) {
        const value = c[field.key];
        if (typeof value !== 'string' || !value.trim()) continue;
        drawText(`${field.label}:`, { size: 10.5, bold: true, color: COCOA });
        drawText(value, { size: 11, color: COCOA_SOFT });
        y -= 2;
      }
      y -= 8;
    }
  }

  // Practitioner notes
  if (payload.homeCare || payload.followUp || payload.nextVisitInWeeks) {
    y -= 4;
    drawText("Practitioner's note", { size: 12, bold: true, color: BRONZE });
    y -= 2;
    if (payload.homeCare) {
      drawText('Home care', { size: 10.5, bold: true, color: COCOA });
      drawText(payload.homeCare, { size: 11, color: COCOA_SOFT });
      y -= 4;
    }
    if (payload.followUp) {
      drawText('Follow-up', { size: 10.5, bold: true, color: COCOA });
      drawText(payload.followUp, { size: 11, color: COCOA_SOFT });
      y -= 4;
    }
    if (payload.nextVisitInWeeks) {
      drawText(`Suggested next visit: ${payload.nextVisitInWeeks} week${payload.nextVisitInWeeks === 1 ? '' : 's'}`, {
        size: 11, italic: true, color: COCOA,
      });
    }
    y -= 8;
  }

  // Recommended treatments
  if (payload.services.length > 0) {
    ensure(30);
    drawText('Recommended treatments', { size: 12, bold: true, color: BRONZE });
    y -= 2;
    for (const s of payload.services) {
      drawText(`• ${s.name}${s.price_per_session ? `  —  ₦${Number(s.price_per_session).toLocaleString()}` : ''}`, {
        size: 11, bold: true, color: COCOA,
      });
      if (s.description) drawText(s.description, { size: 10.5, color: COCOA_SOFT, x: MARGIN + 12, maxWidth: CONTENT_W - 12 });
      y -= 4;
    }
    y -= 4;
  }

  // Recommended products
  if (payload.products.length > 0) {
    ensure(30);
    drawText('Recommended products', { size: 12, bold: true, color: BRONZE });
    y -= 2;
    for (const p of payload.products) {
      drawText(`• ${p.name}${p.selling_price ? `  —  ₦${Number(p.selling_price).toLocaleString()}` : ''}`, {
        size: 11, bold: true, color: COCOA,
      });
      if (p.short_description) drawText(p.short_description, { size: 10.5, color: COCOA_SOFT, x: MARGIN + 12, maxWidth: CONTENT_W - 12 });
      y -= 4;
    }
    y -= 4;
  }

  // Footer note on every page
  const totalPages = pdf.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    const p = pdf.getPage(i);
    p.drawText('Tropics MedSpa · Personal Report · Confidential', {
      x: MARGIN, y: 24, size: 8, font, color: BRONZE,
    });
    p.drawText(`Page ${i + 1} of ${totalPages}`, {
      x: PAGE_W - MARGIN - 60, y: 24, size: 8, font, color: BRONZE,
    });
  }

  return await pdf.save();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonErr({ error: 'Method not allowed' }, 405);

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    let body: { token?: string };
    try { body = await req.json(); } catch { return jsonErr({ error: 'Invalid JSON body' }, 400); }
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    if (!token || token.length < 20 || token.length > 128) return jsonErr({ error: 'Invalid token' }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const token_hash = await sha256Hex(token);

    const { data: link, error: linkErr } = await admin
      .from('client_report_links')
      .select('id, client_id, assessment_id, expires_at, revoked_at, token_prefix')
      .eq('token_hash', token_hash)
      .maybeSingle();
    if (linkErr) throw linkErr;
    if (!link) return jsonErr({ error: 'Not found' }, 404);
    if (link.revoked_at) return jsonErr({ error: 'Link revoked' }, 410);
    if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
      return jsonErr({ error: 'Link expired' }, 410);
    }

    const [{ data: client }, { data: assessment }] = await Promise.all([
      admin.from('clients').select('first_name, last_name, full_name').eq('id', link.client_id).maybeSingle(),
      admin.from('client_visit_assessments')
        .select('id, created_at, main_concern, client_goal, skin_analysis, recommended_services, recommended_products, home_care, follow_up_recommendation, next_visit_in_weeks')
        .eq('id', link.assessment_id)
        .maybeSingle(),
    ]);
    if (!assessment) return jsonErr({ error: 'Assessment missing' }, 404);

    const svcIds: string[] = Array.isArray(assessment.recommended_services)
      ? assessment.recommended_services.map((x: any) => x?.id ?? x).filter(Boolean) : [];
    const prodIds: string[] = Array.isArray(assessment.recommended_products)
      ? assessment.recommended_products.map((x: any) => x?.id ?? x).filter(Boolean) : [];

    const [{ data: services }, { data: products }] = await Promise.all([
      svcIds.length ? admin.from('services').select('id, name, description, price_per_session').in('id', svcIds) : Promise.resolve({ data: [] as any[] }),
      prodIds.length ? admin.from('products').select('id, name, short_description, selling_price').in('id', prodIds) : Promise.resolve({ data: [] as any[] }),
    ]);

    const clientFirstName = resolveClientFirstName(
      client?.first_name ?? null,
      client?.full_name ?? null,
    );

    // Single canonical formatting step — same input shape as the live report
    // consumes, so live page and PDF render byte-parity concern content.
    const report = formatReport({
      clientFirstName,
      assessment: {
        id: assessment.id,
        created_at: assessment.created_at,
        main_concern: assessment.main_concern,
        client_goal: assessment.client_goal,
        skin_analysis: assessment.skin_analysis,
      },
    });

    const pdfBytes = await buildPdf({
      report,
      homeCare: assessment.home_care,
      followUp: assessment.follow_up_recommendation,
      nextVisitInWeeks: assessment.next_visit_in_weeks,
      services: (services ?? []) as any[],
      products: (products ?? []) as any[],
    });

    // Dedupe pdf_downloaded within 60s
    const sixtySecAgo = new Date(Date.now() - 60_000).toISOString();
    const { data: recent } = await admin
      .from('client_report_events')
      .select('id')
      .eq('link_id', link.id)
      .eq('event_type', 'pdf_downloaded')
      .gte('created_at', sixtySecAgo)
      .limit(1)
      .maybeSingle();
    if (!recent) {
      await admin.from('client_report_events').insert({
        link_id: link.id,
        event_type: 'pdf_downloaded',
        payload: {},
      });
    }

    const firstNameSlug = (report.client.firstName ?? 'client').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'client';
    const filename = `tropics-personal-report-${firstNameSlug}-${new Date(assessment.created_at).toISOString().slice(0, 10)}.pdf`;

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('public-report-download-pdf error', e);
    return jsonErr({ error: 'Server error' }, 500);
  }
});