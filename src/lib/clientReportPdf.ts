import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/tropics-logo.jpeg';
import type { RealClient } from '@/hooks/useRealClients';
import type { ClientMedia } from '@/hooks/useClientMedia';
import {
  BMI_CATEGORY_LABEL, REC_STATUS_LABEL,
  type RecommendedProduct, type RecommendedService, type SkinAnalysisPayload,
  type BodyBmiPayload,
} from '@/hooks/useVisitAssessments';
import {
  ENGINE_VARIABLE_LABEL, stageFor, type EnginePayload, type EngineVariableKey,
  ENGINE_VARIABLE_KEYS,
  lifestyleRecommendations,
  personalizeCopy, stabilityLabel, buildPersonalizeCtx, confidenceBanner,
} from '@/lib/skinEngine';

const BUCKET = 'client-media';
const formatNaira = (n: number) => `NGN ${n.toLocaleString()}`;

/** V2A report scope. */
export type ReportScope =
  | 'current_visit'
  | 'progress'
  | 'full_history'
  | 'final_summary'
  | 'assessment_only';

export const REPORT_SCOPE_LABEL: Record<ReportScope, string> = {
  current_visit: 'Current Visit',
  progress: 'Progress Update',
  full_history: 'Full Client History',
  final_summary: 'Final Summary',
  assessment_only: 'Assessment Only',
};

type Tier = 'regular' | 'member' | 'elite';

const TIER_META: Record<Tier, { label: string; discount: number }> = {
  regular: { label: 'One-time / Regular', discount: 0 },
  member: { label: 'Member', discount: 10 },
  elite: { label: 'Elite Member', discount: 20 },
};

// Brand colors (RGB approximations of project HSL palette)
const C_PURPLE: [number, number, number] = [56, 24, 92];
const C_GOLD: [number, number, number] = [201, 162, 89];
const C_INK: [number, number, number] = [38, 22, 60];
const C_MUTED: [number, number, number] = [120, 110, 140];
const C_LINE: [number, number, number] = [220, 215, 230];

const fileToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });

const fetchSignedDataUrl = async (path: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
    if (error || !data?.signedUrl) return null;
    const resp = await fetch(data.signedUrl);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await fileToDataUrl(blob);
  } catch {
    return null;
  }
};

const detectFmt = (dataUrl: string): 'JPEG' | 'PNG' => {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  return 'JPEG';
};

interface PlanLike {
  totalCost?: number;
  treatments?: { enabled?: boolean; name: string }[];
}

export interface GenerateReportOpts {
  client: RealClient;
  tier?: Tier;
  paymentAmount?: number;
  paymentCategory?: string;
  uploadFn?: (input: {
    clientId: string;
    file: File;
    category?: 'report';
    caption?: string;
    extra?: Record<string, unknown>;
  }) => Promise<ClientMedia>;
  photos: ClientMedia[];
  /** V2A: which scope to render. Defaults to 'current_visit'. */
  scope?: ReportScope;
  /** V2A: when false (default) the report omits internal safety/clinical notes. */
  includeSensitiveNotes?: boolean;
  /** V2A: optional visit context the report was generated against. */
  visitId?: string | null;
  /** Specific assessment row to render. Overrides "latest by client" lookup. */
  assessmentId?: string | null;
  /** Optional appointment scope used to resolve the active assessment. */
  appointmentId?: string | null;
  /**
   * When true (outreach visits), appends a short clinic follow-up CTA to
   * the PDF footer. Non-outreach reports render unchanged.
   */
  isOutreach?: boolean;
}

