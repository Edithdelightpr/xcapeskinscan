import { Input } from '@/components/ui/input';
import QuickPickField from '@/components/admin/QuickPickField';
import {
  FieldStack,
  PRESETS,
  RecommendedProductsPicker,
  RecommendedServicesPicker,
} from '@/components/admin/assessmentShared';
import XcapeProposalsPanel from './XcapeProposalsPanel';
import StaffProtocolPanel from '@/components/xcape/protocol/StaffProtocolPanel';
import type { RecommendedProduct, RecommendedService, SkinAnalysisPayload } from '@/hooks/useVisitAssessments';
import type { RuleOutputs } from '@/lib/xcapeRules/types';

interface Props {
  clientId: string;
  assessmentId: string | null;
  ensureSaved: () => Promise<{ id: string }>;
  skin: SkinAnalysisPayload;
  redFlags: string;
  observation: string;
  recServices: RecommendedService[];
  setRecServices: (v: RecommendedService[]) => void;
  recProducts: RecommendedProduct[];
  setRecProducts: (v: RecommendedProduct[]) => void;
  homeCare: string;
  setHomeCare: (v: string) => void;
  followUp: string;
  setFollowUp: (v: string) => void;
  nextWeeks: string;
  setNextWeeks: (v: string) => void;
}

/**
 * Step 5 — Recommendations. Two layers:
 *
 * 1. XCAPE proposals — published criteria evaluated against this analysis;
 *    every suggestion is labelled "Proposed by XCAPE" and only lands in the
 *    pickers below when the practitioner accepts it.
 * 2. The existing catalogue pickers — the practitioner's final selection
 *    (accept, edit, add or reject anything; only this layer feeds the
 *    report). The automated criteria engine supports, never replaces,
 *    clinical judgement.
 */
const StepRecommendations = ({
  clientId, assessmentId, ensureSaved, skin, redFlags, observation,
  recServices, setRecServices, recProducts, setRecProducts,
  homeCare, setHomeCare, followUp, setFollowUp, nextWeeks, setNextWeeks,
}: Props) => {
  /** Merge an accepted proposal into the practitioner's recommendation state. */
  const applyOutputs = (outputs: RuleOutputs) => {
    if (outputs.services?.length) {
      const merged = [...recServices];
      for (const s of outputs.services) {
        if (s.service_id && merged.some((m) => m.service_id === s.service_id)) continue;
        merged.push({
          service_id: s.service_id ?? null,
          name: s.name,
          sessions: s.sessions ?? outputs.sessions ?? null,
          status: 'recommended',
          note: s.note ?? null,
        });
      }
      setRecServices(merged);
    }
    if (outputs.products?.length) {
      const merged = [...recProducts];
      for (const p of outputs.products) {
        if (p.product_id && merged.some((m) => m.product_id === p.product_id)) continue;
        merged.push({
          product_id: p.product_id ?? null,
          name: p.name,
          status: 'recommended',
          note: p.note ?? null,
        });
      }
      setRecProducts(merged);
    }
    if (outputs.home_care) {
      setHomeCare(homeCare ? `${homeCare}, ${outputs.home_care}` : outputs.home_care);
    }
    const followUpBits = [
      outputs.frequency && `Frequency: ${outputs.frequency}`,
      outputs.duration && `Duration: ${outputs.duration}`,
    ].filter(Boolean);
    if (followUpBits.length > 0) {
      const text = followUpBits.join(' · ');
      setFollowUp(followUp ? `${followUp} · ${text}` : text);
    }
    if (outputs.follow_up_weeks != null) {
      setNextWeeks(outputs.follow_up_weeks.toString());
    }
  };

  return (
    <div className="space-y-5">
      <XcapeProposalsPanel
        clientId={clientId}
        assessmentId={assessmentId}
        ensureSaved={ensureSaved}
        skin={skin}
        redFlags={redFlags}
        observation={observation}
        onApply={applyOutputs}
      />

      <StaffProtocolPanel skin={skin} />

      <section className="glass rounded-xl p-5 space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Treatment &amp; home-care directions</h2>
          <p className="text-[11px] text-muted-foreground">
            Selected from the current XCAPE service and product catalogue. These are
            <span className="text-foreground font-medium"> recommendations informed by the analysis</span> —
            final selection remains the practitioner's clinical judgement.
          </p>
        </div>
        <RecommendedServicesPicker items={recServices} onChange={setRecServices} />
        <RecommendedProductsPicker items={recProducts} onChange={setRecProducts} />
      </section>

      <section className="glass rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Aftercare &amp; follow-up</h2>
        <QuickPickField
          label="Home-care / aftercare advice"
          fieldKey="home_care"
          presets={[...PRESETS.homeCare]}
          value={homeCare}
          onChange={setHomeCare}
          multi
          placeholder="Search or add aftercare advice"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickPickField
            label="Follow-up recommendation"
            fieldKey="follow_up"
            presets={[...PRESETS.followUp]}
            value={followUp}
            onChange={setFollowUp}
            placeholder="Search or add a follow-up plan"
          />
          <FieldStack label="Next review (weeks)">
            <Input
              type="number"
              min={0}
              value={nextWeeks}
              onChange={(e) => setNextWeeks(e.target.value)}
              placeholder="e.g. 4"
            />
          </FieldStack>
        </div>
      </section>
    </div>
  );
};

export default StepRecommendations;
