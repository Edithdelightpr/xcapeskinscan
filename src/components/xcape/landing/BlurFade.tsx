import { useEffect, useRef, useState, type ReactNode } from 'react';

interface BlurFadeProps {
  children: ReactNode;
  /** Seconds to delay the transition once in view. */
  delay?: number;
  className?: string;
}

/**
 * Scroll-into-view blur/fade/rise reveal (reference-style).
 * Fully respects prefers-reduced-motion: content renders immediately
 * with no transform, filter, or transition.
 */
export function BlurFade({ children, delay = 0, className }: BlurFadeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
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
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        filter: visible ? 'blur(0)' : 'blur(6px)',
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: `opacity 0.6s ease ${delay}s, filter 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}
