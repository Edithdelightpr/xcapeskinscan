import { Link } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { formatNaira } from '@/lib/finance';
import { formatFcfa } from '@/lib/xcapeRetail';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const CartSheet = ({ open, onOpenChange }: Props) => {
  const items = useCartStore((s) => s.items);
  const setQty = useCartStore((s) => s.setQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const total = useCartStore((s) => s.total());
  const report = useCartStore((s) => s.report);
  // A report cart is priced and settled in FCFA with its own XCAPE checkout;
  // the ordinary marketplace cart keeps the existing Naira/bank-transfer path.
  const money = report ? formatFcfa : formatNaira;
  const checkoutHref = report ? `/report/${report.token}/order` : '/checkout';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-accent" /> {report ? 'Your XCAPE order' : 'Your cart'}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-muted-foreground">
            <ShoppingBag className="w-10 h-10 opacity-40" />
            <p className="text-sm">Your cart is empty.</p>
            <Button asChild variant="outline" onClick={() => onOpenChange(false)}>
              <Link to="/tropixa">Browse products</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto -mx-6 px-6 py-4 space-y-3">
              {items.map((it) => (
                <div key={it.product_id} className="flex gap-3 border-b border-border/40 pb-3">
                  <div className="w-16 h-16 rounded-md bg-muted overflow-hidden shrink-0">
                    {it.image_url ? (
                      <img src={it.image_url} alt={it.name} className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight line-clamp-2">{it.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{money(it.unit_price)}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <Button size="icon" variant="outline" className="h-7 w-7"
                        onClick={() => setQty(it.product_id, it.quantity - 1)}>
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="text-sm font-semibold w-6 text-center">{it.quantity}</span>
                      <Button size="icon" variant="outline" className="h-7 w-7"
                        onClick={() => setQty(it.product_id, it.quantity + 1)}>
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 ml-auto text-muted-foreground"
                        onClick={() => removeItem(it.product_id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-right text-sm font-semibold whitespace-nowrap">
                    {money(it.unit_price * it.quantity)}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border/40 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Subtotal</span>
                <span className="text-xl font-bold font-display">{money(total)}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                  Continue shopping
                </Button>
                <Button asChild className="flex-1" onClick={() => onOpenChange(false)}>
                  <Link to={checkoutHref}>Checkout</Link>
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartSheet;