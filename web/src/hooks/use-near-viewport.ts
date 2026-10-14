'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Whether `ref`'s element has come within `rootMargin` of the viewport — and stays true once
 * it has, so data loaded for it is not dropped when it scrolls back out. Without
 * IntersectionObserver (old browsers, tests) it answers true from the first client render.
 */
export function useNearViewport(ref: RefObject<Element | null>, rootMargin = '300px'): boolean {
  const [near, setNear] = useState(() => typeof window !== 'undefined' && typeof IntersectionObserver === 'undefined');

  // Watched element and its observer, so a render that changes nothing does not rebuild it.
  const watching = useRef<{ element: Element; observer: IntersectionObserver } | null>(null);

  // No dependency list on purpose: the element can mount after the first render (a page that
  // renders nothing while it decides on a redirect, a skeleton swapped for content), and a ref
  // changing does not re-run an effect. Checking after every render attaches as soon as it exists.
  useEffect(() => {
    const element = ref.current;
    if (near || !element || typeof IntersectionObserver === 'undefined') return;
    if (watching.current?.element === element) return;
    watching.current?.observer.disconnect();
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { rootMargin },
    );
    observer.observe(element);
    watching.current = { element, observer };
  });

  useEffect(() => () => watching.current?.observer.disconnect(), []);
  useEffect(() => {
    if (near) {
      watching.current?.observer.disconnect();
      watching.current = null;
    }
  }, [near]);

  return near;
}
