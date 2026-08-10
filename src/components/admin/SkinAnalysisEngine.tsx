import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { ScanFace, ChevronLeft, ChevronRight, Sparkles, Save, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ENGINE_VARIABLE_KEYS, ENGINE_VARIABLE_LABEL, ENGINE_VARIABLE_DESCRIPTION,
  PRACTITIONER_HELPER_TEXT,
  stageFor, concernBurden, overallStability, priorityOrder,
  combinedInterpretation, recommendationIntensity, buildEnginePayload,
  type EngineVariableKey, type EngineVariableScore, type EnginePayload,
} from '@/lib/skinEngine';

interface Props {
  initial?: EnginePayload | null;
  onSave: (payload: EnginePayload) => void;
  onClose: () => void;
  assessedBy?: string | null;
}

type VarMap = Partial<Record<EngineVariableKey, EngineVariableScore>>;

const stepLabels = ['Score', 'Review'];

const SkinAnalysisEngine = ({ initial, onSave, onClose, assessedBy }: Props) => {
  const [step, setStep] = useState(0);
  const [vars, setVars] = useState<VarMap>(() => initial?.variables ?? {});

  const patch = (k: EngineVariableKey, p: Partial<EngineVariableScore>) => {
    setVars((prev) => {
      // Default `confidence` to 'medium' so saved payloads stay consistent
      // even though the UI no longer exposes the dropdown.
      const cur = prev[k] ?? { practitioner_score: 0, confidence: 'medium' as const };
      const merged = { ...cur, ...p };
      if (!merged.confidence) merged.confidence = 'medium';
      return { ...prev, [k]: merged };
    });
  };

  const allEntered = useMemo(
    () => ENGINE_VARIABLE_KEYS.every((k) => typeof vars[k]?.practitioner_score === 'number'),
    [vars],
  );

  const overall = overallStability(vars);
  const order = priorityOrder(vars);

  const handleSave = () => {
    if (!allEntered) return;
    const payload = buildEnginePayload(vars, { assessed_by: assessedBy ?? null });
    onSave(payload);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <p className="text-sm font-display font-bold">Skin Analysis Engine</p>
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">v1.0</span>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>Close engine</Button>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {stepLabels.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={cn(
              'flex-1 text-[11px] uppercase tracking-wider px-2 py-1.5 rounded border transition-colors',
              step === i
                ? 'border-primary bg-primary/10 text-primary font-semibold'
                : 'border-border/40 text-muted-foreground hover:text-foreground',
            )}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <ScoreStep vars={vars} patch={patch} />
      )}
      {step === 1 && (
        <ReviewStep vars={vars} overall={overall} order={order} />
      )}

      {!allEntered && step === 1 && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5" />
          Enter a machine score for every variable to enable save.
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        {step < 1 ? (
          <Button size="sm" onClick={() => setStep((s) => Math.min(1, s + 1))}>
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button size="sm" onClick={handleSave} disabled={!allEntered} className="glow-primary">
            <Save className="w-4 h-4 mr-1" /> Save engine result
          </Button>
        )}
      </div>
    </div>
  );
};

/* ---------- Step 1: Score sliders ---------- */

