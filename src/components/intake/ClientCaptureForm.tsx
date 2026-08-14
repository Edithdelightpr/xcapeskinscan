import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import PhoneInput from '@/components/ui/PhoneInput';
import { Shield } from 'lucide-react';
import { AGE_GROUPS, AGE_GROUP_LABELS } from '@/lib/ageGroups';
import { useRealStaff } from '@/hooks/useRealStaff';
import { useAuth } from '@/hooks/useAuth';
import { useCreateRealClient, useMergeClientFields, useRealClients, type RealClient } from '@/hooks/useRealClients';
import { findPotentialDuplicates, hasStrongMatch, type DupeMatch } from '@/lib/clientDedupe';
import DuplicateReviewModal from '@/components/intake/DuplicateReviewModal';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export type CaptureMode = 'walk-in' | 'outreach';

const SOURCE_OPTIONS = [
  { value: 'walk-in', label: 'Walk-In' },
  { value: 'social-media', label: 'Social Media' },
  { value: 'personal-referral', label: 'Personal Referral' },
  { value: 'in-person', label: 'In-Person' },
  { value: 'promo-campaign', label: 'Promo Campaign' },
] as const;

interface Props {
  mode: CaptureMode;
  /** Optional initial value for full name (e.g. coming from search box) */
  initialFullName?: string;
  /** Called once the client row has been created in the database. */
  onCreated: (client: RealClient) => void;
  onCancel?: () => void;
  /** Compact layout for use inside modals. */
  compact?: boolean;
  submitLabel?: string;
  /** When capturing during a live outreach, stamp this outreach id on the
   *  new client row so RLS lets the outreach role read it back after insert. */
  outreachId?: string | null;
}

/**
 * The single canonical "new client" form used everywhere a person enters
 * the system. Keeps the field list, validation, and attribution rules
 * identical across front-desk walk-ins, outreach lead capture, the public
 * booking wizard, and the intake stage.
 */
