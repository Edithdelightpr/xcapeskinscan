import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface SignOutCartItem {
  kind: 'service' | 'product';
  name: string;
  qty: number;
  unit_price: number;
  original_price?: number;
  discount_pct?: number;
  service_id?: string | null;
  product_id?: string | null;
}

interface Props {
  items: SignOutCartItem[];
  subtotal: number;
  onUpdate: (idx: number, patch: Partial<SignOutCartItem>) => void;
  onRemove: (idx: number) => void;
}

const fmt = (n: number) => `₦${Math.round(Number(n) || 0).toLocaleString()}`;

const SignOutCart = ({ items, subtotal, onUpdate, onRemove }: Props) => {
  if (items.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground italic px-1">
        No items added yet. Pick treatments or products from the catalogue above.
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      {items.map((it, idx) => (
        <div
          key={idx}
          className="flex items-center gap-2 bg-surface rounded-md border border-border/40 px-2 py-1.5 flex-wrap sm:flex-nowrap"
        >
          <span
            className={cn(
              'text-[9px] px-1.5 py-0.5 rounded uppercase font-semibold tracking-wider shrink-0',
              it.kind === 'service' ? 'bg-primary/20 text-primary' : 'bg-amber-500/20 text-amber-700',
            )}
          >
            {it.kind === 'service' ? 'Svc' : 'Prod'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-foreground truncate">{it.name}</p>
            {(it.original_price != null || it.discount_pct) && (
              <p className="text-[10px] text-muted-foreground inline-flex items-center gap-1.5">
                {it.original_price != null && it.original_price > it.unit_price && (
                  <span className="line-through">{fmt(it.original_price)}</span>
                )}
                {it.discount_pct ? (
                  <span className="px-1 py-0.5 rounded bg-accent/15 text-accent font-semibold text-[9px]">
                    Save {it.discount_pct}%
                  </span>
                ) : null}
              </p>
            )}
          </div>
          <Input
            type="number"
            min={1}
            value={it.qty}
            onChange={(e) => onUpdate(idx, { qty: Math.max(1, Number(e.target.value) || 1) })}
            className="h-7 w-14 text-xs bg-background"
          />
          <Input
            type="number"
            min={0}
            value={it.unit_price}
            onChange={(e) => onUpdate(idx, { unit_price: Math.max(0, Number(e.target.value) || 0) })}
            className="h-7 w-24 text-xs bg-background"
          />
          <span className="text-xs font-semibold text-foreground w-24 text-right">
            {fmt(it.qty * it.unit_price)}
          </span>
          <button
            type="button"
            onClick={() => onRemove(idx)}
            className="p-1 text-muted-foreground hover:text-destructive"
            aria-label="Remove"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-border/40 pt-2 mt-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Subtotal</span>
        <span className="text-sm font-bold text-foreground">{fmt(subtotal)}</span>
      </div>
    </div>
  );
};

export default SignOutCart;