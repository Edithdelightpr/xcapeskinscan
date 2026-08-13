import { useMemo } from 'react';
import ProtocolRecommendations from '@/components/xcape/protocol/ProtocolRecommendations';
import { useProtocolAlignments } from '@/hooks/useProductAlignments';
import { PROTOCOL_CATEGORIES, resolveProtocol, type ProtocolCategory } from '@/lib/xcapeRules/protocol';
import type { SkinAnalysisPayload } from '@/hooks/useVisitAssessments';

interface Props {
  skin: SkinAnalysisPayload;
}

/** Approved practitioner score per engine category (100 = healthiest). */
export function scoresFromSkin(
  skin: SkinAnalysisPayload,
): Partial<Record<ProtocolCategory, number>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const variables = (skin?.engine?.variables ?? {}) as Record<string, any>;
  const out: Partial<Record<ProtocolCategory, number>> = {};
  for (const key of PROTOCOL_CATEGORIES) {
    const v = variables[key];
    const score = v?.practitioner_score ?? v?.score;
    if (typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100) {
      out[key] = score;
    }
  }
  return out;
}

/**
 * Practitioner view of the deterministic XCAPE protocol — the SAME resolver
 * and alignment map the public report uses, so staff and visitor output can
 * never diverge.
 */
const StaffProtocolPanel = ({ skin }: Props) => {
  const { alignments } = useProtocolAlignments();
  const result = useMemo(
    () =>
      resolveProtocol({
        scores: scoresFromSkin(skin),
        alignments,
      }),
    [skin, alignments],
  );

  const hasScores = Object.keys(scoresFromSkin(skin)).length > 0;
  const nothingResolved =
    result.face.length === 0 && result.body.length === 0 && result.addons.length === 0;

  // Scores exist but the catalogue/alignment produced no product: the mapping
  // is genuinely missing. Say so explicitly and block approval — never guess.
  if (nothingResolved) {
    if (!hasScores) return null;
    return (
      <section className="glass rounded-xl p-5 space-y-1 border-l-2 border-l-amber-500/60">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
          XCAPE product/kit mapping required
        </h2>
        <p className="text-[11px] text-muted-foreground">
          The approved scores are available, but no active XCAPE product alignment resolves to a
          product for them. Formula approval, snapshot and purchase stay blocked until an admin maps
          the products in Products &amp; Ingredients. Nothing is substituted or invented.
        </p>
      </section>
    );
  }

  const customizationMissing = result.face.length === 0 && result.body.length === 0;

  return (
    <div className="space-y-3">
      {customizationMissing && (
        <p className="flex items-start gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-[11.5px] text-amber-600">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          XCAPE product/kit mapping required — no customizable base product (Face Cream / Body Milk)
          is aligned to these concerns, so a formula cannot be approved or purchased yet.
        </p>
      )}
      <ProtocolRecommendations
        face={result.face}
        body={result.body}
        addons={result.addons}
        footnote="Deterministic XCAPE protocol resolved from the approved scores and the admin product alignment. Only XCAPE Face Cream and Body Milk are customized (body at 3× the face dose); every other product is a recommendation only. DS Anti-Inflammatory is a required companion for pigmentation and oil/congestion lines. Accepting a formula proposal below stores these exact lines in the immutable snapshot that the client report and PDF read."
      />
    </div>
  );
};

export default StaffProtocolPanel;