const ScoreStep = ({ vars, patch }: { vars: VarMap; patch: (k: EngineVariableKey, p: Partial<EngineVariableScore>) => void }) => (
  <div className="space-y-3">
    <p className="text-[11px] text-muted-foreground italic">{PRACTITIONER_HELPER_TEXT}</p>
    {ENGINE_VARIABLE_KEYS.map((k) => {
      const s = vars[k];
      const score = s?.practitioner_score ?? 0;
      const has = typeof s?.practitioner_score === 'number';
      const stage = stageFor(k, score);
      const burden = concernBurden(score);
      return (
        <div key={k} className="rounded-md border border-border/40 p-3 bg-card space-y-2 max-w-full overflow-hidden box-border">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{ENGINE_VARIABLE_LABEL[k]}</p>
              <p className="text-[11px] text-muted-foreground">{ENGINE_VARIABLE_DESCRIPTION[k]}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-bold text-primary">{has ? `${score}% health` : '—'}</p>
              {has && <p className="text-[10px] text-muted-foreground">{burden}% concern burden</p>}
            </div>
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Machine Health Score (0–100)
            </Label>
            <Slider
              min={0} max={100} step={1}
              value={[score]}
              onValueChange={(v) => patch(k, { practitioner_score: v[0] ?? 0 })}
            />
          </div>

          {has && (
            <div className="rounded bg-primary/[0.04] border border-primary/20 px-2 py-1.5 space-y-1">
              <p className="text-[11px]">
                <span className="font-semibold text-primary">{stage.stage}</span>
                <span className="text-muted-foreground"> · {stage.meaning}</span>
              </p>
              <p className="text-[11px] text-muted-foreground"><span className="font-semibold text-foreground">Impact:</span> {stage.impact}</p>
              <p className="text-[11px] text-muted-foreground"><span className="font-semibold text-foreground">CTA:</span> {stage.call_to_action}</p>
            </div>
          )}

          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Practitioner note</Label>
            <Textarea
              rows={1}
              placeholder="Optional"
              value={s?.note ?? ''}
              onChange={(e) => patch(k, { note: e.target.value || null })}
              className="text-xs min-h-[36px]"
            />
          </div>
        </div>
      );
    })}
  </div>
);

/* ---------- Step 2: Review ---------- */

const ReviewStep = ({ vars, overall, order }: { vars: VarMap; overall: number; order: EngineVariableKey[] }) => {
  const burden = 100 - overall;
  const interpretation = combinedInterpretation(vars);
  const intensity = recommendationIntensity(overall);

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-primary/30 bg-primary/[0.05] p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Overall Skin Stability</p>
          <p className="text-2xl font-display font-bold text-primary">{overall}%</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Overall Concern Burden</p>
          <p className="text-2xl font-display font-bold text-foreground">{burden}%</p>
        </div>
      </div>

      <div className="rounded-md border border-border/40 bg-card p-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Priority order (lowest scores first)</p>
        {order.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No scores entered yet.</p>
        ) : (
          <ol className="space-y-1.5">
            {order.map((k, i) => {
              const s = vars[k]!;
              const stage = stageFor(k, s.practitioner_score);
              return (
                <li key={k} className="text-xs flex flex-wrap items-center justify-between gap-2 border-b border-border/30 last:border-0 pb-1.5 last:pb-0">
                  <span className="min-w-0 break-words"><span className="font-semibold">{i + 1}.</span> {ENGINE_VARIABLE_LABEL[k]}</span>
                  <span className="text-right whitespace-normal">
                    <span className="text-primary font-semibold">{s.practitioner_score}% health</span>
                    <span className="text-muted-foreground"> · {stage.stage}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {interpretation && (
        <div className="rounded-md border border-border/40 bg-card p-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Combined interpretation</p>
          <p className="text-xs text-foreground leading-relaxed">{interpretation}</p>
        </div>
      )}

      <div className="rounded-md border border-border/40 bg-card p-3 space-y-2">
        <div className="flex items-center gap-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Recommendation intensity</p>
          <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold">
            {intensity.label}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">{intensity.description}</p>
        {intensity.approval_note && (
          <p className="text-[11px] text-amber-700 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1">
            {intensity.approval_note}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground italic">
          The engine suggests directions only — choose actual services and products from the menus below the engine. Nothing is auto-started.
        </p>
      </div>

      <div className="rounded-md border border-border/40 bg-card p-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Per-variable directions</p>
        <div className="space-y-2">
          {order.map((k) => {
            const stage = stageFor(k, vars[k]!.practitioner_score);
            return (
              <div key={k} className="text-[11px]">
                <p className="font-semibold text-foreground">
                  <ScanFace className="w-3 h-3 inline mr-1 text-primary" />
                  {ENGINE_VARIABLE_LABEL[k]}
                </p>
                <p className="text-muted-foreground"><span className="font-semibold text-foreground">Treatment:</span> {stage.treatment_direction}</p>
                <p className="text-muted-foreground"><span className="font-semibold text-foreground">Home-care:</span> {stage.home_care_direction}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SkinAnalysisEngine;
