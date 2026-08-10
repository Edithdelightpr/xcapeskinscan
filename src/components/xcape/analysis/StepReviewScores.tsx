import { useState } from 'react';
import { ScanFace, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import SkinAnalysisEngine from '@/components/admin/SkinAnalysisEngine';
import QuickPickField from '@/components/admin/QuickPickField';
import { FieldStack, PRESETS } from '@/components/admin/assessmentShared';
import {
  OBSERVED_CAUSE_OPTIONS,
  type SkinAnalysisPayload,
} from '@/hooks/useVisitAssessments';
import {
  ENGINE_VARIABLE_LABEL,
  stageFor,
  type EnginePayload,
} from '@/lib/skinEngine';

interface Props {
  skin: SkinAnalysisPayload;
  setSkin: React.Dispatch<React.SetStateAction<SkinAnalysisPayload>>;
  observation: string;
  setObservation: (v: string) => void;
  redFlags: string;
  setRedFlags: (v: string) => void;
}

/**
 * Step 4 — Review & Scores. The practitioner reviews AI-suggested findings,
 * confirms or adjusts the four XCAPE scores through the existing Skin
 * Analysis Engine, and records their own interpretation and safety notes.
 */
const StepReviewScores = ({
  skin, setSkin, observation, setObservation, redFlags, setRedFlags,
}: Props) => {
  const [engineOpen, setEngineOpen] = useState(false);
  const engine = (skin.engine ?? null) as EnginePayload | null;
  const aiApproved = !!skin.ai_assist?.approved_at;

  const toggleCause = (c: string) => {
    const set = new Set(skin.observed_causes ?? []);
    if (set.has(c)) set.delete(c);
    else set.add(c);
    setSkin({ ...skin, observed_causes: Array.from(set) });
  };

  return (
    <div className="space-y-5">
      {/* XCAPE scores — the existing engine, unchanged */}
      <section className="glass rounded-xl p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ScanFace className="w-4 h-4 text-primary" /> XCAPE scores
              {aiApproved && engine && engine.priority_order.length > 0 && (
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Drafted from AI — review
                </span>
              )}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Four-variable stability scoring (100 = healthy, 0 = weakest): Pigmentation,
              Barrier &amp; Hydration, Firmness, Oil &amp; Congestion. Adjust any score —
              your judgement overrides the AI draft.
            </p>
            {engine && (
              <p className="text-[11px] text-foreground">
                Current result: <span className="font-semibold text-primary">{engine.overall_skin_stability}% stability</span>
                <span className="text-muted-foreground"> · {engine.overall_concern_burden}% concern burden</span>
              </p>
            )}
          </div>
          {!engineOpen && (
            <Button size="sm" type="button" onClick={() => setEngineOpen(true)} className="glow-primary">
              {engine ? 'Review / adjust scores' : 'Score manually'}
            </Button>
          )}
        </div>

        {engineOpen && (
          <div className="rounded-md border border-primary/40 bg-primary/[0.05] p-3">
            <SkinAnalysisEngine
              initial={engine}
              onClose={() => setEngineOpen(false)}
              onSave={(payload) => {
                setSkin((prev) => ({ ...prev, engine: payload }));
                setEngineOpen(false);
              }}
            />
          </div>
        )}

        {engine && !engineOpen && engine.priority_order.length > 0 && (
          <div className="border-t border-border/40 pt-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Priority order</p>
            <ol className="text-[11px] space-y-0.5">
              {engine.priority_order.slice(0, 5).map((k, i) => {
                const s = engine.variables[k];
                if (!s) return null;
                const stage = stageFor(k, s.practitioner_score);
                return (
                  <li key={k} className="flex items-center justify-between gap-2">
                    <span><span className="font-semibold">{i + 1}.</span> {ENGINE_VARIABLE_LABEL[k]}</span>
                    <span className="text-primary font-semibold">{s.practitioner_score}% · {stage.stage}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </section>

      {/* Practitioner findings */}
      <section className="glass rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Practitioner findings</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickPickField
            label="Skin type"
            fieldKey="skin_type"
            presets={[...PRESETS.skinType]}
            value={skin.skin_type ?? ''}
            onChange={(v) => setSkin({ ...skin, skin_type: v || null })}
            multi
            placeholder="Pick or add a skin type"
          />
          <QuickPickField
            label="Main visible concern"
            fieldKey="main_visible_concern"
            presets={[...PRESETS.mainVisibleConcern]}
            value={skin.main_visible_concern ?? ''}
            onChange={(v) => setSkin({ ...skin, main_visible_concern: v || null })}
            multi
            placeholder="Pick or add a visible concern"
          />
        </div>

        <FieldStack label="Observed causes (tap to toggle)">
          <div className="flex flex-wrap gap-1.5">
            {OBSERVED_CAUSE_OPTIONS.map((c) => {
              const on = (skin.observed_causes ?? []).includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCause(c)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs border transition-all',
                    on
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-surface text-muted-foreground border-border/60 hover:text-foreground',
                  )}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </FieldStack>

        <FieldStack label="Practitioner interpretation (tropical / melanin-rich skin context)">
          <Textarea
            rows={2}
            value={skin.practitioner_interpretation ?? ''}
            onChange={(e) => setSkin({ ...skin, practitioner_interpretation: e.target.value || null })}
            placeholder="Adjusted reading and reasoning for this client's skin tone and environment…"
          />
        </FieldStack>

        <FieldStack label="Practitioner observation">
          <Textarea
            rows={3}
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="What you observed during the analysis…"
          />
        </FieldStack>

        <QuickPickField
          label="Red flags / contraindications (safety)"
          fieldKey="red_flags"
          presets={[...PRESETS.redFlags]}
          value={redFlags}
          onChange={setRedFlags}
          multi
          placeholder="Search or add a red flag"
        />
      </section>
    </div>
  );
};

export default StepReviewScores;
