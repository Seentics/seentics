'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { normalizeTrackerApiHost } from '@/lib/config';

/**
 * Loads the Seentics tracker **only** when self-tracking is configured via env.
 *
 * We intentionally do **not** infer `data-website-id` from the URL (e.g. `/websites/[id]`).
 * Otherwise every dashboard session would pollute the **customer** website that is open in the UI.
 *
 * Set one of:
 * - NEXT_PUBLIC_SEENTICS_SITE_ID
 * - NEXT_PUBLIC_SEENTICS_WEBSITE_ID
 *
 * Optional: NEXT_PUBLIC_SEENTICS_TRACKER_URL, NEXT_PUBLIC_SEENTICS_API_HOST
 *
 * Default script URL is `/trackers/seentics.js` (built from `trackers/index.ts` via `npm run bundle-trackers`).
 */
export default function TrackerScript() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const siteId =
    process.env.NEXT_PUBLIC_SEENTICS_SITE_ID?.trim() ||
    process.env.NEXT_PUBLIC_SEENTICS_WEBSITE_ID?.trim() ||
    '';

  const envTrackerUrl = process.env.NEXT_PUBLIC_SEENTICS_TRACKER_URL?.trim() ?? '';
  const apiHostOverride = process.env.NEXT_PUBLIC_SEENTICS_API_HOST?.trim();

  // Same static bundle as install snippets: `bundle-trackers` → public/trackers/seentics.js
  const trackerUrl =
    envTrackerUrl ||
    `${window.location.origin}/trackers/seentics.js`;

  if (!siteId) return null;

  return (
    <Script
      id="seentics-tracker"
      defer
      src={trackerUrl}
      data-website-id={siteId}
      {...(apiHostOverride ? { 'data-api-host': normalizeTrackerApiHost(apiHostOverride) } : {})}
      strategy="afterInteractive"
    />
  );
}
