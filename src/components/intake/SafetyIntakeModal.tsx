import { useState } from 'react';
import { X, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useCreateSafetyIntake, type SafetyIntake } from '@/hooks/useSafetyIntakes';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  onSaved: (intake: SafetyIntake) => void;
}

const PREGNANCY_OPTIONS = [
  { v: 'no', label: 'No' },
  { v: 'yes', label: 'Yes' },
  { v: 'unsure', label: 'Unsure' },
  { v: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const ALLERGY_CHIPS = ['Latex', 'Fragrance', 'Lidocaine', 'Hydroquinone', 'Salicylates', 'Nickel'];

const SafetyIntakeModal = ({ open, onClose, clientId, clientName, onSaved }: Props) => {
  const { user, profile } = useAuth();
  const createMut = useCreateSafetyIntake();

  const [pregnant, setPregnant] = useState('no');
  const [breastfeeding, setBreastfeeding] = useState(false);
  const [allergies, setAllergies] = useState('');
  const [meds, setMeds] = useState('');
  const [skinConditions, setSkinConditions] = useState('');
  const [recentProcedures, setRecentProcedures] = useState('');
  const [treatmentConsent, setTreatmentConsent] = useState(false);
  const [photoConsent, setPhotoConsent] = useState(true);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [signature, setSignature] = useState('');
  const [notes, setNotes] = useState('');

  if (!open) return null;

  const toggleChip = (chip: string) => {
    if (allergies.toLowerCase().includes(chip.toLowerCase())) return;
    setAllergies(allergies ? `${allergies}, ${chip}` : chip);
  };

  const handleSave = async () => {
    if (!treatmentConsent) {
      toast.error('Treatment consent is required to proceed.');
      return;
    }
    if (!signature.trim()) {
      toast.error("Please type the client's name as acknowledgement.");
      return;
    }
    try {
      const created = await createMut.mutateAsync({
        client_id: clientId,
        collected_by_staff_id: user?.id ?? null,
        is_pregnant: pregnant,
        is_breastfeeding: breastfeeding,
        allergies: allergies.trim() || null,
        current_medications: meds.trim() || null,
        active_skin_conditions: skinConditions.trim() || null,
        recent_procedures: recentProcedures.trim() || null,
        treatment_consent: treatmentConsent,
        photo_consent_internal: photoConsent,
        marketing_image_consent: marketingConsent,
        acknowledged_signature: signature.trim(),
        notes: notes.trim() || null,
      });
      toast.success('Intake saved · client converted');
      onSaved(created);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save intake');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="glass-strong rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary" /> Safety & Consent Intake
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              For <span className="text-foreground">{clientName}</span> · collected by{' '}
              {profile?.full_name ?? user?.email ?? 'staff'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-surface text-muted-foreground"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pregnancy */}
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Pregnant?</Label>
          <div className="flex flex-wrap gap-1.5">
            {PREGNANCY_OPTIONS.map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setPregnant(o.v)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs border transition-colors',
                  pregnant === o.v
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-surface/60 text-muted-foreground border-border/40 hover:text-foreground',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Breastfeeding */}
        <div className="flex items-center justify-between rounded-lg border border-border/40 bg-surface/30 px-3 py-2">
          <Label className="text-sm text-foreground">Currently breastfeeding</Label>
          <Switch checked={breastfeeding} onCheckedChange={setBreastfeeding} />
        </div>

        {/* Allergies */}
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Allergies</Label>
          <Input
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            placeholder="List any known allergies"
          />
          <div className="flex flex-wrap gap-1.5">
            {ALLERGY_CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleChip(c)}
                className="px-2 py-0.5 rounded-full text-[11px] bg-surface/80 text-muted-foreground hover:text-foreground border border-border/40"
              >
                + {c}
              </button>
            ))}
          </div>
        </div>

        {/* Meds */}
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Current medications</Label>
          <Input
            value={meds}
            onChange={(e) => setMeds(e.target.value)}
            placeholder="e.g. Accutane, blood thinners…"
          />
        </div>

        {/* Skin conditions */}
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Active skin conditions</Label>
          <Input
            value={skinConditions}
            onChange={(e) => setSkinConditions(e.target.value)}
            placeholder="Eczema, active acne, cold sores…"
          />
        </div>

        {/* Recent procedures */}
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Recent procedures (last 30 days)</Label>
          <Input
            value={recentProcedures}
            onChange={(e) => setRecentProcedures(e.target.value)}
            placeholder="Peels, lasers, injectables…"
          />
        </div>

        {/* Consents */}
        <div className="space-y-2 pt-1">
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={treatmentConsent}
              onChange={(e) => setTreatmentConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input"
            />
            <span className="text-foreground">
              Client consents to treatment and confirms info above is accurate.{' '}
              <span className="text-destructive">*</span>
            </span>
          </label>
          <div className="flex items-center justify-between rounded-lg border border-border/40 bg-surface/30 px-3 py-2">
            <Label className="text-sm text-foreground">Photo consent (internal records)</Label>
            <Switch checked={photoConsent} onCheckedChange={setPhotoConsent} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/40 bg-surface/30 px-3 py-2">
            <Label className="text-sm text-foreground">Marketing image consent</Label>
            <Switch checked={marketingConsent} onCheckedChange={setMarketingConsent} />
          </div>
        </div>

        {/* Signature */}
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Signature (type client name) <span className="text-destructive">*</span>
          </Label>
          <Input
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder={clientName}
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes (optional)</Label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-surface border border-border/60 rounded-md px-3 py-2 text-sm text-foreground resize-none"
            placeholder="Anything else worth noting…"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={createMut.isPending} className="glow-primary">
            {createMut.isPending ? 'Saving…' : 'Save & Convert'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SafetyIntakeModal;
