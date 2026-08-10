import { Input } from '@/components/ui/input';
import QuickPickField from '@/components/admin/QuickPickField';
import {
  FieldStack,
  PRESETS,
  RecommendedProductsPicker,
  RecommendedServicesPicker,
} from '@/components/admin/assessmentShared';
import type { RecommendedProduct, RecommendedService } from '@/hooks/useVisitAssessments';

interface Props {
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
 * Step 5 — Recommendations. Reuses the existing catalogue pickers and the
 * current recommendation layer (services, products, home care, follow-up).
 * The automated criteria engine is not claimed complete — the practitioner
 * makes the final selection from the admin-controlled catalogue.
 */
const StepRecommendations = ({
  recServices, setRecServices, recProducts, setRecProducts,
  homeCare, setHomeCare, followUp, setFollowUp, nextWeeks, setNextWeeks,
}: Props) => (
  <div className="space-y-5">
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

export default StepRecommendations;
