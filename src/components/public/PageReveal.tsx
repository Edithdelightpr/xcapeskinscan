import { useEffect, useState, type ReactNode } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * Wraps a public page with a soft warm reveal on mount.
 * Honors prefers-reduced-motion. Pure CSS transition, GPU-friendly.
 */
const PageReveal = ({ children, className }: Props) => {
  const reduced = useReducedMotion();
  const [revealed, setRevealed] = useState(reduced);

  useEffect(() => {
    if (reduced) {
      setRevealed(true);
      return;
    }
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);

  return (
    <div
      className={cn('page-reveal', revealed && 'page-reveal-in', className)}
    >
      {children}
    </div>
  );
};

export default PageReveal;