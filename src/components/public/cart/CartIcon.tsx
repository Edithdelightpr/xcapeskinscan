import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import CartSheet from './CartSheet';

const CartIcon = () => {
  const count = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open cart"
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-full border border-border/40 text-foreground hover:bg-surface/60 transition"
      >
        <ShoppingBag className="w-4 h-4" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">
            {count}
          </span>
        )}
      </button>
      <CartSheet open={open} onOpenChange={setOpen} />
    </>
  );
};

export default CartIcon;