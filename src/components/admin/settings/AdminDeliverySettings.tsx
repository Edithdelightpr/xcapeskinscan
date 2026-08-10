import { useEffect, useState } from 'react';
import { Truck, Loader2, Save, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { formatNaira } from '@/lib/finance';
import { useAuth } from '@/hooks/useAuth';
import { useDeliverySettings, type DeliverySettings } from '@/hooks/useDeliverySettings';

const AdminDeliverySettings = () => {
  const { isAdmin } = useAuth();
  const { settings, isLoading, save } = useDeliverySettings();
  const [form, setForm] = useState<DeliverySettings>(settings);

  useEffect(() => { setForm(settings); }, [settings]);

  if (!isAdmin) {
    return (
      <div className="glass rounded-xl p-6 text-sm text-muted-foreground">
        Only administrators can view or change delivery settings.
      </div>
    );
  }

  const set = <K extends keyof DeliverySettings>(k: K, v: DeliverySettings[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (form.enabled && form.fee < 0) {
      toast.error('Delivery fee cannot be negative.');
      return;
    }
    if (form.enabled && form.fee === 0 && !form.free_threshold) {
      // allowed — 0 fee is valid
    }
    if (!form.label.trim()) {
      toast.error('Please provide a delivery label.');
      return;
    }
    try {
      await save.mutateAsync(form);
      toast.success('Delivery settings saved.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save settings');
    }
  };

  return (
    <div className="glass rounded-xl p-4 sm:p-6 space-y-6 border border-border/40">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Truck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-display font-bold text-foreground">Delivery &amp; Shipping</h2>
          <p className="text-xs text-muted-foreground">
            Flat delivery fee applied at online checkout. Only admins can change these values.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading settings…
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border border-border/40 bg-card/40 p-4">
            <div>
              <p className="text-sm font-semibold">Charge delivery fee</p>
              <p className="text-xs text-muted-foreground">
                When off, all online orders are free and pickup-only regardless of amount.
              </p>
            </div>
            <Switch checked={form.enabled} onCheckedChange={(v) => set('enabled', v)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Default delivery fee (₦)
              </Label>
              <Input
                type="number" inputMode="numeric" min={0} step={100}
                value={Number.isFinite(form.fee) ? form.fee : 0}
                onChange={(e) => set('fee', Number(e.target.value) || 0)}
                disabled={!form.enabled}
              />
              <p className="text-[11px] text-muted-foreground">
                Preview: {formatNaira(form.enabled ? form.fee : 0)}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Free delivery threshold (₦, optional)
              </Label>
              <Input
                type="number" inputMode="numeric" min={0} step={1000}
                value={form.free_threshold ?? ''}
                placeholder="Leave blank to always charge"
                onChange={(e) => set('free_threshold', e.target.value === '' ? null : Number(e.target.value) || 0)}
                disabled={!form.enabled}
              />
              <p className="text-[11px] text-muted-foreground">
                Orders at or above this subtotal ship free.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/40 bg-card/40 p-4">
            <div>
              <p className="text-sm font-semibold">Allow store pickup</p>
              <p className="text-xs text-muted-foreground">
                Customers can choose to collect at {`Wonderland Estate, Abuja`} at ₦0.
              </p>
            </div>
            <Switch checked={form.pickup_enabled} onCheckedChange={(v) => set('pickup_enabled', v)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Customer-facing label
              </Label>
              <Input
                value={form.label}
                onChange={(e) => set('label', e.target.value)}
                placeholder="Delivery fee"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Short note (optional)
              </Label>
              <Textarea
                rows={2}
                value={form.note}
                onChange={(e) => set('note', e.target.value)}
                placeholder="e.g. Delivery within Abuja only, 1–2 business days"
              />
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span>
              Historic orders keep the fee that was in force at checkout — changing these values
              never rewrites past totals. Zone-based fees, riders, and delivery status can be added
              later without changing the order model.
            </span>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={save.isPending} className="gap-2">
              {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save settings
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDeliverySettings;