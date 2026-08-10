import { Sparkles, ImageOff } from 'lucide-react';
import SkinAnalysisAiPanel from '@/components/admin/SkinAnalysisAiPanel';
import type { SkinAnalysisPayload } from '@/hooks/useVisitAssessments';
import type { ClientMedia } from '@/hooks/useClientMedia';
import type { EnginePayload } from '@/lib/skinEngine';

interface Props {
  clientId: string;
  media: ClientMedia[];
  skin: SkinAnalysisPayload;
  setSkin: React.Dispatch<React.SetStateAction<SkinAnalysisPayload>>;
  onRefine: () => void;
}

/**
 * Step 3 — AI Analysis. Wraps the existing AI-Assist panel (private storage,
 * quality gate, structured observations, suggested scores). The images
 * selected in the Images step are passed in directly; nothing here is a new
 * engine — the same `analyze-skin-image` function and payload shape are used.
 */
const StepAiAnalysis = ({ clientId, media, skin, setSkin, onRefine }: Props) => {
  const engine = (skin.engine ?? null) as EnginePayload | null;

  return (
    <section className="glass rounded-xl p-5 space-y-4">
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> AI-assisted analysis
        </h2>
        <p className="text-[11px] text-muted-foreground">
          The AI reads the uploaded images and proposes findings and the four XCAPE scores.
          These are <span className="text-foreground font-medium">observations, not recommendations</span> —
          nothing reaches the client report until you review and approve it in the next step.
        </p>
      </header>

      {media.length === 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          <ImageOff className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-800">
            No images uploaded yet. Go back to the Images step for the standard analysis views,
            or continue to Review &amp; Scores to score manually without AI assistance.
          </p>
        </div>
      )}

      <SkinAnalysisAiPanel
        clientId={clientId}
        visitId={null}
        externalMedia={media}
        current={skin.ai_assist ?? null}
        currentEngine={engine}
        onChange={(next) => setSkin((prev) => ({ ...prev, ai_assist: next }))}
        onApplyAiEngine={(enginePayload, nextAi) => {
          // AI Apply produces a fully finalized engine payload — merged with
          // the approved AI envelope and persisted by the wizard's auto-save.
          setSkin((prev) => ({ ...prev, engine: enginePayload, ai_assist: nextAi }));
        }}
        onRefineInEngine={onRefine}
      />
    </section>
  );
};

export default StepAiAnalysis;
