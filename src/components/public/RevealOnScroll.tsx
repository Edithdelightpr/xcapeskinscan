import { createElement, type ElementType, type ReactNode } from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';

type Props = {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  className?: string;
};

/**
 * Reveals children with a soft fade + slight rise when they enter the
 * viewport. Triggers once. Honors prefers-reduced-motion.
 */
const RevealOnScroll = ({ children, as = 'div', delay = 0, className }: Props) => {
  const reduced = useReducedMotion();
  const { ref, visible } = useScrollReveal<HTMLDivElement>({ disabled: reduced });

  return createElement(
    as,
    {
      ref,
      className: cn('reveal-init', visible && 'reveal-in', className),
      style: delay && !reduced ? { transitionDelay: `${delay}ms` } : undefined,
    },
    children,
  );
};

export default RevealOnScroll;