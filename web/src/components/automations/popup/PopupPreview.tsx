'use client';

import { useEffect, useRef, useState } from 'react';
import { Monitor, RotateCcw, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { previewPrize, type PopupAction } from '@/lib/popup-config';
import { useT } from '@/lib/i18n';
// The same renderer the tracker runs on a visitor's page. Importing it here, rather than
// drawing a lookalike, is what keeps the preview from drifting from the real thing.
import { createPopupRenderer } from '../../../../public/trackers/popup-render.js';

const EVERGREEN_KEY = 'snc_cd:preview';
const DEBOUNCE_MS = 150;

/** Owner code that must never run in the dashboard: see the note on `stripOwnerCode`. */
const OWNER_CODE_KEYS = ['custom_html', 'custom_css', 'custom_js'] as const;

/**
 * The action without its custom HTML, CSS and JavaScript.
 *
 * Those run on the *site owner's* pages, on the site owner's own responsibility. This
 * preview runs inside the dashboard, in a signed-in session that other members of the team
 * share — so rendering a teammate's `custom_js` here would hand them that session. The
 * built-in content is previewed; the custom code is reported as skipped.
 */
export function stripOwnerCode<T extends Record<string, unknown>>(action: T): { safe: Omit<T, (typeof OWNER_CODE_KEYS)[number]>; stripped: boolean } {
  const safe: Record<string, unknown> = { ...action };
  let stripped = false;
  for (const key of OWNER_CODE_KEYS) {
    if (typeof safe[key] === 'string' && (safe[key] as string).trim() !== '') stripped = true;
    delete safe[key];
  }
  return { safe: safe as Omit<T, (typeof OWNER_CODE_KEYS)[number]>, stripped };
}

/**
 * A live preview of a modal or bar, rebuilt as the owner edits.
 *
 * Interactive on purpose: the form can be submitted (nothing is sent anywhere — the wheel
 * draws its prize locally with the same weighting the server uses), steps can be clicked
 * through, the teaser tab opened. Links do not navigate away from the builder.
 */
export function PopupPreview({ action }: { action: PopupAction }) {
  const m = useT().automations.popup.preview;
  const hostRef = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [run, setRun] = useState(0);

  const { safe, stripped } = stripOwnerCode(action);
  // A string key, so an unrelated re-render of the builder does not rebuild the preview.
  const key = JSON.stringify(safe);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let popups: ReturnType<typeof createPopupRenderer> | null = null;

    const timer = setTimeout(() => {
      // An evergreen timer remembers its start; the preview starts it afresh each render,
      // so editing the duration is visible at once.
      try { window.localStorage.removeItem(EVERGREEN_KEY); } catch { /* storage unavailable */ }
      host.replaceChildren();
      popups = createPopupRenderer({
        root: host,
        submit: async (a: PopupAction) => ({ prize: previewPrize(a) }),
      });
      const parsed = { ...JSON.parse(key), automation_id: 'preview' } as PopupAction;
      if (parsed.type === 'show_banner') popups.renderBanner(parsed);
      else popups.renderModal(parsed);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      popups?.destroy();
      host.replaceChildren();
    };
  }, [key, run, device]);

  // A link in the preview is for looking at, not following out of the builder.
  const blockNavigation = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('a')) e.preventDefault();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">{m.title}</p>
        <div className="flex items-center gap-1">
          <Button type="button" size="icon" variant={device === 'desktop' ? 'secondary' : 'ghost'} className="h-7 w-7" aria-label={m.desktop} aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}>
            <Monitor className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="icon" variant={device === 'mobile' ? 'secondary' : 'ghost'} className="h-7 w-7" aria-label={m.mobile} aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}>
            <Smartphone className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={m.restart} onClick={() => setRun((n) => n + 1)}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'overflow-hidden rounded-lg border border-border bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,hsl(var(--muted)/0.4)_10px,hsl(var(--muted)/0.4)_20px)]',
          device === 'mobile' ? 'mx-auto w-[375px] max-w-full' : 'w-full',
        )}
      >
        <div ref={hostRef} onClick={blockNavigation} className="h-[480px]" data-testid="popup-preview" />
      </div>

      <p className="text-[11px] text-muted-foreground">
        {m.note}
        {stripped && m.stripped}
      </p>
    </div>
  );
}
