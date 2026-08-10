import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  resolveServicePrice,
  formatNaira,
  type DiscountConfig,
} from '@/lib/serviceDiscount';

export interface DiscountFormState {
  discount_enabled: boolean;
  discount_type: 'percentage' | 'fixed';
  discount_value: number | '';
  discount_label: string;
  discount_start_date: string; // YYYY-MM-DDTHH:mm or ''
  discount_end_date: string;
}

export const emptyDiscount: DiscountFormState = {
  discount_enabled: false,
  discount_type: 'percentage',
  discount_value: '',
  discount_label: '',
  discount_start_date: '',
  discount_end_date: '',
};

/** Convert a discount state to columns ready for upsert. */
export const discountStateToColumns = (s: DiscountFormState) => ({
  discount_enabled: s.discount_enabled,
  discount_type: s.discount_enabled ? s.discount_type : null,
  discount_value:
    s.discount_enabled && s.discount_value !== '' && Number.isFinite(Number(s.discount_value))
      ? Number(s.discount_value)
      : null,
  discount_label: s.discount_enabled ? (s.discount_label.trim() || null) : null,
  discount_start_date: s.discount_enabled && s.discount_start_date
    ? new Date(s.discount_start_date).toISOString()
    : null,
  discount_end_date: s.discount_enabled && s.discount_end_date
    ? new Date(s.discount_end_date).toISOString()
    : null,
});

const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Build a DiscountFormState from a row coming back from the DB. */
export const rowToDiscountState = (row: DiscountConfig | null | undefined): DiscountFormState => ({
  discount_enabled: !!row?.discount_enabled,
  discount_type: (row?.discount_type === 'fixed' ? 'fixed' : 'percentage') as 'percentage' | 'fixed',
  discount_value:
    row?.discount_value == null || row.discount_value === ''
      ? ''
      : Number(row.discount_value),
  discount_label: row?.discount_label ?? '',
  discount_start_date: toLocalInput(row?.discount_start_date ?? null),
  discount_end_date: toLocalInput(row?.discount_end_date ?? null),
});

interface Props {
  title: string;
  description?: string;
  helperText?: string;
  value: DiscountFormState;
  onChange: (next: DiscountFormState) => void;
  /** Used to render the live "Was / Now" preview. */
  previewBasePrice?: number;
}

/**
 * Shared admin UI for configuring a discount on a service or a service category.
 * Pure presentational — the parent owns persistence.
 */
const DiscountEditor = ({ title, description, helperText, value, onChange, previewBasePrice }: Props) => {
  const set = <K extends keyof DiscountFormState>(k: K, v: DiscountFormState[K]) =>
    onChange({ ...value, [k]: v });

  const previewState: DiscountConfig = {
    discount_enabled: value.discount_enabled,
    discount_type: value.discount_type,
    discount_value: value.discount_value === '' ? null : Number(value.discount_value),
    discount_label: value.discount_label,
    discount_start_date: value.discount_start_date
      ? new Date(value.discount_start_date).toISOString()
      : null,
    discount_end_date: value.discount_end_date
      ? new Date(value.discount_end_date).toISOString()
      : null,
  };
  const preview =
    previewBasePrice != null && previewBasePrice > 0
      ? resolveServicePrice({ price_per_session: previewBasePrice, ...previewState })
      : null;

  return (
    <div className="space-y-4 pt-4 border-t border-border/30">
      <div>
        <p className="text-xs uppercase tracking-wider text-accent font-semibold">{title}</p>
        {description && (
          <p className="text-[11px] text-muted-foreground mt-1">{description}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Switch
          checked={value.discount_enabled}
          onCheckedChange={(v) => set('discount_enabled', v)}
        />
        <Label className="text-xs">Enable discount</Label>
      </div>

      {value.discount_enabled && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Discount type
              </Label>
              <select
                value={value.discount_type}
                onChange={(e) => set('discount_type', e.target.value as 'percentage' | 'fixed')}
                className="w-full h-10 rounded-md bg-surface border border-border/60 px-3 text-sm text-foreground"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed amount (₦)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                {value.discount_type === 'percentage' ? 'Value (%)' : 'Value (₦)'}
              </Label>
              <Input
                type="number"
                min={0}
                max={value.discount_type === 'percentage' ? 100 : undefined}
                value={value.discount_value}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') return set('discount_value', '');
                  const n = Math.max(0, Number(raw));
                  const capped =
                    value.discount_type === 'percentage' ? Math.min(100, n) : n;
                  set('discount_value', capped);
                }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Discount label
            </Label>
            <Input
              value={value.discount_label}
              onChange={(e) => set('discount_label', e.target.value)}
              placeholder='e.g. "Launch Offer", "Weekend Promo"'
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Starts (optional)
              </Label>
              <Input
                type="datetime-local"
                value={value.discount_start_date}
                onChange={(e) => set('discount_start_date', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Ends (optional)
              </Label>
              <Input
                type="datetime-local"
                value={value.discount_end_date}
                onChange={(e) => set('discount_end_date', e.target.value)}
              />
            </div>
          </div>

          {preview && (
            <div className="rounded-md border border-border/40 bg-surface/30 p-3 text-xs">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                Live preview
              </p>
              {preview.discount ? (
                <p className="text-foreground">
                  Was{' '}
                  <span className="line-through text-muted-foreground">
                    {formatNaira(preview.basePrice)}
                  </span>{' '}
                  · Now{' '}
                  <span className="font-semibold text-accent">
                    {formatNaira(preview.finalPrice)}
                  </span>
                  {preview.discount.label && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-full bg-accent/15 text-accent text-[10px] font-semibold">
                      {preview.discount.label}
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Set a discount type, value, and (optionally) date window to activate.
                </p>
              )}
            </div>
          )}

          {helperText && (
            <p className="text-[11px] text-muted-foreground">{helperText}</p>
          )}
        </>
      )}
    </div>
  );
};

export default DiscountEditor;