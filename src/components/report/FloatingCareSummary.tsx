import { ArrowRight, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCartStore } from '@/store/cartStore';
import { formatNaira } from '@/lib/serviceDiscount';

const FloatingCareSummary = () => {
  const count = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const total = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity * i.unit_price, 0));
  if (count === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 pointer-events-none px-3 pb-3 sm:px-6 sm:pb-6">
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-bronze/25 bg-white/95 backdrop-blur shadow-[0_20px_50px_-20px_hsl(22_38%_18%_/_0.35)] px-4 sm:px-5 py-3 flex items-center gap-3">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-bronze/15 text-bronze shrink-0">
          <ShoppingBag className="w-4 h-4" strokeWidth={1.8} />
        </span>
        <div className="flex-1 min-w-0 leading-tight">
          <div className="text-[10.5px] uppercase tracking-[0.2em] text-bronze font-semibold">Your care plan</div>
          <div className="text-[13px] text-cocoa">
            <span className="font-medium">{count}</span> product{count === 1 ? '' : 's'}
            <span className="text-cocoa/40"> · </span>
            <span className="font-semibold tabular-nums">{formatNaira(total)}</span>
          </div>
        </div>
        <Link
          to="/checkout"
          className="inline-flex items-center gap-1.5 rounded-full bg-cocoa text-white text-[12.5px] font-medium px-4 py-2 hover:bg-cocoa/90 transition"
        >
          Checkout
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.8} />
        </Link>
      </div>
    </div>
  );
};

export default FloatingCareSummary;