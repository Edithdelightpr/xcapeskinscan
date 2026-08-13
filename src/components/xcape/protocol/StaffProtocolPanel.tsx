import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import ProtocolRecommendations from '@/components/xcape/protocol/ProtocolRecommendations';
import { useDsAvailability, useProtocolAlignments } from '@/hooks/useProductAlignments';
import { useRecommendationConfig } from '@/hooks/useRecommendationConfig';
import {
  PROTOCOL_CATEGORIES,
  resolveProtocol,
  type ProtocolCategory,
  type ProtocolResult,
} from '@/lib/xcapeRules/protocol';
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
  const { dsAvailable } = useDsAvailability();
  const { config } = useRecommendationConfig();
  const result = useMemo(
    () =>
      resolveProtocol({
        scores: scoresFromSkin(skin),
        alignments,
        ds_available: dsAvailable,
        config,
      }),
    [skin, alignments, dsAvailable, config],
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
      {result.mapping_gaps.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-[11.5px] text-amber-600">
          <p className="flex items-start gap-1.5 font-medium">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            XCAPE product/kit mapping required
          </p>
          <ul className="mt-1 space-y-0.5 pl-5 list-disc">
            {result.mapping_gaps.map((g) => (
              <li key={`${g.area}-${g.product_sku}-${g.ds_sku}`}>
                {g.ds_name}
                {g.companion ? ' (required companion)' : ''} for {g.concern} on {g.product_name} is
                not an active catalogue product. That line is withheld — nothing is substituted.
              </li>
            ))}
          </ul>
        </div>
      )}
      {customizationMissing && (
        <p className="flex items-start gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-[11.5px] text-amber-600">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          XCAPE product/kit mapping required — no customizable base product (Face Cream / Body Milk)
          is aligned to these concerns, so a formula cannot be approved or purchased yet.
        </p>
      )}
      <ReasoningTrace reasoning={result.reasoning} />
      <BodyDerivationTrace result={result} />
      <ProtocolRecommendations
        face={result.face}
        body={result.body}
        addons={result.addons}
        footnote="Deterministic XCAPE protocol resolved from the approved health scores (100 = healthiest) and the admin product alignment. The body protocol is derived from the facial findings — the weak-elasticity Body Milk line is prepared at 5× the Face Cream amount. DS Anti-Inflammatory is a required companion for pigmentation and oil/congestion lines. Accepting a formula proposal below stores these exact lines in the immutable snapshot that the client report and PDF read."
      />
    </div>
  );
};

/**
 * Derived BODY logic, shown separately from the face formula: source health
 * score, source concern, base facial amount, multiplier and final amount.
 */
const BodyDerivationTrace = ({ result }: { result: ProtocolResult }) => {
  const lines = result.body.flatMap((p) =>
    p.additions.map((a) => ({ product: p.product_name, a })),
  );
  if (lines.length === 0) return null;
  return (
    <section className="glass rounded-xl p-5 space-y-2">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">Body protocol (derived)</h2>
        <p className="text-[11px] text-muted-foreground">
          Derived from the facial findings — the body is not independently scanned. A pathway only
          activates when its source health score is below 75. Rule version {result.version}.
        </p>
      </div>
      <ul className="space-y-1 text-[11.5px]">
        {lines.map(({ product, a }, i) => (
          <li key={`${product}-${a.ds_sku}-${i}`} className="text-muted-foreground">
            <span className="text-foreground">{product}</span> — {a.ds_name}
            {a.companion ? ' (required companion)' : ''}:{' '}
            <span className="text-foreground font-medium tabular-nums">{a.dose_ml} ml</span>
            {a.derivation
              ? ` · source: ${a.derivation.source_concern} (health ${a.derivation.source_score}/100) · base face ${a.derivation.base_face_dose_ml} ml × ${a.derivation.multiplier}`
              : ''}
          </li>
        ))}
      </ul>
    </section>
  );
};

/** Practitioner-facing trace: priority, interactions and every decision. */
const ReasoningTrace = ({ reasoning }: { reasoning: ProtocolResult['reasoning'] }) => {
  if (reasoning.priorities.length === 0) return null;
  const excluded = reasoning.decisions.filter((d) => !d.recommended);
  return (
    <section className="glass rounded-xl p-5 space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">Recommendation reasoning</h2>
        <p className="text-[11px] text-muted-foreground">
          Deterministic trace from configuration v{reasoning.config_version}. Severity = 100 − health
          score. Nothing here is generated by AI.
        </p>
      </div>

      <ul className="space-y-1 text-[11.5px]">
        {reasoning.priorities.map((p) => (
          <li key={p.category} className="flex items-baseline justify-between gap-3">
            <span className="text-foreground">
              {p.rank}. {p.concern}{' '}
              <span className="text-muted-foreground">({p.tier.replace('_', ' ')})</span>
            </span>
            <span className="text-muted-foreground">
              severity {p.severity} · {p.band_label} · priority {p.priority_score.toFixed(1)}
            </span>
          </li>
        ))}
      </ul>

      {reasoning.interactions.length > 0 && (
        <ul className="space-y-0.5 pl-4 list-disc text-[11.5px] text-muted-foreground">
          {reasoning.interactions.map((i) => (
            <li key={i.code}>{i.practitioner_text}</li>
          ))}
        </ul>
      )}

      {reasoning.companions.map((c) => (
        <p key={c.category} className="text-[11.5px] text-muted-foreground">
          {c.reason}
        </p>
      ))}

      {excluded.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Deliberately not recommended
          </p>
          <ul className="space-y-0.5 pl-4 list-disc text-[11.5px] text-muted-foreground">
            {excluded.map((d) => (
              <li key={`${d.area}-${d.product_sku}-${d.category}`}>
                <span className="text-foreground">{d.product_name}</span> ({d.area}) — {d.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {reasoning.requires_review && (
        <p className="flex items-start gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-[11.5px] text-amber-600">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          One or more product pairings are flagged as requiring practitioner review before approval.
        </p>
      )}
    </section>
  );
};

export default StaffProtocolPanel;
