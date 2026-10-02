'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';

/**
 * seentics.com asks before recording, as it tells its customers to.
 *
 * The site's tracker runs in `cookieless` mode: page views are counted anonymously
 * for everyone, and session recordings and heatmaps start only for a visitor who
 * accepts here (`seentics.consent(true)`). The tracker keeps the choice itself in
 * `snc_consent` ('1' / '0'), so this banner reads the same key to know whether it has
 * already been answered — one record of consent, not two.
 *
 * Public pages only: the dashboard, sign-in and portals are excluded from recording
 * altogether (the site's exclude patterns), so there is nothing to ask about there.
 */

const CONSENT_KEY = 'snc_consent';
/** Fired by the footer's "Privacy choices" link to ask again. */
export const PRIVACY_CHOICES_EVENT = 'seentics:privacy-choices';

const PRIVATE_PATHS = /^\/(websites|admin|agency|client-portal|accept-invite|setup|share|checkout|preview|signin|signup|forgot-password|reset-password|verify-email|auth)(\/|$)/;

type SeenticsApi = { consent?: (granted: boolean) => void };

function storedChoice(): string | null {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

function recordChoice(granted: boolean) {
  const api = (window as unknown as { seentics?: SeenticsApi }).seentics;
  if (api?.consent) {
    // Starts (or stops) recording now, without a reload, and stores the choice.
    api.consent(granted);
    return;
  }
  // The tracker has not loaded yet: leave the choice where it looks on start.
  try {
    localStorage.setItem(CONSENT_KEY, granted ? '1' : '0');
  } catch {
    /* storage blocked: the choice lasts this page only */
  }
  (window as unknown as { seenticsConsent?: boolean }).seenticsConsent = granted;
}

export default function ConsentBanner() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isPublic = !PRIVATE_PATHS.test(pathname ?? '/');

  useEffect(() => {
    if (isPublic && storedChoice() === null) setOpen(true);
    const reopen = () => setOpen(true);
    window.addEventListener(PRIVACY_CHOICES_EVENT, reopen);
    return () => window.removeEventListener(PRIVACY_CHOICES_EVENT, reopen);
  }, [isPublic]);

  if (!open || !isPublic) return null;

  const choose = (granted: boolean) => {
    recordChoice(granted);
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Privacy choices"
      className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:left-5 sm:bottom-5 sm:max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg"
    >
      <p className="text-sm font-semibold text-foreground">Help us improve Seentics?</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        Page views are counted anonymously, without cookies. With your permission we also record
        how this site is used — session replays and heatmaps — with form fields masked.{' '}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          Privacy notice
        </Link>
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={() => choose(false)}>
          Decline
        </Button>
        <Button size="sm" onClick={() => choose(true)}>
          Accept
        </Button>
      </div>
    </div>
  );
}
