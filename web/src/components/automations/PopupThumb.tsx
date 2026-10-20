'use client';

import { useEffect, useRef, useState } from 'react';
import { stripOwnerCode } from '@/components/automations/popup/PopupPreview';
import type { PopupAction } from '@/lib/popup-config';
// The tracker's own renderer, as in the builder's preview: the card shows the real popup.
import { createPopupRenderer } from '../../../public/trackers/popup-render.js';

/** The popup is laid out on a page this size, then scaled into the card. */
const PAGE_W = 720;
const PAGE_H = 540;

/**
 * A small, still picture of an automation's popup on a blank page, for a card. Not
 * interactive: it is drawn once, scaled down and hidden from assistive tech (the card's
 * text says what it is). Custom HTML, CSS and JavaScript are left out, as in the builder.
 */
export function PopupThumb({ action }: { action: PopupAction }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const key = JSON.stringify(stripOwnerCode(action).safe);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren();
    const popups = createPopupRenderer({ root: host, submit: async () => ({}) });
    try {
      const parsed = { ...JSON.parse(key), automation_id: 'thumb' } as PopupAction;
      if (parsed.type === 'show_banner') popups.renderBanner(parsed);
      else popups.renderModal(parsed);
    } catch {
      /* a popup the renderer cannot draw leaves the card's plain background */
    }
    return () => { popups.destroy(); host.replaceChildren(); };
  }, [key]);

  const scale = width ? width / PAGE_W : 0;
  return (
    <div ref={boxRef} aria-hidden className="relative aspect-[4/3] overflow-hidden bg-muted/40">
      <div
        className="pointer-events-none absolute left-0 top-0 isolate origin-top-left [&_*]:!animate-none [&_*]:!transition-none"
        style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})`, visibility: scale ? 'visible' : 'hidden' }}
        inert
      >
        <div ref={hostRef} className="relative size-full" />
      </div>
    </div>
  );
}
