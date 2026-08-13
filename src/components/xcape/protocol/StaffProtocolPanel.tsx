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

  if (result.face.length === 0 && result.body.length === 0) return null;

  return (
    <ProtocolRecommendations
      face={result.face}
      body={result.body}
      footnote="Deterministic XCAPE protocol resolved from the approved scores and the admin product alignment. Body accompanies face at 3× the face dose. DS Anti-Inflammatory is a required companion for pigmentation and oil/congestion lines. Accepting a formula proposal below stores these exact lines in the immutable snapshot that the client report and PDF read."
    />
  );
};

export default StaffProtocolPanel;
