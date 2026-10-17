'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathSegment } from '@/lib/path-segment';
import { setEmbedToken } from '@/lib/api';
import { EmbedDashboard } from '@/components/embed/EmbedDashboard';

/**
 * An iframed dashboard: `/embed/:id?token=…&theme=light|dark&days=7|30|90`. The id is a website's,
 * or a client's with `&client=1`, which adds a switcher between that client's websites.
 *
 * It lives inside a customer's own product: `EmbedDashboard` is the dashboard itself, and this
 * page adds what an iframe needs. The link's token goes out with every call (see
 * `setEmbedToken`). The theme is applied to this document only and never stored, so an embed
 * cannot change the dashboard theme of someone signed in to Seentics in the same browser. Height
 * is posted to the parent (`seentics:embed:resize`) so the iframe can size itself.
 */

function readParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    token: p.get('token') ?? '',
    client: p.get('client') === '1',
    theme: p.get('theme') === 'light' ? 'light' : p.get('theme') === 'dark' ? 'dark' : null,
  };
}

export default function EmbedPage() {
  const id = usePathSegment(1) ?? '';
  const [params, setParams] = useState<ReturnType<typeof readParams> | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = readParams();
    // Before anything renders, so the very first call already carries the token.
    setEmbedToken(p.token);
    setParams(p);
    // This document only, never storage: see the note above.
    if (p.theme) {
      const apply = () => document.documentElement.classList.toggle('dark', p.theme === 'dark');
      apply();
      const t = setTimeout(apply, 50);
      return () => clearTimeout(t);
    }
  }, []);

  // Tell the parent how tall the content is, so the iframe can fit it without a scrollbar.
  useEffect(() => {
    const el = root.current;
    if (!el || window.parent === window) return;
    const post = () => window.parent.postMessage({ type: 'seentics:embed:resize', height: el.scrollHeight }, '*');
    const ro = new ResizeObserver(post);
    ro.observe(el);
    post();
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={root} className="min-h-[200px] bg-background">
      {params && <EmbedDashboard id={id} token={params.token} clientMode={params.client} />}
    </div>
  );
}
