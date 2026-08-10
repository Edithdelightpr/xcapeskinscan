import { useEffect, useRef, useState } from 'react';

/**
 * IntersectionObserver-based reveal trigger. Returns a ref and a boolean
 * that flips to true the first time the element scrolls into view. Cheap:
 * unobserves immediately after the first reveal.
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options: { threshold?: number; rootMargin?: string; disabled?: boolean } = {},
) {
  const { threshold = 0.12, rootMargin = '0px 0px -8% 0px', disabled = false } = options;
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (disabled) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            obs.unobserve(entry.target);
          }
        }
      },
      { threshold, rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, rootMargin, disabled]);

  return { ref, visible };
}