const ClientCaptureForm = ({
  mode,
  initialFullName,
  onCreated,
  onCancel,
  compact,
  submitLabel,
  outreachId,
}: Props) => {
  const { user } = useAuth();
  const { data: staff = [] } = useRealStaff();
  const createMut = useCreateRealClient();
  const mergeMut = useMergeClientFields();
  const { data: allClients = [] } = useRealClients();

  const sessionStaff = user ? staff.find((s) => s.id === user.id) : null;

  const [form, setForm] = useState({
    full_name: initialFullName ?? '',
    phone: '',
    email: '',
    gender: '',
    location: '',
    age_group: '',
  });
  const [source, setSource] = useState<string>(mode === 'outreach' ? 'outreach' : 'walk-in');
  const [attributedStaffId, setAttributedStaffId] = useState<string>(
    mode === 'outreach' ? '' : sessionStaff?.id || '',
  );
  const [error, setError] = useState('');
  const [dupeMatches, setDupeMatches] = useState<DupeMatch[]>([]);
  const [dupeOpen, setDupeOpen] = useState(false);

  // Keep attribution defaults in sync with mode + session.
  useEffect(() => {
    if (mode === 'outreach') setAttributedStaffId('');
    else if (sessionStaff?.id && !attributedStaffId) setAttributedStaffId(sessionStaff.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sessionStaff?.id]);

  const buildPayload = () => ({
    full_name: form.full_name.trim(),
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
        gender: (mode === 'walk-in' || mode === 'outreach') ? (form.gender || null) : null,
    location: mode === 'walk-in' ? (form.location || null) : null,
    age_group: mode === 'walk-in' ? (form.age_group || null) : null,
    source_type: mode === 'outreach' ? 'outreach' : source,
    attributed_staff_id:
      mode === 'outreach'
        ? (user?.id ?? null)
        : (attributedStaffId || user?.id || null),
    outreach_id: mode === 'outreach' ? (outreachId ?? null) : null,
    status: 'lead' as const,
  });

  const performInsert = async () => {
    try {
      const created = await createMut.mutateAsync(buildPayload());
      toast.success(mode === 'outreach' ? 'Lead saved to outreach pool' : 'Client saved');
      onCreated(created);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save client';
      // Catch the DB unique-index violation as a friendly message.
      if (/clients_phone_norm_unique|clients_email_lower_unique|duplicate key/i.test(msg)) {
        toast.error('A client with that phone or email is already on file.');
        // Re-run check so the modal opens with the offender.
        const matches = await findPotentialDuplicates({
          full_name: form.full_name, phone: form.phone, email: form.email,
        });
        if (matches.length) { setDupeMatches(matches); setDupeOpen(true); return; }
      }
      setError(msg);
    }
  };

  const handleSave = async () => {
    setError('');
    if (!form.full_name.trim()) {
      setError('Name is required');
      return;
    }
    // Run dedupe BEFORE inserting. If anything matches, open the review modal.
    const matches = await findPotentialDuplicates({
      full_name: form.full_name, phone: form.phone, email: form.email,
    });
    if (matches.length > 0) {
      setDupeMatches(matches);
      setDupeOpen(true);
      // If strong match (phone/email) — block silent insert; user must choose.
      if (hasStrongMatch(matches)) return;
      return;
    }
    await performInsert();
  };

  const handleReuseExisting = async (clientId: string) => {
    const match = dupeMatches.find((m) => m.client.id === clientId);
    // Cross-operator identity: the record belongs to another partner, so we
    // attach to the same permanent person via the secure RPC instead of
    // merging fields we are not allowed to overwrite.
    if (match?.crossOperator) {
      try {
        const { data, error: rpcError } = await supabase.rpc('xcape_reuse_client', {
          _client_id: clientId,
          _phone: form.phone.trim(),
        });
        if (rpcError) throw rpcError;
        const existing = data as unknown as RealClient | null;
        if (!existing) throw new Error('Could not load that client');
        toast.success(`Continuing with existing record for ${existing.full_name}`);
        setDupeOpen(false);
        onCreated(existing);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not link to existing client');
      }
      return;
    }
    try {
      const merged = await mergeMut.mutateAsync({ id: clientId, candidate: buildPayload() });
      const existing = allClients.find((c) => c.id === clientId) ?? merged;
      toast.success(`Reusing existing record for ${existing.full_name}`);
      setDupeOpen(false);
      onCreated(merged);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not link to existing client');
    }
  };

  const handleConfirmCreateNew = async () => {
    setDupeOpen(false);
    await performInsert();
  };

  const wrapperClass = compact
    ? 'space-y-4'
    : 'glass rounded-xl p-6 space-y-4';

  return (
    <div className={wrapperClass}>
      {mode === 'walk-in' && sessionStaff && !compact && (
        <div className="flex items-start gap-3 rounded-lg bg-primary/10 border border-primary/30 p-3">
          <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="text-xs">
            <p className="text-foreground font-medium">Auto-attribution active</p>
            <p className="text-muted-foreground mt-0.5">
              Captured under{' '}
              <span className="text-foreground">
                {sessionStaff.full_name || sessionStaff.email}
              </span>
              's session. Override below if needed.
            </p>
          </div>
        </div>
      )}

      {mode === 'outreach' && !compact && (
        <div className="rounded-lg bg-surface/60 border border-border/40 p-3 text-xs text-muted-foreground">
          Outreach leads are credited to the <span className="text-foreground">house</span>,
          not to any individual staff. Use the Walk-In flow at the front desk if you want
          attribution.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Full name *
          </Label>
          <Input
            className="bg-surface border-border/60"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder="Full Name"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Phone {mode === 'outreach' && <span className="text-muted-foreground/70 normal-case tracking-normal">(recommended)</span>}
          </Label>
          <PhoneInput
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v })}
          />
          {mode === 'outreach' && !form.phone.trim() && !form.email.trim() && (
            <p className="text-[11px] text-muted-foreground/80">
              A phone number makes follow-up much easier — but you can save with just a name.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
          <Input
            className="bg-surface border-border/60"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="name@example.com"
          />
        </div>

        {(mode === 'walk-in' || mode === 'outreach') && (
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Gender</Label>
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground"
            >
              <option value="">— Select —</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
        )}

        {mode === 'walk-in' && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Location</Label>
              <Input
                className="bg-surface border-border/60"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Age group</Label>
              <select
                value={form.age_group}
                onChange={(e) => setForm({ ...form, age_group: e.target.value })}
                className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground"
              >
                <option value="">— Prefer not to say —</option>
                {AGE_GROUPS.map((g) => (
                  <option key={g} value={g}>{AGE_GROUP_LABELS[g]}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {mode === 'walk-in' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/30">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Lead source</Label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground"
            >
              {SOURCE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Attributed staff
            </Label>
            <select
              value={attributedStaffId}
              onChange={(e) => setAttributedStaffId(e.target.value)}
              className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground"
            >
              <option value="">— House (unassigned) —</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={createMut.isPending}>
            Cancel
          </Button>
        )}
        <Button onClick={handleSave} disabled={createMut.isPending || mergeMut.isPending} className="glow-primary">
          {createMut.isPending || mergeMut.isPending ? 'Saving…' : (submitLabel ?? 'Save Client')}
        </Button>
      </div>

      <DuplicateReviewModal
        open={dupeOpen}
        onOpenChange={setDupeOpen}
        matches={dupeMatches}
        attempted={{ full_name: form.full_name, phone: form.phone, email: form.email }}
        onReuse={handleReuseExisting}
        onCreateNew={handleConfirmCreateNew}
      />
    </div>
  );
};

export default ClientCaptureForm;