import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Stethoscope, Loader2, Sparkles, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CatalogueCombobox from './CatalogueCombobox';
import { useServices } from '@/hooks/useServices';
import { useProducts } from '@/hooks/useProducts';
import {
  useCompleteTreatmentClinical,
  useStartTreatment,
  type ClientVisitLog,
  type ClinicalCompletionLine,
  type ClinicalCompletionProduct,
  type ClinicalCompletionPayload,
} from '@/hooks/useClientVisits';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  visit: ClientVisitLog;
  clientName?: string;
  onCompleted?: () => void;
}

type DeliveredDraft = ClinicalCompletionLine & { _id: string };
type ProductDraft = ClinicalCompletionProduct & { _id: string };

const uid = () => Math.random().toString(36).slice(2, 10);

const TreatmentCompletionModal = ({ open, onClose, visit, clientName, onCompleted }: Props) => {
  const { data: services = [] } = useServices({ activeOnly: true });
  const { data: products = [] } = useProducts();
  const complete = useCompleteTreatmentClinical();
  const startTreatment = useStartTreatment();

  const [consultationOnly, setConsultationOnly] = useState(false);
  const [consultReason, setConsultReason] = useState('');
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState<string>('treatment_completed');
  const [followUp, setFollowUp] = useState<string>('none');
  const [planDecision, setPlanDecision] = useState<string>('none');

  const [delivered, setDelivered] = useState<DeliveredDraft[]>([]);
  const [recommended, setRecommended] = useState<ProductDraft[]>([]);

  const productsById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const servicesById = useMemo(() => Object.fromEntries(services.map((s) => [s.id, s])), [services]);

  if (!open) return null;

  const addDeliveredService = (id: string) => {
    const s = servicesById[id];
    if (!s) return;
    setDelivered((prev) => [...prev, {
      _id: uid(),
      kind: 'service',
      name: s.name,
      qty: 1,
      unit_price: Number(s.price_per_session ?? 0),
      catalogue_unit_price: Number(s.price_per_session ?? 0),
      agreed_unit_price: Number(s.price_per_session ?? 0),
      service_id: id,
      is_complimentary: false,
    }]);
  };

  const addRecommendedProduct = (id: string) => {
    const p = productsById[id];
    if (!p) return;
    setRecommended((prev) => [...prev, {
      _id: uid(), name: p.name, qty: 1, product_id: id,
      unit_price: Number((p as { price?: number }).price ?? 0),
    }]);
  };

  const submit = async () => {
    // Auto-start the treatment if the practitioner never explicitly pressed Start.
    if (!visit.treatment_started_at) {
      try {
        await startTreatment.mutateAsync(visit.id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not start treatment');
        return;
      }
    }
    const payload: ClinicalCompletionPayload = {
      consultation_only: consultationOnly,
      consultation_only_reason: consultationOnly ? consultReason : null,
      clinical_notes: consultationOnly ? null : notes,
      outcome: consultationOnly ? 'no_conversion' : outcome,
      follow_up_decision: followUp,
      treatment_plan_decision: planDecision,
      delivered: consultationOnly ? [] : delivered.map(({ _id: _drop, ...rest }) => rest),
      products_used: [],
      products_recommended: recommended.map(({ _id: _drop, ...rest }) => rest),
    };
    try {
      await complete.mutateAsync({ id: visit.id, payload });
      toast.success(consultationOnly ? 'Consultation logged' : 'Treatment marked complete');
      onCompleted?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to complete treatment');
    }
  };

  const canSubmit = consultationOnly
    ? consultReason.trim().length >= 4
    : delivered.length > 0;

  const checklist = consultationOnly
    ? [{ label: 'Reason (min 4 chars)', done: consultReason.trim().length >= 4 }]
    : [
        { label: 'Add at least one delivered service', done: delivered.length > 0 },
        {
          label: visit.treatment_started_at ? 'Treatment started' : 'Treatment will auto-start on submit',
          done: true,
        },
      ];

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-3xl bg-card border border-border rounded-2xl shadow-2xl my-4 max-h-[95vh] flex flex-col">
        <header className="flex items-center justify-between px-5 py-4 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary shrink-0">
              <Stethoscope className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-foreground truncate">Complete Treatment</h2>
              <p className="text-xs text-muted-foreground truncate">{clientName ?? 'Client'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted/40" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <label className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/40 cursor-pointer">
            <Checkbox
              checked={consultationOnly}
              onCheckedChange={(v) => setConsultationOnly(!!v)}
              id="consult-only"
            />
            <span className="text-sm font-medium text-foreground">Consultation only — no treatment performed</span>
          </label>

          {consultationOnly ? (
            <div>
              <Label htmlFor="reason">Reason (required)</Label>
              <Textarea
                id="reason"
                value={consultReason}
                onChange={(e) => setConsultReason(e.target.value)}
                placeholder="Why was no treatment delivered? (min 4 characters)"
                className="mt-1.5 min-h-[90px]"
              />
            </div>
          ) : (
            <>
              {/* Delivered services / treatments */}
              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" /> Delivered treatments / services
                  </h3>
                  <CatalogueCombobox
                    placeholder="Search & add service…"
                    options={services.map((s) => ({
                      id: s.id,
                      name: s.name,
                      hint: s.duration_minutes ? `${s.duration_minutes} min · ₦${Number(s.price_per_session ?? 0).toLocaleString()}` : `₦${Number(s.price_per_session ?? 0).toLocaleString()}`,
                    }))}
                    onSelect={addDeliveredService}
                  />
                </div>
                {delivered.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">At least one delivered service is required.</p>
                )}
                <div className="space-y-2">
                  {delivered.map((d) => (
                    <div key={d._id} className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg border border-border/40 bg-background/40">
                      <div className="col-span-12 sm:col-span-5">
                        <p className="text-sm font-medium text-foreground truncate">{d.name}</p>
                        <p className="text-[10px] text-muted-foreground">Catalogue ₦{Number(d.catalogue_unit_price ?? 0).toLocaleString()}</p>
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Label className="text-[10px] uppercase text-muted-foreground">Qty</Label>
                        <Input
                          type="number" min={1} value={d.qty}
                          onChange={(e) => setDelivered((prev) => prev.map((x) => x._id === d._id ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x))}
                          className="h-8"
                        />
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <Label className="text-[10px] uppercase text-muted-foreground">Agreed ₦</Label>
                        <Input
                          type="number" min={0} value={d.agreed_unit_price ?? 0}
                          onChange={(e) => {
                            const v = Math.max(0, Number(e.target.value) || 0);
                            setDelivered((prev) => prev.map((x) => x._id === d._id ? { ...x, agreed_unit_price: v, unit_price: v } : x));
                          }}
                          className="h-8"
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-1 flex items-end justify-center">
                        <label className="flex flex-col items-center gap-1 cursor-pointer" title="Complimentary">
                          <span className="text-[9px] uppercase text-muted-foreground">Free</span>
                          <Checkbox
                            checked={!!d.is_complimentary}
                            onCheckedChange={(v) => setDelivered((prev) => prev.map((x) => x._id === d._id ? { ...x, is_complimentary: !!v } : x))}
                          />
                        </label>
                      </div>
                      <div className="col-span-12 sm:col-span-1 flex justify-end">
                        <Button size="icon" variant="ghost" onClick={() => setDelivered((prev) => prev.filter((x) => x._id !== d._id))}>
                          <Trash2 className="w-4 h-4 text-rose-500" />
                        </Button>
                      </div>
                      {d.is_complimentary && (
                        <div className="col-span-12">
                          <Input
                            placeholder="Complimentary reason…"
                            value={d.comp_reason ?? ''}
                            onChange={(e) => setDelivered((prev) => prev.map((x) => x._id === d._id ? { ...x, comp_reason: e.target.value } : x))}
                            className="h-8"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Clinical notes + outcome */}
              <section className="space-y-3">
                <div>
                  <Label htmlFor="notes">Clinical notes (optional)</Label>
                  <Textarea
                    id="notes" value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1.5 min-h-[90px]"
                    placeholder="What was done, observations, skin response…"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Outcome</Label>
                    <Select value={outcome} onValueChange={setOutcome}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent className="z-[10000]">
                        <SelectItem value="treatment_completed">Treatment completed</SelectItem>
                        <SelectItem value="follow_up_required">Follow-up required</SelectItem>
                        <SelectItem value="no_conversion">No conversion</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Follow-up decision</Label>
                    <Select value={followUp} onValueChange={setFollowUp}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent className="z-[10000]">
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="schedule_follow_up">Schedule follow-up</SelectItem>
                        <SelectItem value="referral">Refer out</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Treatment plan decision</Label>
                  <Select value={planDecision} onValueChange={setPlanDecision}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[10000]">
                      <SelectItem value="none">None discussed</SelectItem>
                      <SelectItem value="accepted">Accepted plan</SelectItem>
                      <SelectItem value="declined">Declined plan</SelectItem>
                      <SelectItem value="deferred">Deferred / thinking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </section>
            </>
          )}

          {/* Recommended products always allowed (for consultation-only too) */}
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-primary" /> Products recommended (home use)
              </h3>
              <CatalogueCombobox
                placeholder="Search & recommend product…"
                options={products.map((p) => ({ id: p.id, name: p.name }))}
                onSelect={addRecommendedProduct}
              />
            </div>
            <ProductList
              items={recommended} onChange={setRecommended}
              emptyText="No products recommended yet."
            />
          </section>
        </div>

        <footer className="px-5 py-3 border-t border-border/60 flex items-center justify-between gap-2 shrink-0">
          <ul className="space-y-0.5">
            {checklist.map((c, i) => (
              <li key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {c.done
                  ? <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  : <Circle className="w-3 h-3 text-muted-foreground/60" />}
                <span className={c.done ? 'text-foreground/80' : ''}>{c.label}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={complete.isPending}>Cancel</Button>
            <Button
              onClick={submit}
              disabled={!canSubmit || complete.isPending || startTreatment.isPending}
              className="glow-primary min-w-[160px]"
            >
              {complete.isPending || startTreatment.isPending
                ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving…</>
                : consultationOnly ? 'Log Consultation' : 'Complete Treatment'}
            </Button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
};

const ProductList = ({
  items, onChange, emptyText,
}: {
  items: ProductDraft[];
  onChange: (fn: (prev: ProductDraft[]) => ProductDraft[]) => void;
  emptyText: string;
}) => {
  if (items.length === 0) return <p className="text-xs text-muted-foreground italic">{emptyText}</p>;
  return (
    <div className="space-y-2">
      {items.map((p) => (
        <div key={p._id} className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg border border-border/40 bg-background/40">
          <div className="col-span-8 sm:col-span-9">
            <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
          </div>
          <div className="col-span-3 sm:col-span-2">
            <Input
              type="number" min={1} value={p.qty}
              onChange={(e) => onChange((prev) => prev.map((x) => x._id === p._id ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x))}
              className="h-8"
            />
          </div>
          <div className="col-span-1 flex justify-end">
            <Button size="icon" variant="ghost" onClick={() => onChange((prev) => prev.filter((x) => x._id !== p._id))}>
              <Trash2 className="w-4 h-4 text-rose-500" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TreatmentCompletionModal;