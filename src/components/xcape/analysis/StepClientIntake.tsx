import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, ShieldAlert, UserPlus } from 'lucide-react';
import ClientSearchPicker from '@/components/admin/ClientSearchPicker';
import SafetyIntakeModal from '@/components/intake/SafetyIntakeModal';
import { useClientSafetyIntakes } from '@/hooks/useSafetyIntakes';
import { useCreateRealClient, type RealClient } from '@/hooks/useRealClients';
import { useReferralSlug } from '@/hooks/useReferralSlug';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PhoneInput from '@/components/ui/PhoneInput';
import { isValidE164 } from '@/lib/phone';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  client: RealClient | null;
  onPick: (id: string) => void;
}

interface Chip {
  label: string;
  tone: 'warn' | 'info';
}

/**
 * Step 1 — Client & Intake. Reuses the existing client records (no parallel
 * client storage) and the existing safety & consent intake. Clinical context
 * (allergies, medication, pregnancy/breastfeeding, conditions, procedures,
 * keloid tendency, sun exposure, routine, skin type, consent) is summarised
 * here so it informs the whole analysis journey.
 */
const StepClientIntake = ({ client, onPick }: Props) => {
  const { user } = useAuth();
  const { slug: referralSlug, utm } = useReferralSlug();
  const [createMode, setCreateMode] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', location: '' });
  const createMut = useCreateRealClient();
  const [intakeOpen, setIntakeOpen] = useState(false);
  const { data: intakes = [] } = useClientSafetyIntakes(client?.id);
  const latest = intakes[0] ?? null;

  const handleCreate = async () => {
    const fullName = form.full_name.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();
    if (!fullName) {
      toast.error('Client name is required');
      return;
    }
    if (phone && !isValidE164(phone)) {
      toast.error('Enter a valid phone number', {
        description: 'Pick the country code, then type the number without the leading 0.',
      });
      return;
    }
    if (email && !EMAIL_RE.test(email)) {
      toast.error('Enter a valid email address', {
        description: 'Example: name@example.com',
      });
      return;
    }
    try {
      const created = await createMut.mutateAsync({
        full_name: fullName,
        phone: phone || null,
        email: email || null,
        location: form.location.trim() || null,
        // Attribution: mark wizard capture and preserve any referral context
        // that accompanied the practitioner into the analysis flow.
        source_type: referralSlug ? 'referral' : 'xcape_wizard',
        captured_via: 'xcape_wizard',
        referral_meta: referralSlug
          ? { slug: referralSlug, ...utm }
          : (Object.keys(utm).length > 0 ? { ...utm } : null),
        attributed_staff_id: user?.id ?? null,
        status: 'lead',
      });
      toast.success(`Client ${created.full_name} created`);
      onPick(created.id);
      setCreateMode(false);
      setForm({ full_name: '', phone: '', email: '', location: '' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create client');
    }
  };

  const chips: Chip[] = [];
  if (latest) {
    if (latest.allergies) chips.push({ label: `Allergies: ${latest.allergies}`, tone: 'warn' });
    if (latest.current_medications) chips.push({ label: `Medication: ${latest.current_medications}`, tone: 'warn' });
    if (latest.active_skin_conditions) chips.push({ label: `Conditions: ${latest.active_skin_conditions}`, tone: 'warn' });
    if (latest.recent_procedures) chips.push({ label: `Recent procedures: ${latest.recent_procedures}`, tone: 'info' });
    if (latest.is_pregnant && latest.is_pregnant !== 'no') chips.push({ label: `Pregnancy: ${latest.is_pregnant.replace(/_/g, ' ')}`, tone: 'warn' });
    if (latest.is_breastfeeding) chips.push({ label: 'Breastfeeding', tone: 'warn' });
    if (latest.keloid_tendency) chips.push({ label: 'Keloid tendency', tone: 'warn' });
    if (latest.recent_sun_exposure) chips.push({ label: 'Recent sun exposure', tone: 'info' });
    if (latest.skin_type_fitzpatrick) chips.push({ label: `Skin type: ${latest.skin_type_fitzpatrick}`, tone: 'info' });
    if (latest.current_skincare_routine) chips.push({ label: `Routine: ${latest.current_skincare_routine}`, tone: 'info' });
  }

  return (
    <div className="space-y-5">
      {/* Client selection */}
      <section className="glass rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Select client</h2>
          <Button
            type="button"
            variant={createMode ? 'ghost' : 'outline'}
            size="sm"
            className="text-xs"
            onClick={() => setCreateMode((v) => !v)}
          >
            <UserPlus className="w-3.5 h-3.5 mr-1.5" />
            {createMode ? 'Search existing' : 'New client'}
          </Button>
        </div>

        {createMode ? (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="xc-name" className="text-xs">Full name *</Label>
                <Input
                  id="xc-name"
                  value={form.full_name}
                  maxLength={100}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="bg-surface border-border/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="xc-phone" className="text-xs">Phone</Label>
                <PhoneInput
                  id="xc-phone"
                  value={form.phone}
                  onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                  inputClassName="bg-surface border-border/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="xc-email" className="text-xs">Email</Label>
                <Input
                  id="xc-email"
                  type="email"
                  value={form.email}
                  maxLength={255}
                  placeholder="name@example.com"
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="bg-surface border-border/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="xc-location" className="text-xs">Location</Label>
                <Input
                  id="xc-location"
                  value={form.location}
                  maxLength={120}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className="bg-surface border-border/60"
                />
              </div>
            </div>
            <Button onClick={handleCreate} disabled={createMut.isPending} className="bg-primary text-primary-foreground">
              {createMut.isPending ? 'Creating…' : 'Create & select client'}
            </Button>
          </div>
        ) : (
          <ClientSearchPicker value={client?.id ?? null} onChange={(id) => onPick(id)} />
        )}
      </section>

      {/* Clinical intake */}
      {client && (
        <section className="glass rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-primary" /> Safety &amp; consent intake
            </h2>
            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setIntakeOpen(true)}>
              {latest ? 'Update intake' : 'Record intake'}
            </Button>
          </div>

          {latest ? (
            <div className="space-y-3">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                {latest.treatment_consent ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Consent recorded {new Date(latest.collected_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    {latest.photo_consent_internal ? ' · photo consent given' : ' · no photo consent'}
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Intake on file without treatment consent — update before treatment recommendations.
                  </>
                )}
              </p>
              {chips.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {chips.map((c) => (
                    <Badge
                      key={c.label}
                      variant="outline"
                      className={
                        c.tone === 'warn'
                          ? 'text-[10px] border-amber-500/40 text-amber-800 bg-amber-500/10'
                          : 'text-[10px] border-border/50 text-muted-foreground'
                      }
                    >
                      {c.label}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
              No safety intake on record for {client.full_name}. Record allergies, medication,
              pregnancy/breastfeeding status, active conditions, recent procedures and consent
              before generating a report.
            </p>
          )}
        </section>
      )}

      {intakeOpen && client && (
        <SafetyIntakeModal
          open={intakeOpen}
          onClose={() => setIntakeOpen(false)}
          clientId={client.id}
          clientName={client.full_name}
          onSaved={() => setIntakeOpen(false)}
        />
      )}
    </div>
  );
};

export default StepClientIntake;
