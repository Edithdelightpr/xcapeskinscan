import { useState, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Camera, FolderOpen, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateRealClient, type RealClient } from '@/hooks/useRealClients';
import { useUploadClientMedia, type ClientMediaCategory } from '@/hooks/useClientMedia';
import { useServices } from '@/hooks/useServices';
import { useServiceCategories, groupServicesByCategory } from '@/hooks/useServiceCategories';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

type Outcome = 'completed' | 'completed_adjusted' | 'partial_followup';
type PhotoTag = Extract<ClientMediaCategory, 'before' | 'after' | 'treatment'>;

interface Appointment {
  id: string;
  treatment: string;
  time: string;
  date: string;
  notes?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  client: RealClient | null;
}

const OUTCOME_LABEL: Record<Outcome, string> = {
  completed: 'Completed as planned',
  completed_adjusted: 'Completed with adjustments',
  partial_followup: 'Partially done — follow-up needed',
};

const FOLLOWUP_OPTIONS = ['', '1 week', '2 weeks', '3 weeks', '4 weeks', '6 weeks', '8 weeks', '12 weeks'];

const LogTreatmentModal = ({ open, onClose, appointment, client }: Props) => {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const updateClient = useUpdateRealClient();
  const uploadMedia = useUploadClientMedia();
  const { data: services = [] } = useServices({ activeOnly: true });
  const { data: categories = [] } = useServiceCategories({ activeOnly: true });

  const [treatmentName, setTreatmentName] = useState<string>('');
  const [outcome, setOutcome] = useState<Outcome>('completed');
  const [notes, setNotes] = useState('');
  const [followup, setFollowup] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [photoTag, setPhotoTag] = useState<PhotoTag>('after');
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Re-init when modal opens
  useMemo(() => {
    if (open && appointment) {
      setTreatmentName(appointment.treatment ?? '');
      setOutcome('completed');
      setNotes('');
      setFollowup('');
      setFile(null);
      setPhotoTag('after');
    }
  }, [open, appointment]);

  if (!appointment || !client) return null;

  const handleSubmit = async () => {
    if (!treatmentName.trim()) {
      toast.error('Choose the treatment performed');
      return;
    }
    setSubmitting(true);
    try {
      let photoMediaId: string | null = null;

      // 1. Upload photo if attached
      if (file) {
        const media = await uploadMedia.mutateAsync({
          clientId: client.id,
          file,
          category: photoTag,
          caption: `Treatment log · ${treatmentName} · ${appointment.date}`,
        });
        photoMediaId = media.id;
      }

      // 2. Append to treatment_plan.history
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingPlan = (client.treatment_plan as any) ?? {};
      const history = Array.isArray(existingPlan.history) ? existingPlan.history : [];
      const entry = {
        id: crypto.randomUUID(),
        appointment_id: appointment.id,
        treatment: treatmentName,
        outcome,
        notes: notes.trim() || null,
        recommended_followup: followup || null,
        performed_by: user?.id ?? null,
        performed_by_name: profile?.full_name ?? null,
        performed_at: new Date().toISOString(),
        photo_media_id: photoMediaId,
      };
      const nextPlan = { ...existingPlan, history: [...history, entry] };

      await updateClient.mutateAsync({
        id: client.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        patch: { treatment_plan: nextPlan as any },
      });

      // 3. Mark appointment as completed and append notes
      const noteSummary = `[${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}] ${OUTCOME_LABEL[outcome]}${notes.trim() ? ` — ${notes.trim()}` : ''}${followup ? ` · Follow-up in ${followup}` : ''}`;
      const mergedNotes = appointment.notes ? `${appointment.notes}\n${noteSummary}` : noteSummary;
      const { error: apptErr } = await supabase
        .from('appointments')
        .update({ status: 'completed', notes: mergedNotes })
        .eq('id', appointment.id);
      if (apptErr) throw apptErr;

      qc.invalidateQueries({ queryKey: ['real-appointments'] });
      qc.invalidateQueries({ queryKey: ['client-media', client.id] });

      toast.success(`Treatment logged for ${client.full_name}`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to log treatment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Log treatment — {client.full_name}</DialogTitle>
          <DialogDescription>
            {appointment.treatment} · {appointment.time} appointment{client.client_code ? ` · ${client.client_code}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Treatment performed */}
          <div className="space-y-1.5">
            <Label>Treatment performed</Label>
            <Select value={treatmentName} onValueChange={setTreatmentName}>
              <SelectTrigger><SelectValue placeholder="Select treatment" /></SelectTrigger>
              <SelectContent>
                {/* Ensure the booked treatment is always selectable even if not in the catalog */}
                {!services.some((s) => s.name === appointment.treatment) && appointment.treatment && (
                  <SelectItem value={appointment.treatment}>{appointment.treatment}</SelectItem>
                )}
                {groupServicesByCategory(services, categories)
                  .filter((g) => g.services.length > 0)
                  .map(({ category, services: variants }) => (
                    <SelectGroup key={category.id}>
                      <SelectLabel>{category.name}</SelectLabel>
                      {variants.map((s) => (
                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Outcome */}
          <div className="space-y-2">
            <Label>Outcome</Label>
            <RadioGroup value={outcome} onValueChange={(v) => setOutcome(v as Outcome)} className="space-y-1.5">
              {(Object.keys(OUTCOME_LABEL) as Outcome[]).map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <RadioGroupItem value={k} id={`outcome-${k}`} />
                  <Label htmlFor={`outcome-${k}`} className="font-normal cursor-pointer">{OUTCOME_LABEL[k]}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="treat-notes">Practitioner notes</Label>
            <Textarea
              id="treat-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Skin response, products used, observations…"
              rows={4}
            />
          </div>

          {/* Photo */}
          <div className="space-y-2">
            <Label>Add a photo (optional)</Label>
            <div className="flex gap-2 flex-wrap">
              <Button type="button" variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()}>
                <Camera className="w-4 h-4 mr-1.5" /> Take photo
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <FolderOpen className="w-4 h-4 mr-1.5" /> Choose file
              </Button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {file && (
              <div className="flex items-center justify-between gap-2 rounded-md bg-surface/60 border border-border/30 px-3 py-2">
                <span className="text-xs text-foreground truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Remove photo"
                ><X className="w-4 h-4" /></button>
              </div>
            )}
            {file && (
              <RadioGroup value={photoTag} onValueChange={(v) => setPhotoTag(v as PhotoTag)} className="flex gap-4 pt-1">
                {(['before', 'after', 'treatment'] as PhotoTag[]).map((t) => (
                  <div key={t} className="flex items-center gap-1.5">
                    <RadioGroupItem value={t} id={`tag-${t}`} />
                    <Label htmlFor={`tag-${t}`} className="font-normal text-xs capitalize cursor-pointer">{t}</Label>
                  </div>
                ))}
              </RadioGroup>
            )}
          </div>

          {/* Follow-up */}
          <div className="space-y-1.5">
            <Label>Recommended next visit (optional)</Label>
            <Select value={followup || '__none'} onValueChange={(v) => setFollowup(v === '__none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="No recommendation" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No recommendation</SelectItem>
                {FOLLOWUP_OPTIONS.filter(Boolean).map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border/30">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="glow-primary">
            {submitting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            {submitting ? 'Saving…' : 'Save treatment log'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LogTreatmentModal;