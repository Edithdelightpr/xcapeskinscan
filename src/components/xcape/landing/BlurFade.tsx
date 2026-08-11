import { useEffect, useRef, useState, type ReactNode } from 'react';

interface BlurFadeProps {
  children: ReactNode;
  /** Seconds to delay the transition once in view. */
  delay?: number;
  className?: string;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Scroll-into-view blur/fade/rise reveal (reference-style).
 * Under prefers-reduced-motion the content renders fully settled on first
 * paint — no opacity, filter, transform, or transition at all.
 */
export function BlurFade({ children, delay = 0, className }: BlurFadeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [reduceMotion] = useState(prefersReducedMotion);
  const [visible, setVisible] = useState(reduceMotion);

  useEffect(() => {
    if (reduceMotion) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduceMotion]);

  return (
    <div
      ref={ref}
      className={className}
      style={
        reduceMotion
          ? undefined
          : {
              opacity: visible ? 1 : 0,
              filter: visible ? 'blur(0)' : 'blur(6px)',
              transform: visible ? 'translateY(0)' : 'translateY(12px)',
              transition: `opacity 0.6s ease ${delay}s, filter 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
            }
      }
    >
      {children}
    </div>
  );
}
