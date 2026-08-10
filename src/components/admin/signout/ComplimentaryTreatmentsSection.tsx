import { useMemo, useState } from 'react';
import { Gift, Plus, Trash2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useServices } from '@/hooks/useServices';
import { useAuth } from '@/hooks/useAuth';

export interface ComplimentaryDraft {
  service_id: string;
  service_name: string;
  catalogue_unit_price: number;
  quantity: number;
  reason: string;
}

interface Props {
  value: ComplimentaryDraft[];
  onChange: (next: ComplimentaryDraft[]) => void;
}

/**
 * Front-desk-only add-on used at checkout. Complimentary sessions carry
 * standard catalogue value but ₦0 due, require an explicit reason, and
 * count toward the client's plan total without touching sessions_paid_for.
 */
const ComplimentaryTreatmentsSection = ({ value, onChange }: Props) => {
  const { data: services = [] } = useServices({ activeOnly: true });
  const { hasRole } = useAuth();
  const canAuthorise = hasRole('admin') || hasRole('front_desk');
  const [pickerServiceId, setPickerServiceId] = useState<string>('');
  const [pickerQty, setPickerQty] = useState<string>('1');
  const [pickerReason, setPickerReason] = useState<string>('');

  const totalCatalogueValue = useMemo(
    () => value.reduce((s, l) => s + l.catalogue_unit_price * l.quantity, 0),
    [value],
  );

  const add = () => {
    if (!canAuthorise) return;
    const svc = services.find((s) => s.id === pickerServiceId);
    if (!svc) return;
    const qty = Number(pickerQty) || 0;
    if (qty <= 0) return;
    if (pickerReason.trim().length < 4) return;
    onChange([
      ...value,
      {
        service_id: svc.id,
        service_name: svc.name,
        catalogue_unit_price: Number(svc.price_per_session) || 0,
        quantity: qty,
        reason: pickerReason.trim(),
      },
    ]);
    setPickerServiceId('');
    setPickerQty('1');
    setPickerReason('');
  };

  const remove = (idx: number) =>
    onChange(value.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3 rounded-lg border border-emerald-400/30 bg-emerald-500/5 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-emerald-500" />
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Complimentary treatments
          </Label>
        </div>
        {!canAuthorise && (
          <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground">
            <Lock className="w-3 h-3" /> Admin / Front desk only
          </span>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Adds free sessions the client is entitled to. Standard catalogue value,
        ₦0 due today, kept separate from discounts and prepaid sessions. Counts
        toward the client's plan total.
      </p>

      {value.length > 0 && (
        <div className="space-y-1.5">
          {value.map((l, idx) => (
            <div
              key={`${l.service_id}-${idx}`}
              className="flex items-center justify-between gap-2 rounded-md bg-background border border-border/40 p-2 text-[11px]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">
                    {l.service_name} ×{l.quantity}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-emerald-500/20 text-emerald-500 text-[9px] font-semibold px-2 py-0.5 shrink-0">
                    Complimentary · ₦0 due
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {l.reason} · Standard value ₦{(l.catalogue_unit_price * l.quantity).toLocaleString()}
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="p-1 rounded hover:bg-surface text-muted-foreground"
                aria-label="Remove"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
            <span>Total complimentary value</span>
            <span className="font-semibold text-foreground">
              ₦{totalCatalogueValue.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {canAuthorise && (
        <div className="space-y-2 rounded-md bg-background/60 border border-border/40 p-2">
          <div className="grid grid-cols-[1fr_80px] gap-2">
            <select
              value={pickerServiceId}
              onChange={(e) => setPickerServiceId(e.target.value)}
              className="h-9 rounded-md bg-background border border-border/60 px-2 text-xs text-foreground"
            >
              <option value="">Select a service…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — ₦{Number(s.price_per_session || 0).toLocaleString()}
                </option>
              ))}
            </select>
            <Input
              type="number"
              min={1}
              value={pickerQty}
              onChange={(e) => setPickerQty(e.target.value)}
              placeholder="Qty"
              className="bg-background border-border/60"
            />
          </div>
          <Input
            value={pickerReason}
            onChange={(e) => setPickerReason(e.target.value)}
            maxLength={200}
            placeholder="Reason (required, e.g. 'Loyalty gift', 'Retention offer')"
            className="bg-background border-border/60"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={add}
            disabled={!pickerServiceId || Number(pickerQty) <= 0 || pickerReason.trim().length < 4}
            className="w-full"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add complimentary session
          </Button>
        </div>
      )}
    </div>
  );
};

export default ComplimentaryTreatmentsSection;