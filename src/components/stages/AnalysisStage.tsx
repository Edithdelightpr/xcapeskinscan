import { useState, useMemo, useRef } from 'react';
import { useAppStore } from '@/store/appStore';
import { useRealClient, useUpdateRealClient } from '@/hooks/useRealClients';
import { useCurrentClientId } from '@/hooks/useCurrentClientId';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import type { Json } from '@/integrations/supabase/types';
import { useClientMedia, useUploadClientMedia } from '@/hooks/useClientMedia';
import { toast } from 'sonner';
import { Upload, Loader2 } from 'lucide-react';

const skinTypes = ['Normal', 'Oily', 'Dry', 'Combination', 'Sensitive'];
const severities = ['None', 'Mild', 'Moderate', 'Severe'];
const sensitivities = ['Low', 'Medium', 'High'];
const barriers = ['Weak', 'Normal', 'Strong'];

const AnalysisStage = () => {
  const { completeStage, setActiveStage } = useAppStore();
  const [currentId] = useCurrentClientId();
  const { data: client, isLoading } = useRealClient(currentId ?? undefined);
  const updateMut = useUpdateRealClient();
  const assessmentIdRef = useRef<string | null>(null);

  const getAssessmentId = (clientId: string) => {
    if (assessmentIdRef.current) return assessmentIdRef.current;
    const key = `tropics:assessment:${clientId}`;
    let id = sessionStorage.getItem(key);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(key, id);
    }
    assessmentIdRef.current = id;
    return id;
  };

  const assessmentId = currentId ? getAssessmentId(currentId) : undefined;
  const { data: media = [] } = useClientMedia(currentId ?? undefined, { assessmentId });
  const uploadMut = useUploadClientMedia();

  const [data, setData] = useState({
    skinType: 'Combination',
    oiliness: 60,
    hydration: 40,
    hyperpigmentation: 55,
    acneSeverity: 'Mild',
    sensitivity: 'Medium',
    barrierStrength: 'Normal',
    notes: '',
  });

  const liveSummary = useMemo(() => {
    const concerns: string[] = [];
    if (data.oiliness > 60) concerns.push('Excess Oil');
    if (data.hydration < 40) concerns.push('Dehydration');
    if (data.hyperpigmentation > 40) concerns.push('Hyperpigmentation');
    if (data.acneSeverity !== 'None') concerns.push(`Acne (${data.acneSeverity})`);
    if (data.sensitivity === 'High') concerns.push('High Sensitivity');
    if (data.barrierStrength === 'Weak') concerns.push('Weak Barrier');

    const severity = data.hyperpigmentation > 70 || data.acneSeverity === 'Severe' ? 'High'
      : data.hyperpigmentation > 40 || data.acneSeverity === 'Moderate' ? 'Moderate' : 'Low';

    const direction = concerns.length > 3
      ? 'Multi-concern protocol with phased approach'
      : concerns.includes('Hyperpigmentation')
      ? 'Brightening + barrier repair focus'
      : concerns.includes('Excess Oil')
      ? 'Oil control + deep cleansing protocol'
      : 'Hydration + maintenance protocol';

    return { concerns, severity, direction };
  }, [data]);

  const handleSave = () => {
    if (!client) return;
    const aid = getAssessmentId(client.id);
    const analysis = ({
      ...data,
      primaryConcerns: liveSummary.concerns,
      severityLevel: liveSummary.severity,
      suggestedDirection: liveSummary.direction,
      assessment_id: aid,
    } as unknown) as Json;
    updateMut.mutate(
      { id: client.id, patch: { skin_analysis: analysis, status: 'contacted' } },
      {
        onSuccess: () => {
          completeStage(1);
          setActiveStage(2);
        },
      }
    );
  };

  if (isLoading) return <p className="text-muted-foreground">Loading client…</p>;
  if (!client) return <p className="text-muted-foreground">Please select a client first.</p>;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !client) return;
    const aid = getAssessmentId(client.id);
    try {
      await uploadMut.mutateAsync({
        clientId: client.id,
        file,
        category: 'before',
        assessmentId: aid,
      });
      toast.success('Image uploaded to client record');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  return (
    <div className="animate-slide-up space-y-6">
      <h2 className="text-2xl font-display font-bold text-foreground">Skin Analysis</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Client card */}
        <div className="glass rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">Client</h3>
          <p className="text-lg font-display font-semibold text-foreground">{client.full_name}</p>
          <p className="text-sm text-muted-foreground">{client.email ?? '—'}</p>
          <p className="text-sm text-muted-foreground">{client.location ?? '—'}</p>
          <div className="pt-3 border-t border-border/40">
            <p className="text-xs text-muted-foreground">Gender: {client.gender || 'N/A'}</p>
            <p className="text-xs text-muted-foreground">Phone: {client.phone ?? '—'}</p>
          </div>
        </div>

        {/* Center: Analysis form */}
        <div className="glass rounded-xl p-5 space-y-5">
          <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">Analysis Inputs</h3>
          
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Skin Type</Label>
            <div className="flex flex-wrap gap-2">
              {skinTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => setData({ ...data, skinType: t })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    data.skinType === t ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {[
            { label: 'Oiliness', key: 'oiliness' as const },
            { label: 'Hydration', key: 'hydration' as const },
            { label: 'Hyperpigmentation', key: 'hyperpigmentation' as const },
          ].map(({ label, key }) => (
            <div key={key} className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <span className="text-xs font-mono text-foreground">{data[key]}%</span>
              </div>
              <Slider
                value={[data[key]]}
                onValueChange={([v]) => setData({ ...data, [key]: v })}
                max={100}
                step={1}
                className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-0"
              />
            </div>
          ))}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Acne Severity</Label>
            <div className="flex gap-2">
              {severities.map((s) => (
                <button key={s} onClick={() => setData({ ...data, acneSeverity: s })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${data.acneSeverity === s ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Sensitivity</Label>
            <div className="flex gap-2">
              {sensitivities.map((s) => (
                <button key={s} onClick={() => setData({ ...data, sensitivity: s })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${data.sensitivity === s ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Barrier Strength</Label>
            <div className="flex gap-2">
              {barriers.map((b) => (
                <button key={b} onClick={() => setData({ ...data, barrierStrength: b })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${data.barrierStrength === b ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground'}`}>
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea
              className="bg-surface border-border/60 min-h-[60px]"
              value={data.notes}
              onChange={(e) => setData({ ...data, notes: e.target.value })}
              placeholder="Additional observations..."
            />
          </div>

          <div className="pt-2 border-t border-border/30 space-y-2">
            <Label className="text-xs text-muted-foreground">Image Upload</Label>
            <label className="mt-2 flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-border/40 hover:border-primary/60 rounded-lg p-6 text-center text-muted-foreground text-xs transition-colors">
              {uploadMut.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mb-2 animate-spin text-primary" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mb-2 text-primary" />
                  Click to upload (saved to client record)
                </>
              )}
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFile}
                disabled={uploadMut.isPending}
              />
            </label>
            {media.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {media.length} file{media.length === 1 ? '' : 's'} on record
              </p>
            )}
          </div>
        </div>

        {/* Right: Live summary */}
        <div className="glass rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">Live Summary</h3>
          
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Primary Concerns</p>
              <div className="flex flex-wrap gap-1.5">
                {liveSummary.concerns.length > 0 ? liveSummary.concerns.map((c) => (
                  <span key={c} className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary">
                    {c}
                  </span>
                )) : <span className="text-xs text-muted-foreground">None detected</span>}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Severity Level</p>
              <span className={`text-sm font-semibold ${
                liveSummary.severity === 'High' ? 'text-destructive' :
                liveSummary.severity === 'Moderate' ? 'text-accent-foreground' : 'text-primary'
              }`}>
                {liveSummary.severity}
              </span>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Suggested Direction</p>
              <p className="text-sm text-foreground font-medium">{liveSummary.direction}</p>
            </div>
          </div>

          <Button onClick={handleSave} disabled={updateMut.isPending} className="w-full glow-primary mt-4">
            {updateMut.isPending ? 'Saving to cloud…' : 'Save Analysis & Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AnalysisStage;
