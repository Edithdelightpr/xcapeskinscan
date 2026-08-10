import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import type { VisitAssessment } from '@/hooks/useVisitAssessments';
import { useServices } from '@/hooks/useServices';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import { resolveServicePrice, formatNaira } from '@/lib/serviceDiscount';

type Rec = {
  service_id?: string;
  name?: string;
  price?: number;
  sessions?: number;
  status?: string;
};

type LineState = {
  service_id: string;
  name: string;
  catalogue_price: number;
  recommended_sessions: number;
  selected: boolean;
  accepted_sessions: number;
  agreed_unit_price: string; // blank = use catalogue
  system_discount_label: string | null;
  system_discount_amount: number; // per session
};

const AcceptTreatmentPlanDialog = ({
  open,
  onClose,
  assessment,
  onAccepted,
}: {
  open: boolean;
  onClose: () => void;
  assessment: VisitAssessment;
  /** Fired after `accept_treatment_plan` succeeds. The Visit Log uses this to
   *  stamp accepted-product snapshots and close its own modal state. */
  onAccepted?: (result: { plan_id: string }) => void | Promise<void>;
}) => {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const { data: services = [], isLoading: servicesLoading } = useServices({ activeOnly: false });
  const { data: categories = [], isLoading: categoriesLoading } = useServiceCategories({ activeOnly: false });
  const pricingLoading = servicesLoading || categoriesLoading;

  const initialLines = useMemo<LineState[]>(() => {
    const recs = (assessment.recommended_services ?? []) as Rec[];
    return recs
      .filter((r) => !!r.service_id)
      .filter((r) => r.status === 'accepted')
      .map((r) => {
        const svc = services.find((s) => s.id === r.service_id);
        const cat = svc ? categories.find((c) => c.id === svc.category_id) : null;
        // Prefer the live service price as catalogue; fall back to whatever
        // was recorded on the recommendation.
        const basePrice = Number(svc?.price_per_session ?? r.price ?? 0);
        const resolved = svc
          ? resolveServicePrice({ ...svc, price_per_session: basePrice }, cat ?? null)
          : { basePrice, finalPrice: basePrice, discount: null as null | { label: string | null; amount: number } };
        const hasDiscount = !!resolved.discount && resolved.finalPrice < resolved.basePrice;
        return {
          service_id: r.service_id as string,
          name: r.name ?? svc?.name ?? 'Service',
          catalogue_price: resolved.basePrice,
          recommended_sessions: Math.max(1, Number(r.sessions ?? 1)),
          selected: true,
          accepted_sessions: Math.max(1, Number(r.sessions ?? 1)),
          // Pre-fill agreed price with the system-discounted price so savings
          // flow all the way through to the sign-out receipt.
          agreed_unit_price: hasDiscount ? String(resolved.finalPrice) : '',
          system_discount_label: hasDiscount ? (resolved.discount?.label ?? 'Menu discount') : null,
          system_discount_amount: hasDiscount ? (resolved.basePrice - resolved.finalPrice) : 0,
        };
      });
  }, [assessment, services, categories]);

  const [lines, setLines] = useState<LineState[]>([]);
  const [seedKey, setSeedKey] = useState('');
  const [userEdited, setUserEdited] = useState(false);

  const nextSeedKey = useMemo(
    () => [
      assessment.id,
      pricingLoading ? 'loading' : 'ready',
      initialLines.map((l) => [
        l.service_id,
        l.catalogue_price,
        l.agreed_unit_price,
        l.system_discount_amount,
        l.accepted_sessions,
      ].join(':')).join('|'),
    ].join('::'),
    [assessment.id, initialLines, pricingLoading],
  );

  useEffect(() => {
    if (!open) {
      setLines([]);
      setSeedKey('');
      setUserEdited(false);
      setNotes('');
      return;
    }

    if ((lines.length === 0 || !userEdited) && seedKey !== nextSeedKey) {
      setLines(initialLines);
      setSeedKey(nextSeedKey);
    }
  }, [open, lines.length, userEdited, seedKey, nextSeedKey, initialLines]);

  const update = (idx: number, patch: Partial<LineState>) => {
    setUserEdited(true);
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const selectedLines = lines.filter((l) => l.selected && l.accepted_sessions > 0);
  const totalAgreed = selectedLines.reduce((sum, l) => {
    const price = l.agreed_unit_price.trim() === '' ? l.catalogue_price : Number(l.agreed_unit_price);
    return sum + price * l.accepted_sessions;
  }, 0);
  const totalCatalogue = selectedLines.reduce(
    (sum, l) => sum + l.catalogue_price * l.accepted_sessions,
    0,
  );
  const totalSavings = Math.max(0, totalCatalogue - totalAgreed);

  const handleAccept = async () => {
    if (pricingLoading) {
      toast({ title: 'Pricing is still loading', description: 'Wait a moment so menu discounts can be applied.', variant: 'destructive' });
      return;
    }
    if (selectedLines.length === 0) {
      toast({ title: 'Select at least one recommendation', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = selectedLines.map((l) => {
        const agreed = l.agreed_unit_price.trim() === '' ? null : Number(l.agreed_unit_price);
        const belowCatalogue = agreed != null && agreed < l.catalogue_price;
        const isSystemDiscount =
          l.system_discount_amount > 0 &&
          agreed != null &&
          Math.round(l.catalogue_price - agreed) === Math.round(l.system_discount_amount);
        return {
          service_id: l.service_id,
          accepted_sessions: l.accepted_sessions,
          ...(agreed != null ? { agreed_unit_price: agreed } : {}),
          // When below catalogue, always include a discount reason so the
          // server-side trigger accepts the line.
          ...(belowCatalogue
            ? {
                line_discount_type: 'amount',
                line_discount_value: l.catalogue_price - agreed,
                line_discount_reason: isSystemDiscount
                  ? `Menu discount${l.system_discount_label ? `: ${l.system_discount_label}` : ''}`
                  : 'Practitioner adjustment',
              }
            : {}),
        };
      });
      const { data, error } = await supabase.rpc('accept_treatment_plan', {
        p_assessment_id: assessment.id,
        p_lines: payload,
        p_notes: notes.trim() || undefined,
      });
      if (error) throw error;
      toast({
        title: 'Treatment plan accepted',
        description: 'Plan recorded. Sequencing happens after payment confirmation.',
      });
      // Refresh every surface that reads accepted-plan state so the live visit
      // exposes Plan & Start Treatment without a manual reload.
      qc.invalidateQueries({ queryKey: ['visit-assessments'] });
      qc.invalidateQueries({ queryKey: ['accepted-plan-lines'] });
      qc.invalidateQueries({ queryKey: ['treatment-plans', assessment.client_id] });
      qc.invalidateQueries({ queryKey: ['treatment_plans', assessment.client_id] });
      qc.invalidateQueries({ queryKey: ['treatment_plan_sessions'] });
      qc.invalidateQueries({ queryKey: ['plan_schedule_items'] });
      qc.invalidateQueries({ queryKey: ['visit-finance-netting'] });
      qc.invalidateQueries({ queryKey: ['client-visits'] });
      qc.invalidateQueries({ queryKey: ['visit-line-items'] });
      try {
        const planId =
          (data as { plan_id?: string } | null | undefined)?.plan_id ?? '';
        if (onAccepted && planId) await onAccepted({ plan_id: planId });
      } catch {
        /* stamping the product snapshot must not block the accept toast */
      }
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to accept plan';
      const friendly = msg.includes('duplicate_active_plan')
        ? 'An active plan already exists for this assessment.'
        : msg.includes('no_lines_accepted')
          ? 'Select at least one recommendation.'
          : msg.includes('forbidden_not_assigned_practitioner')
            ? 'Only the practitioner assigned to this visit (or an admin) can accept the plan.'
            : msg.includes('discount_reason_required_for_below_catalogue_price')
              ? 'A discount reason is required when the agreed price is below the catalogue price.'
              : msg.includes('forbidden')
                ? 'You do not have permission to accept treatment plans.'
                : msg;
      toast({ title: 'Could not accept plan', description: friendly, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Accept Treatment Plan</DialogTitle>
        </DialogHeader>

        {pricingLoading ? (
          <p className="text-sm text-muted-foreground">
            Loading menu discounts…
          </p>
        ) : lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Select at least one recommended service in the Visit Log before accepting a plan.
          </p>
        ) : (
          <div className="space-y-3 max-h-[55vh] overflow-auto pr-1">
            {lines.map((l, i) => (
              <div key={l.service_id} className="glass rounded-lg p-3 space-y-2">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={l.selected}
                    onCheckedChange={(v) => update(i, { selected: Boolean(v) })}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{l.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Recommended {l.recommended_sessions} ×{' '}
                      {l.system_discount_amount > 0 ? (
                        <>
                          <span className="line-through mr-1">{formatNaira(l.catalogue_price)}</span>
                          <span className="text-foreground font-semibold">
                            {formatNaira(l.catalogue_price - l.system_discount_amount)}
                          </span>
                          {l.system_discount_label && (
                            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-accent/15 text-accent text-[10px] font-semibold">
                              {l.system_discount_label}
                            </span>
                          )}
                        </>
                      ) : (
                        <>{formatNaira(l.catalogue_price)}</>
                      )}
                    </p>
                  </div>
                </div>
                {l.selected && (
                  <div className="grid grid-cols-2 gap-2 pl-7">
                    <div>
                      <Label className="text-[11px]">Accepted sessions</Label>
                      <Input
                        type="number"
                        min={1}
                        value={l.accepted_sessions}
                        onChange={(e) => update(i, { accepted_sessions: Math.max(1, Number(e.target.value) || 1) })}
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Agreed price (₦)</Label>
                      <Input
                        type="number"
                        placeholder={String(l.catalogue_price)}
                        value={l.agreed_unit_price}
                        onChange={(e) => update(i, { agreed_unit_price: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div>
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            <div className="text-right text-sm text-muted-foreground space-y-0.5">
              {totalSavings > 0 && (
                <>
                  <div>
                    Catalogue subtotal:{' '}
                    <span className="line-through">{formatNaira(totalCatalogue)}</span>
                  </div>
                  <div className="text-emerald-500">
                    Client saves: <span className="font-semibold">− {formatNaira(totalSavings)}</span>
                  </div>
                </>
              )}
              <div>
                Total agreed:{' '}
                <span className="font-semibold text-foreground">{formatNaira(totalAgreed)}</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleAccept} disabled={saving || pricingLoading || lines.length === 0} className="glow-primary">
            {saving ? 'Accepting…' : 'Accept Plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AcceptTreatmentPlanDialog;