export interface BuiltClientReport {
  blob: Blob;
  file: File;
  filename: string;
  reportId: string;
  scope: ReportScope;
  /** Browser-only helper to trigger a local download of the generated PDF. */
  download: () => void;
  /** Browser-only helper to open the PDF in a new tab for preview. */
  preview: () => string;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function previewBlobInNewTab(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  // caller may revoke later; keep it alive while tab loads.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return url;
}

/**
 * Build the report PDF in-memory without persisting it. Use this for
 * "Preview" and "Download" flows where we don't want to create a
 * versioned snapshot or send anything.
 */
export async function buildClientReportPdf(
  opts: Omit<GenerateReportOpts, 'uploadFn'>,
): Promise<BuiltClientReport> {
  const built = await generateAndUploadClientReport({ ...opts, uploadFn: undefined } as GenerateReportOpts);
  // When uploadFn is omitted, generateAndUploadClientReport returns BuiltClientReport.
  return built as unknown as BuiltClientReport;
}

export async function generateAndUploadClientReport(
  opts: GenerateReportOpts,
): Promise<ClientMedia> {
  const {
    client, tier, paymentAmount, paymentCategory, uploadFn, photos,
    scope = 'current_visit',
    includeSensitiveNotes = false,
    visitId = null,
    assessmentId = null,
    appointmentId = null,
    isOutreach = false,
  } = opts;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  // ---------- Header ----------
  try {
    const logoData = await fetch(logo).then((r) => r.blob()).then(fileToDataUrl);
    doc.addImage(logoData, 'JPEG', margin, y, 48, 48);
  } catch { /* logo optional */ }

  doc.setTextColor(...C_PURPLE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('TROPICS MEDSPA', margin + 60, y + 20);

  doc.setTextColor(...C_GOLD);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Client ${REPORT_SCOPE_LABEL[scope]} Report`, margin + 60, y + 38);

  y += 64;
  doc.setDrawColor(...C_GOLD);
  doc.setLineWidth(1);
  doc.line(margin, y, pageW - margin, y);
  y += 18;

  // ---------- Section helper ----------
  const ensureRoom = (h: number) => {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const sectionTitle = (label: string) => {
    ensureRoom(28);
    doc.setTextColor(...C_PURPLE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(label.toUpperCase(), margin, y);
    y += 6;
    doc.setDrawColor(...C_LINE);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 14;
  };

  const kvRow = (k: string, v: string) => {
    ensureRoom(16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...C_MUTED);
    doc.text(k, margin, y);
    doc.setTextColor(...C_INK);
    doc.setFont('helvetica', 'bold');
    doc.text(v, margin + 130, y);
    y += 16;
  };

  // ---------- Client ----------
  sectionTitle('Client');
  kvRow('Name', client.full_name || '—');
  kvRow('Code', client.client_code || '—');
  if (client.phone) kvRow('Phone', client.phone);
  if (client.email) kvRow('Email', client.email);
  if (client.gender) kvRow('Gender', client.gender);
  if (client.dob) kvRow('Date of Birth', client.dob);
  if (client.location) kvRow('Location', client.location);
  y += 6;

  // ---------- Membership ----------
  const dbMembership = client.membership_type;
  const inferredTier: Tier | undefined =
    tier ?? (dbMembership === 'member' ? 'member' : dbMembership === 'elite' ? 'elite' : dbMembership === 'one_time' ? 'regular' : undefined);

  if (inferredTier) {
    sectionTitle('Membership');
    const meta = TIER_META[inferredTier];
    kvRow('Tier', meta.label);
    kvRow('Activated', new Date().toLocaleDateString());
    kvRow('Discount', meta.discount > 0 ? `${meta.discount}%` : '—');
    y += 6;
  }

  // ---------- Treatment Plan ----------
  const plan = (client.treatment_plan ?? null) as PlanLike | null;
  const enabledTreatments = (plan?.treatments ?? []).filter((t) => t.enabled !== false);
  const totalCost = plan?.totalCost ?? 0;

  if (enabledTreatments.length > 0 || totalCost > 0) {
    sectionTitle('Treatment Plan');
    if (enabledTreatments.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...C_INK);
      enabledTreatments.forEach((t) => {
        ensureRoom(14);
        doc.text(`•  ${t.name}`, margin + 6, y);
        y += 14;
      });
      y += 4;
    }
    if (totalCost > 0) {
      const discountPct = inferredTier ? TIER_META[inferredTier].discount : 0;
      const finalAmt = totalCost * (1 - discountPct / 100);
      kvRow('Total cost', formatNaira(totalCost));
      if (discountPct > 0) kvRow('Discount applied', `-${discountPct}%`);
      kvRow('Final amount', formatNaira(finalAmt));
    }
    y += 6;
  }

  // ---------- Visit Assessment (Skin Analysis / Body Composition) ----------
  // Source-of-truth order:
  //   1. explicit assessmentId
  //   2. visitId scope
  //   3. appointmentId scope
  //   4. latest by client (legacy fallback)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase as any)
      .from('client_visit_assessments')
      .select('*')
      .eq('client_id', client.id);
    if (assessmentId) q = q.eq('id', assessmentId);
    else if (visitId) q = q.eq('visit_id', visitId);
    else if (appointmentId) q = q.eq('appointment_id', appointmentId);
    const { data: assess } = await q
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (assess) {
      // ---- V2A: Treatment status banner ----
      const acceptedSvcsForBanner = ((assess.recommended_services ?? []) as RecommendedService[])
        .filter((s) => s.status === 'accepted');
      sectionTitle('Treatment Status');
      if (acceptedSvcsForBanner.length === 0) {
        kvRow('Today', 'Treatment not started today');
        kvRow('Note', 'Recommendations are on file');
      } else {
        kvRow('Today', 'Treatment plan recommended / started');
        kvRow('Accepted services', acceptedSvcsForBanner.map((s) => s.name).join(', '));
      }
      y += 4;

      // Professional Assessment summary
      if (assess.main_concern || assess.client_goal || assess.practitioner_observation) {
        sectionTitle('Professional Assessment');
        if (assess.main_concern) kvRow('Main concern', assess.main_concern);
        if (assess.client_goal) kvRow('Client goal', assess.client_goal);
        if (assess.practitioner_observation) {
          ensureRoom(40);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(...C_INK);
          const lines = doc.splitTextToSize(assess.practitioner_observation, pageW - margin * 2);
          lines.forEach((ln: string) => { ensureRoom(14); doc.text(ln, margin, y); y += 14; });
        }
        y += 4;
      }

      // Skin Analysis section
      if (assess.skin_analysis_enabled) {
        const skin = (assess.skin_analysis ?? {}) as SkinAnalysisPayload;
        const engine = (skin.engine ?? null) as EnginePayload | null;
        const ai = skin.ai_assist ?? null;
        const acceptedSvcNames = ((assess.recommended_services ?? []) as RecommendedService[])
          .filter((s) => s.status === 'accepted').map((s) => s.name);
        const acceptedProdNames = ((assess.recommended_products ?? []) as RecommendedProduct[])
          .filter((p) => p.status === 'accepted').map((p) => p.name);
        const pctx = buildPersonalizeCtx({
          clientName: client.full_name,
          mainConcern: assess.main_concern ?? skin.main_visible_concern ?? null,
          goal: assess.client_goal ?? null,
          engine,
          acceptedServices: acceptedSvcNames,
          acceptedProducts: acceptedProdNames,
          hasAi: !!ai,
        });

        const heading = pctx.firstName
          ? `Skin Analysis — ${pctx.firstName}'s approved snapshot`
          : 'Skin Analysis Overview';
        sectionTitle(heading);

        // Inline snapshot when AI-assisted analysis attached an image.
        let snapshotDataUrl: string | null = null;
        let snapshotDims: { w: number; h: number } | null = null;
        if (ai?.media_ids && ai.media_ids.length > 0) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: mediaRows } = await (supabase as any)
              .from('client_media')
              .select('storage_path,bucket_path,mime_type')
              .in('id', ai.media_ids.slice(0, 1));
            const first = (mediaRows ?? [])[0];
            if (first) {
              const path = first.storage_path ?? first.bucket_path;
              snapshotDataUrl = await fetchSignedDataUrl(path);
              if (snapshotDataUrl) snapshotDims = { w: 150, h: 112 };
            }
          } catch { /* snapshot optional */ }
        }

        // Meta row (skin type / concern / mode) laid out beside snapshot if present.
        const metaLeft = margin;
        const metaRight = snapshotDataUrl ? pageW - margin - (snapshotDims?.w ?? 0) - 10 : pageW - margin;
        const metaTop = y;
        if (snapshotDataUrl && snapshotDims) {
          ensureRoom(snapshotDims.h + 8);
          try {
            doc.addImage(
              snapshotDataUrl, detectFmt(snapshotDataUrl),
              pageW - margin - snapshotDims.w, metaTop, snapshotDims.w, snapshotDims.h,
            );
          } catch { /* ignore */ }
        }
        const metaKv = (k: string, v: string) => {
          ensureRoom(14);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
          doc.setTextColor(...C_MUTED); doc.text(k, metaLeft, y);
          doc.setTextColor(...C_INK); doc.setFont('helvetica', 'bold');
          const maxW = metaRight - (metaLeft + 110);
          const lines = doc.splitTextToSize(v, Math.max(80, maxW));
          doc.text(lines[0], metaLeft + 110, y);
          y += 14;
        };
        if (skin.skin_type) metaKv('Skin type', skin.skin_type);
        if (pctx.mainConcern) metaKv('Main concern', pctx.mainConcern);
        if (pctx.goal) metaKv('Client goal', pctx.goal);
        metaKv('Analysis mode', ai ? 'AI-assisted · reviewed by practitioner' : 'Manual');
        // Ensure y clears the snapshot block.
        if (snapshotDataUrl && snapshotDims) {
          const snapshotBottom = metaTop + snapshotDims.h + 4;
          if (y < snapshotBottom) y = snapshotBottom;
        }
        y += 4;

        // Confidence / limited-quality banner (AI only).
        const banner = confidenceBanner(ai);
        if (banner.show) {
          ensureRoom(22);
          const bh = 18;
          doc.setFillColor(255, 244, 214);
          doc.setDrawColor(...C_GOLD);
          doc.roundedRect(margin, y, pageW - margin * 2, bh, 3, 3, 'FD');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
          doc.setTextColor(140, 90, 20);
          doc.text(banner.message, margin + 8, y + 12);
          y += bh + 6;
        }

        if (engine) {
          // Engine-styled cards: heading + bar + stability chip + personalized copy,
          // with matching AI observation appended where available.
          const aiObs = (ai?.observations ?? []) as string[];
          const matchObservationFor = (label: string): string | null => {
            if (!aiObs.length) return null;
            const needles = label.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
            for (const o of aiObs) {
              const l = o.toLowerCase();
              if (needles.some((n) => l.includes(n))) return o;
            }
            return null;
          };

          // Defensive fallback: rows saved before the AI-Apply-finalizes fix may
          // have variable scores but an empty priority_order. Derive an ad-hoc
          // order (lowest score first = highest priority) so the section still
          // renders variable cards instead of a blank body.
          const orderKeys: EngineVariableKey[] =
            engine.priority_order && engine.priority_order.length > 0
              ? (engine.priority_order as EngineVariableKey[])
              : (Object.keys(engine.variables) as EngineVariableKey[])
                  .filter((k) => engine.variables[k] && typeof engine.variables[k]!.practitioner_score === 'number')
                  .sort((a, b) => (engine.variables[a]!.practitioner_score) - (engine.variables[b]!.practitioner_score));
          orderKeys.forEach((k) => {
            const s = engine.variables[k];
            if (!s) return;
            const stage = stageFor(k, s.practitioner_score);
            const label = ENGINE_VARIABLE_LABEL[k];
            const score = s.practitioner_score;
            const stab = stabilityLabel(score);
            ensureRoom(80);

            // Card frame
            const cardTop = y;
            const cardX = margin;
            const cardW = pageW - margin * 2;
            doc.setDrawColor(...C_LINE);
            doc.setFillColor(250, 248, 253);
            // We draw the frame after computing height; reserve start.
            const contentX = cardX + 10;
            const contentW = cardW - 20;
            y = cardTop + 12;

            // Heading row: label + score, stability chip on the right.
            doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...C_PURPLE);
            doc.text(`${label} — ${score}%`, contentX, y);
            // Stability chip
            const chipText = stab;
            doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
            const chipW = doc.getTextWidth(chipText) + 12;
            const chipH = 12;
            const chipX = cardX + cardW - 10 - chipW;
            const chipY = y - 9;
            doc.setDrawColor(...C_GOLD); doc.setFillColor(...C_GOLD);
            doc.roundedRect(chipX, chipY, chipW, chipH, 3, 3, 'F');
            doc.setTextColor(255, 255, 255);
            doc.text(chipText, chipX + 6, chipY + 8.5);
            y += 8;

            // Score bar
            const barX = contentX;
            const barW = contentW;
            const barH = 6;
            doc.setFillColor(232, 226, 240);
            doc.roundedRect(barX, y, barW, barH, 2, 2, 'F');
            const fillW = Math.max(0, Math.min(1, score / 100)) * barW;
            doc.setFillColor(...C_GOLD);
            doc.roundedRect(barX, y, fillW, barH, 2, 2, 'F');
            y += barH + 8;

            // Personalized analysis line
            doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...C_INK);
            const analysisText = personalizeCopy(stage.analysis, pctx);
            doc.splitTextToSize(analysisText, contentW).forEach((ln: string) => {
              ensureRoom(12); doc.text(ln, contentX, y); y += 12;
            });
            y += 2;

            const blocks: [string, string][] = [
              ['Impact', personalizeCopy(stage.impact, pctx)],
              ['Call to action', personalizeCopy(stage.call_to_action, pctx)],
              ['Treatment direction', personalizeCopy(stage.treatment_direction, pctx)],
              ['Customization', personalizeCopy(stage.home_care_alternatives, pctx)],
            ];
            if (s.note) blocks.push(['Practitioner note', s.note]);
            const matched = matchObservationFor(label);
            if (matched) blocks.push(['AI observation', matched]);
            blocks.forEach(([k2, v]) => {
              if (!v) return;
              doc.splitTextToSize(`${k2}: ${v}`, contentW).forEach((ln: string) => {
                ensureRoom(12); doc.text(ln, contentX, y); y += 12;
              });
            });

            // Draw the frame retroactively.
            const cardBottom = y + 8;
            doc.setDrawColor(...C_LINE);
            doc.setLineWidth(0.5);
            doc.roundedRect(cardX, cardTop, cardW, cardBottom - cardTop, 4, 4, 'S');
            y = cardBottom + 6;
          });
        }

        if ((skin.observed_causes ?? []).length > 0) kvRow('Observed causes', skin.observed_causes.join(', '));
        if (includeSensitiveNotes && skin.practitioner_interpretation) {
          ensureRoom(16);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C_MUTED);
          doc.text('Practitioner interpretation', margin, y); y += 14;
          doc.setFont('helvetica', 'normal'); doc.setTextColor(...C_INK);
          const lines = doc.splitTextToSize(skin.practitioner_interpretation, pageW - margin * 2);
          lines.forEach((ln: string) => { ensureRoom(14); doc.text(ln, margin, y); y += 14; });
        }
        y += 4;

        // Progress comparison — only for 'progress' scope when a prior engine assessment exists.
        if (scope === 'progress' && engine) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: prior } = await (supabase as any)
              .from('client_visit_assessments')
              .select('*')
              .eq('client_id', client.id)
              .eq('skin_analysis_enabled', true)
              .lt('created_at', assess.created_at)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            const priorSkin = (prior?.skin_analysis ?? {}) as SkinAnalysisPayload;
            const priorEngine = (priorSkin.engine ?? null) as EnginePayload | null;
            if (prior && priorEngine) {
              sectionTitle('Progress Comparison');
              kvRow('Baseline date', new Date(prior.created_at).toLocaleDateString());
              kvRow('Current date', new Date(assess.created_at).toLocaleDateString());
              y += 4;
              ensureRoom(18);
              doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...C_MUTED);
              doc.text('Variable', margin, y);
              doc.text('Baseline %', margin + 200, y);
              doc.text('Current %', margin + 270, y);
              doc.text('Change', margin + 340, y);
              doc.text('Status', margin + 410, y);
              y += 6;
              doc.setDrawColor(...C_LINE); doc.line(margin, y, pageW - margin, y); y += 10;
              ENGINE_VARIABLE_KEYS.forEach((k) => {
                const cur = engine.variables[k];
                const prv = priorEngine.variables[k];
                if (!cur && !prv) return;
                // Stability: higher is better.
                const curS = typeof cur?.practitioner_score === 'number' ? cur.practitioner_score : null;
                const prvS = typeof prv?.practitioner_score === 'number' ? prv.practitioner_score : null;
                const delta = (curS != null && prvS != null) ? curS - prvS : null;
                let status = '—';
                if (delta != null) status = delta > 3 ? 'Improved' : (delta < -3 ? 'Worsened' : 'Stable');
                ensureRoom(14);
                doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...C_INK);
                doc.text(ENGINE_VARIABLE_LABEL[k], margin, y);
                doc.text(prvS != null ? `${prvS}%` : '—', margin + 200, y);
                doc.text(curS != null ? `${curS}%` : '—', margin + 270, y);
                doc.text(delta != null ? `${delta > 0 ? '+' : ''}${delta}` : '—', margin + 340, y);
                doc.text(status, margin + 410, y);
                y += 13;
              });
              y += 6;
            }
          } catch { /* progress compare optional */ }
        }
      }

      // Body Composition section
      if (assess.body_bmi_enabled) {
        sectionTitle('Body Composition Overview');
        const body = (assess.body_bmi_report ?? {}) as BodyBmiPayload;
        if (body.height_cm) kvRow('Height (cm)', String(body.height_cm));
        if (body.weight_kg) kvRow('Weight (kg)', String(body.weight_kg));
        if (body.bmi) kvRow('BMI', `${body.bmi} (screening reference)`);
        if (body.bmi_category) kvRow('BMI category', BMI_CATEGORY_LABEL[body.bmi_category]);
        if (body.target_body_area) kvRow('Target area', body.target_body_area);
        if (body.body_goal) kvRow('Body goal', body.body_goal);
        if (body.measurements) {
          const parts: string[] = [];
          (['waist','hip','arm','thigh'] as const).forEach((m) => {
            const v = body.measurements?.[m];
            if (v != null) parts.push(`${m} ${v}cm`);
          });
          if (parts.length) kvRow('Measurements', parts.join(' · '));
        }
        if (body.lifestyle_notes) kvRow('Lifestyle', body.lifestyle_notes);
        if (body.energy_level) kvRow('Energy level', body.energy_level);
        if (body.hydration_goal) kvRow('Wellness goal', body.hydration_goal);
        if (body.pain_tension_areas) kvRow('Pain / tension', body.pain_tension_areas);
        if (body.contraindications) kvRow('Red flags', body.contraindications);
        if (body.practitioner_interpretation) {
          ensureRoom(16);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C_MUTED);
          doc.text('Practitioner interpretation', margin, y); y += 14;
          doc.setFont('helvetica', 'normal'); doc.setTextColor(...C_INK);
          const lines = doc.splitTextToSize(body.practitioner_interpretation, pageW - margin * 2);
          lines.forEach((ln: string) => { ensureRoom(14); doc.text(ln, margin, y); y += 14; });
        }
        y += 4;
      }

      // Recommendations
      const recSvcs = (assess.recommended_services ?? []) as RecommendedService[];
      const recProds = (assess.recommended_products ?? []) as RecommendedProduct[];
      if (recSvcs.length || recProds.length) {
        sectionTitle('Recommended Treatment Plan');
        const renderRec = (label: string, items: { name: string; status: string; price?: number | null; sessions?: number | null }[]) => {
          if (!items.length) return;
          ensureRoom(16);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C_PURPLE);
          doc.text(label, margin, y); y += 14;
          doc.setFont('helvetica', 'normal'); doc.setTextColor(...C_INK);
          items.forEach((it) => {
            ensureRoom(14);
            const status = REC_STATUS_LABEL[it.status as keyof typeof REC_STATUS_LABEL] ?? it.status;
            const sessions = it.sessions && it.sessions > 1 ? ` ×${it.sessions} sessions` : '';
            const unit = it.price ? ` — ${formatNaira(it.price)}` : '';
            const total = it.price && it.sessions && it.sessions > 1
              ? ` (total ${formatNaira(it.price * it.sessions)})` : '';
            doc.text(`•  ${it.name}${sessions}${unit}${total}  [${status}]`, margin + 6, y);
            y += 14;
          });
          y += 2;
        };
        renderRec('Services', recSvcs);
        renderRec('Products', recProds);

        // Accepted / declined / postponed summary
        const acceptedSvc = recSvcs.filter((r) => r.status === 'accepted');
        const acceptedProd = recProds.filter((r) => r.status === 'accepted');
        const declined = [...recSvcs, ...recProds].filter((r) => r.status === 'declined');
        const postponed = [...recSvcs, ...recProds].filter((r) => r.status === 'postponed');
        if (acceptedSvc.length) kvRow('Accepted services today', acceptedSvc.map((r) => r.name).join(', '));
        if (acceptedProd.length) kvRow('Purchased today', acceptedProd.map((r) => r.name).join(', '));
        if (declined.length) kvRow('Declined', declined.map((r) => r.name).join(', '));
        if (postponed.length) kvRow('Postponed', postponed.map((r) => r.name).join(', '));
        y += 4;
      }

      // Aftercare / follow-up
      if (assess.home_care || assess.follow_up_recommendation || assess.next_visit_in_weeks) {
        sectionTitle('Aftercare & Follow-up');
        if (assess.home_care) {
          ensureRoom(16);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C_MUTED);
          doc.text('Customization', margin, y); y += 14;
          doc.setFont('helvetica', 'normal'); doc.setTextColor(...C_INK);
          const lines = doc.splitTextToSize(assess.home_care, pageW - margin * 2);
          lines.forEach((ln: string) => { ensureRoom(14); doc.text(ln, margin, y); y += 14; });
        }
        if (assess.follow_up_recommendation) kvRow('Follow-up', assess.follow_up_recommendation);
        if (assess.next_visit_in_weeks) kvRow('Next visit', `in ${assess.next_visit_in_weeks} week(s)`);
        y += 4;
      }

      // Lifestyle Recommendations — driven by engine scores ≤ 60
      try {
        const skin = (assess.skin_analysis ?? {}) as SkinAnalysisPayload;
        const engine = (skin.engine ?? null) as EnginePayload | null;
        const lifestyle = lifestyleRecommendations(engine);
        if (lifestyle.length > 0) {
          sectionTitle('Top 2 Lifestyle Recommendations');
          doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...C_INK);
          lifestyle.slice(0, 2).forEach((rec, i) => {
            const lines = doc.splitTextToSize(`${i + 1}. ${rec.tip}`, pageW - margin * 2 - 6);
            lines.forEach((ln: string) => { ensureRoom(13); doc.text(ln, margin + 6, y); y += 13; });
          });
          y += 4;
        }
      } catch { /* lifestyle section optional */ }

      // ---- V2A: Sensitive / internal notes (only when explicitly included) ----
      if (includeSensitiveNotes) {
        const redFlags = (assess.red_flags ?? []) as string[];
        const skin = (assess.skin_analysis ?? {}) as SkinAnalysisPayload;
        const body = (assess.body_bmi_report ?? {}) as BodyBmiPayload;
        const hasNotes =
          (redFlags && redFlags.length > 0) ||
          !!skin.practitioner_interpretation ||
          !!body.practitioner_interpretation;
        if (hasNotes) {
          sectionTitle('Internal Safety & Clinical Notes');
          if (redFlags.length) kvRow('Red flags', redFlags.join(', '));
          if (skin.practitioner_interpretation) {
            kvRow('Skin interpretation', skin.practitioner_interpretation);
          }
          if (body.practitioner_interpretation) {
            kvRow('Body interpretation', body.practitioner_interpretation);
          }
          y += 4;
        }
      }
    }
  } catch {
    // assessment is optional; ignore if table not yet present in types or query fails
  }

  // ---------- AI-Assist appendix (only when practitioner attached AI output) ----------
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let assessRow: any = null;
    if (assessmentId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('client_visit_assessments').select('skin_analysis').eq('id', assessmentId).maybeSingle();
      assessRow = data;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('client_visit_assessments').select('skin_analysis')
        .eq('client_id', client.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      assessRow = data;
    }
    const skin = (assessRow?.skin_analysis ?? {}) as SkinAnalysisPayload;
    const ai = skin.ai_assist ?? null;
    if (ai && (ai.observations?.length || ai.areas_to_mark?.length || ai.report_ready_summary)) {
      doc.addPage(); y = margin;
      sectionTitle('AI-Assisted Skin Snapshot (Appendix)');

      // Snapshot: first attached media
      if (ai.media_ids && ai.media_ids.length > 0) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: mediaRows } = await (supabase as any)
            .from('client_media')
            .select('storage_path,bucket_path,mime_type')
            .in('id', ai.media_ids.slice(0, 1));
          const first = (mediaRows ?? [])[0];
          if (first) {
            const path = first.storage_path ?? first.bucket_path;
            const dataUrl = await fetchSignedDataUrl(path);
            if (dataUrl) {
              const w = 220; const h = w * 0.75;
              ensureRoom(h + 12);
              try { doc.addImage(dataUrl, detectFmt(dataUrl), margin, y, w, h); } catch { /* ignore */ }
              y += h + 12;
            }
          }
        } catch { /* snapshot optional */ }
      }

      if (ai.report_ready_summary) {
        ensureRoom(16);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C_MUTED);
        doc.text('Summary', margin, y); y += 14;
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...C_INK);
        doc.splitTextToSize(ai.report_ready_summary, pageW - margin * 2).forEach((ln: string) => {
          ensureRoom(14); doc.text(ln, margin, y); y += 14;
        });
        y += 4;
      }

      if (ai.areas_to_mark && ai.areas_to_mark.length > 0) {
        ensureRoom(16);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C_MUTED);
        doc.text('Areas to note', margin, y); y += 14;
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...C_INK);
        ai.areas_to_mark.slice(0, 8).forEach((a) => {
          const line = `• ${a.area}: ${a.note}`;
          doc.splitTextToSize(line, pageW - margin * 2 - 6).forEach((ln: string) => {
            ensureRoom(13); doc.text(ln, margin + 6, y); y += 13;
          });
        });
        y += 4;
      }

      if (ai.practitioner_notes && ai.practitioner_notes.length > 0) {
        ensureRoom(16);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C_MUTED);
        doc.text('Practitioner-approved notes', margin, y); y += 14;
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...C_INK);
        ai.practitioner_notes.slice(0, 8).forEach((n) => {
          doc.splitTextToSize(`• ${n}`, pageW - margin * 2 - 6).forEach((ln: string) => {
            ensureRoom(13); doc.text(ln, margin + 6, y); y += 13;
          });
        });
        y += 4;
      }

      // Positioning note (non-diagnostic, consultation framing).
      ensureRoom(20);
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...C_MUTED);
      const disc = 'Practitioner-reviewed AI-assisted skin pattern analysis for consultation, progress tracking, and personalized care planning.';
      doc.splitTextToSize(disc, pageW - margin * 2).forEach((ln: string) => {
        ensureRoom(12); doc.text(ln, margin, y); y += 12;
      });
      y += 4;
    }
  } catch { /* appendix optional */ }

  // ---------- V2A: Session Plan ----------
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: plans } = await (supabase as any)
      .from('treatment_plan_sessions')
      .select('*')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false });
    const list = (plans ?? []) as Array<{
      service_name: string;
      sessions_total: number;
      sessions_completed: number;
      sessions_paid_for: number | null;
      payment_status: string | null;
      status: string;
    }>;
    if (list.length > 0) {
      sectionTitle('Treatment Session Plan');
      list.forEach((p) => {
        const remaining = Math.max(p.sessions_total - p.sessions_completed, 0);
        const showPaid = p.sessions_paid_for != null || p.payment_status != null;
        const parts = [
          `planned ${p.sessions_total}`,
          `completed ${p.sessions_completed}`,
          `remaining ${remaining}`,
        ];
        if (showPaid) parts.push(`paid for ${p.sessions_paid_for ?? '?'}`);
        ensureRoom(14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...C_INK);
        const statusTag = p.status !== 'active' ? `  [${p.status}]` : '';
        doc.text(`•  ${p.service_name} — ${parts.join(' · ')}${statusTag}`, margin + 6, y);
        y += 14;
      });
      y += 4;
    }
  } catch {
    /* session plans are optional */
  }

  // ---------- Payment ----------
  if (paymentAmount && paymentAmount > 0) {
    sectionTitle('Payment Summary');
    kvRow('Amount paid', formatNaira(paymentAmount));
    kvRow('Category', paymentCategory ?? (inferredTier === 'regular' ? 'treatment-revenue' : 'membership'));
    kvRow('Recorded', new Date().toLocaleString());
    y += 6;
  }

  // Glossary removed per client request — kept available in-app for staff reference only.

  // ---------- Photos (up to 6 image-only) ----------
  const imagePhotos = photos
    .filter((p) => (p.file_type ?? '') === 'image' || (p.mime_type ?? '').startsWith('image/'))
    .filter((p) => {
      const cat = p.category ?? p.kind;
      return cat === 'before' || cat === 'after' || cat === 'treatment';
    })
    .slice(0, 6);

  if (imagePhotos.length > 0) {
    sectionTitle('Photos');
    const cols = 3;
    const gap = 10;
    const cellW = (pageW - margin * 2 - gap * (cols - 1)) / cols;
    const cellH = cellW * 0.75;

    for (let i = 0; i < imagePhotos.length; i++) {
      const col = i % cols;
      if (col === 0) ensureRoom(cellH + 22);
      const x = margin + col * (cellW + gap);
      const path = imagePhotos[i].storage_path ?? imagePhotos[i].bucket_path;
      const dataUrl = await fetchSignedDataUrl(path);
      if (dataUrl) {
        try {
          doc.addImage(dataUrl, detectFmt(dataUrl), x, y, cellW, cellH);
        } catch {
          doc.setDrawColor(...C_LINE);
          doc.rect(x, y, cellW, cellH);
        }
      } else {
        doc.setDrawColor(...C_LINE);
        doc.rect(x, y, cellW, cellH);
      }
      const cap = (imagePhotos[i].category ?? imagePhotos[i].kind ?? '').toString();
      doc.setFontSize(8);
      doc.setTextColor(...C_MUTED);
      doc.text(cap, x, y + cellH + 10);
      if (col === cols - 1 || i === imagePhotos.length - 1) {
        y += cellH + 22;
      }
    }
  }

  // ---------- Outreach follow-up CTA (single body paragraph) ----------
  if (isOutreach) {
    const CTA = 'Your skin analysis report is ready. You can book a clinic follow-up appointment for a deeper consultation and treatment plan.';
    const ctaLines = doc.splitTextToSize(CTA, pageW - margin * 2);
    ensureRoom(ctaLines.length * 12 + 24);
    y += 8;
    doc.setDrawColor(...C_GOLD);
    doc.setLineWidth(0.6);
    doc.line(margin, y, pageW - margin, y);
    y += 14;
    doc.setTextColor(...C_PURPLE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('BOOK A CLINIC FOLLOW-UP', margin, y);
    y += 14;
    doc.setTextColor(...C_INK);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    ctaLines.forEach((ln: string) => { doc.text(ln, margin, y); y += 12; });
  }

  // ---------- Footer on every page ----------
  const reportId = `TM-RPT-${Date.now().toString(36).toUpperCase()}`;
  const pageCount = doc.getNumberOfPages();
  const FOOTER_NOTE = 'This report is generated from practitioner-reviewed AI-assisted skin pattern analysis. It is designed to support consultation, progress tracking, and personalized care planning based on visible skin data captured during the session.';
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setTextColor(...C_MUTED);
    doc.setFont('helvetica', 'italic');
    const noteLines = doc.splitTextToSize(FOOTER_NOTE, pageW - margin * 2);
    let footY = pageH - 18 - (noteLines.length * 9) - 4;
    noteLines.forEach((ln: string) => { doc.text(ln, margin, footY); footY += 9; });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Report ${reportId}  ·  Generated ${new Date().toLocaleString()}`, margin, pageH - 18);
    doc.text(`Page ${p} / ${pageCount}`, pageW - margin, pageH - 18, { align: 'right' });
  }

  // ---------- Output → upload ----------
  const blob = doc.output('blob');
  const filename = `${reportId}.pdf`;
  const file = new File([blob], filename, { type: 'application/pdf' });
  const captionTier = inferredTier ? TIER_META[inferredTier].label : 'general';

  // No uploadFn → return the built report so the caller can preview / download
  // without persisting a versioned snapshot.
  if (!uploadFn) {
    // Returned via the buildClientReportPdf wrapper; downstream type-cast there.
    return ({
      blob,
      file,
      filename,
      reportId,
      scope,
      download: () => downloadBlob(blob, filename),
      preview: () => previewBlobInNewTab(blob),
    } as unknown) as ClientMedia;
  }

  // V2A versioning: compute next report_version per (client, scope).
  let nextVersion = 1;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prev } = await (supabase as any)
      .from('client_media')
      .select('report_version')
      .eq('client_id', client.id)
      .eq('report_type', scope)
      .order('report_version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prev?.report_version) nextVersion = (prev.report_version as number) + 1;
  } catch { /* fallback to 1 */ }

  const row = await uploadFn({
    clientId: client.id,
    file,
    category: 'report',
    caption: `${REPORT_SCOPE_LABEL[scope]} v${nextVersion} — ${captionTier}`,
    extra: {
      report_version: nextVersion,
      report_type: scope,
      report_scope: scope,
      visit_id: visitId,
      includes_sensitive_notes: includeSensitiveNotes,
    },
  });
  // Attach the in-memory artifact so callers can also preview / download locally.
  return Object.assign(row, {
    __built: {
      blob, file, filename, reportId, scope,
      download: () => downloadBlob(blob, filename),
      preview: () => previewBlobInNewTab(blob),
    } as BuiltClientReport,
  });
}