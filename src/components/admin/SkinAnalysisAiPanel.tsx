/**
 * Skin Analysis AI Panel (V1, beta)
 *
 * Practitioner-facing decision-support tool. Uploads client skin snapshots to
 * the private `client-media` bucket, calls the `analyze-skin-image` edge
 * function, and renders structured AI observations. Practitioner clicks
 * "Apply to sliders" to prefill the existing Skin Analysis Engine — nothing
 * about the engine's math changes.
 *
 * Safety:
 *  - Blocks "Apply to sliders" when image_quality.usable === false.
 *  - Always renders a disclaimer that this is AI assist, not diagnosis.
 */
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Sparkles, Upload, AlertTriangle, Wand2, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useUploadClientMedia, type ClientMedia } from '@/hooks/useClientMedia';
import type { AiAssistPayload } from '@/hooks/useVisitAssessments';
import type { EnginePayload, EngineVariableKey, EngineVariableScore } from '@/lib/skinEngine';
import { ENGINE_VARIABLE_LABEL, buildEnginePayload } from '@/lib/skinEngine';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  clientId: string;
  /**
   * XCAPE analysis these images belong to. Required for Affiliate/CDP
   * accounts: uploads are stored against it and the edge function authorizes
   * partner access per assessment. Legacy MedSpa callers omit it.
   */
  assessmentId?: string | null;
  visitId?: string | null;

  current: AiAssistPayload | null | undefined;
  /** Existing engine variables the practitioner may have already entered. */
  currentEngine?: EnginePayload | null;
  /**
   * Images already uploaded earlier in the flow (e.g. the XCAPE wizard's
   * Images step). Merged with anything uploaded directly from this panel —
   * optional, existing callers are unaffected.
   */
  externalMedia?: ClientMedia[];
  onChange: (next: AiAssistPayload | null) => void;
  /**
   * Called with a fully-finalized engine payload after Apply. The panel now
   * computes stability / priority_order / interpretation / directions so the
   * report can render immediately without opening the manual stepper.
   */
  onApplyAiEngine: (engine: EnginePayload, aiAssist: AiAssistPayload) => void;
  /** Optional escape hatch: opens the manual engine for fine-tuning. */
  onRefineInEngine?: () => void;
}

type SuggestedMap = NonNullable<AiAssistPayload['suggested_scores']>;

