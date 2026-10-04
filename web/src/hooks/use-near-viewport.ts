'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * Whether `ref`'s element has come within `rootMargin` of the viewport — and stays true once
 * it has, so data loaded for it is not dropped when it scrolls back out. Without
 * IntersectionObserver (old browsers, tests) it answers true from the first client render.
 */
export function useNearViewport(ref: RefObject<Element | null>, rootMargin = '300px'): boolean {
  const [near, setNear] = useState(() => typeof window !== 'undefined' && typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const element = ref.current;
    if (near || !element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, rootMargin, near]);

  return near;
}