const SkinAnalysisAiPanel = ({
  clientId, assessmentId, visitId, current, currentEngine, externalMedia,
  onChange, onApplyAiEngine, onRefineInEngine,
}: Props) => {

  const uploadMut = useUploadClientMedia();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [sessionUploaded, setSessionUploaded] = useState<ClientMedia[]>([]);

  // Externally supplied images (uploaded earlier in the flow) take the first
  // slots; images uploaded from this panel fill the rest, up to the 4 max.
  const uploaded = useMemo(() => {
    const map = new Map<string, ClientMedia>();
    (externalMedia ?? []).forEach((m) => map.set(m.id, m));
    sessionUploaded.forEach((m) => map.set(m.id, m));
    return Array.from(map.values()).slice(0, 4);
  }, [externalMedia, sessionUploaded]);

  const usable = current?.image_quality?.usable !== false;
  const suggested: SuggestedMap = current?.suggested_scores ?? {};

  const handlePick = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, 4 - uploaded.length);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const rows: ClientMedia[] = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const row = await uploadMut.mutateAsync({
          clientId,
          assessmentId: assessmentId ?? undefined,
          requireAssessment: assessmentId !== undefined,
          file,
          category: 'other',
          caption: 'AI-Assist skin snapshot',
          extra: { visit_id: visitId ?? null },
        });

        rows.push(row);
      }
      setSessionUploaded((prev) => [...prev, ...rows]);
      toast.success(`${rows.length} image${rows.length === 1 ? '' : 's'} uploaded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyze = async () => {
    if (uploaded.length === 0) {
      toast.error('Upload at least one image first');
      return;
    }
    setAnalyzing(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).functions.invoke('analyze-skin-image', {
        body: {
          client_id: clientId,
          // Partner accounts are authorized per assessment server-side; the id
          // must therefore travel with the request.
          assessment_id: assessmentId ?? null,
          visit_id: visitId ?? null,
          media_ids: uploaded.map((u) => u.id),
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? 'AI analysis failed');

      const r = data.result ?? {};
      const payload: AiAssistPayload = {
        version: '1.0',
        model: data.model,
        analyzed_at: data.analyzed_at,
        analyzed_by: data.analyzed_by ?? null,
        media_ids: data.media_ids ?? uploaded.map((u) => u.id),
        raw: r,
        image_quality: r.image_quality ?? { usable: true },
        observations: Array.isArray(r.observations) ? r.observations : [],
        areas_to_mark: Array.isArray(r.areas_to_mark) ? r.areas_to_mark : [],
        suggested_scores: (r.suggested_scores ?? {}) as SuggestedMap,
        practitioner_notes: Array.isArray(r.practitioner_notes) ? r.practitioner_notes : [],
        report_ready_summary: r.report_ready_summary ?? '',
        disclaimer: r.disclaimer ?? 'Practitioner-reviewed AI-assisted skin pattern analysis for consultation, progress tracking, and personalized care planning.',
      };
      onChange(payload);
      toast.success('AI analysis complete');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'AI analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApply = () => {
    if (!current || !usable) return;
    // V1 merge policy: AI overrides the 4 keys it returned; any other prior
    // variable entries the practitioner had are preserved untouched.
    const merged: Partial<Record<EngineVariableKey, EngineVariableScore>> = {
      ...(currentEngine?.variables ?? {}),
    };
    (Object.keys(suggested) as EngineVariableKey[]).forEach((k) => {
      const s = suggested[k];
      if (s && typeof s.score === 'number') {
        merged[k] = {
          practitioner_score: Math.max(0, Math.min(100, Math.round(s.score))),
          confidence: 'medium',
          adjustment_reason: `AI suggestion: ${(s.reasons ?? []).slice(0, 2).join('; ') || 'auto'}`,
        };
      }
    });
    // Finalize a full engine payload — same helper the manual stepper uses.
    const enginePayload = buildEnginePayload(merged, {
      assessed_by: user?.id ?? null,
      created_at: currentEngine?.created_at,
    });
    const nextAi: AiAssistPayload = {
      ...current,
      approved_at: new Date().toISOString(),
      approved_by: user?.id ?? null,
    };
    onApplyAiEngine(enginePayload, nextAi);
    // NOTE: do NOT also call onChange(nextAi) here — the parent's
    // onApplyAiEngine already writes ai_assist in the same setSkin call.
    // A second setSkin from onChange would batch with the first and
    // (with a non-functional updater) clobber the freshly-set engine.
    toast.success('Report drafted from AI — preview before sending.');
  };

  const suggestionRows = useMemo(() => {
    return (Object.keys(suggested) as EngineVariableKey[])
      .filter((k) => !!suggested[k])
      .map((k) => ({ key: k, ...suggested[k]! }));
  }, [suggested]);

  return (
    <div className="rounded-md border border-primary/40 bg-primary/[0.03] p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">AI-Assisted Image Analysis</span>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">beta</Badge>
        </div>
      </div>

      {/* Upload */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex">
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={uploading || uploaded.length >= 4}
            onChange={(e) => { handlePick(e.target.files); e.currentTarget.value = ''; }}
          />
          <Button
            asChild
            type="button"
            size="sm"
            variant="outline"
            disabled={uploading || uploaded.length >= 4}
          >
            <span>
              {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
              Upload image
            </span>
          </Button>
        </label>
        <span className="text-[11px] text-muted-foreground">
          {uploaded.length} / 4 image{uploaded.length === 1 ? '' : 's'} • Camera capture in V2
        </span>
        <Camera className="w-3.5 h-3.5 text-muted-foreground/40" />

        <Button
          type="button"
          size="sm"
          className="ml-auto"
          disabled={analyzing || uploaded.length === 0}
          onClick={handleAnalyze}
        >
          {analyzing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
          {current ? 'Re-analyze' : 'Analyze with AI'}
        </Button>
      </div>

      {uploaded.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {uploaded.map((m) => (
            <span key={m.id} className="text-[10px] rounded bg-primary/10 text-primary px-1.5 py-0.5 border border-primary/20">
              {m.file_name?.slice(0, 24) ?? 'image'}
            </span>
          ))}
        </div>
      )}

      {/* Results */}
      {current && (
        <div className="space-y-3 border-t border-primary/20 pt-3">
          {!usable && (
            <div className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/5 p-2">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <div className="text-[11px] text-destructive">
                <p className="font-semibold">Image not usable</p>
                <p>{current.image_quality?.notes ?? 'Re-upload a clearer, well-lit image or score manually.'}</p>
              </div>
            </div>
          )}

          {suggestionRows.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Suggested scores (0-100)</p>
              <ul className="text-[11px] space-y-1">
                {suggestionRows.map((row) => (
                  <li key={row.key} className="flex items-start justify-between gap-2 rounded border border-border/50 bg-card px-2 py-1">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{ENGINE_VARIABLE_LABEL[row.key]}</p>
                      {row.reasons?.length > 0 && (
                        <p className="text-muted-foreground line-clamp-2">{row.reasons.slice(0, 2).join('; ')}</p>
                      )}
                    </div>
                    <span className="text-primary font-bold text-xs whitespace-nowrap">{row.score}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(current.observations?.length ?? 0) > 0 && (
            <details className="text-[11px]">
              <summary className="cursor-pointer text-muted-foreground">Observations ({current.observations!.length})</summary>
              <ul className="mt-1 list-disc pl-5 space-y-0.5">
                {current.observations!.slice(0, 8).map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </details>
          )}

          {(current.areas_to_mark?.length ?? 0) > 0 && (
            <details className="text-[11px]">
              <summary className="cursor-pointer text-muted-foreground">Areas to mark ({current.areas_to_mark!.length})</summary>
              <ul className="mt-1 space-y-0.5">
                {current.areas_to_mark!.map((a, i) => (
                  <li key={i}><span className="font-semibold">{a.area}:</span> {a.note}</li>
                ))}
              </ul>
            </details>
          )}

          {(current.practitioner_notes?.length ?? 0) > 0 && (
            <details className="text-[11px]">
              <summary className="cursor-pointer text-muted-foreground">Practitioner notes</summary>
              <ul className="mt-1 list-disc pl-5 space-y-0.5">
                {current.practitioner_notes!.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </details>
          )}

          {current.report_ready_summary && (
            <div className="rounded border border-border/50 bg-card p-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Report-ready summary</p>
              <p className="text-[11px] text-foreground">{current.report_ready_summary}</p>
            </div>
          )}

          {current.disclaimer && (
            <p className="text-[10px] text-muted-foreground italic">{current.disclaimer}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              disabled={!usable || suggestionRows.length === 0}
            >
              <Wand2 className="w-3.5 h-3.5 mr-1" />
              Apply AI to report
            </Button>
            {onRefineInEngine && (
              <Button type="button" size="sm" variant="outline" onClick={onRefineInEngine}>
                Refine in engine
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
              Clear AI result
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SkinAnalysisAiPanel;