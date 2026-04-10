'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { config } from '@/lib/config';

// Tracker appends `/api/v1/...`; env often uses `NEXT_PUBLIC_API_URL` with a trailing `/api/v1`.
function normalizeTrackerApiHost(raw: string): string {
  let s = raw.trim().replace(/\/+$/, '');
  while (/\/api\/v1$/i.test(s)) {
    s = s.replace(/\/api\/v1$/i, '');
  }
  return s;
}

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
  const envApiHost = process.env.NEXT_PUBLIC_SEENTICS_API_HOST?.trim() ?? '';

  // Default to the current origin so /api/v1 hits Next.js rewrites (local dev). Plain localhost:8080
  // bypasses Next and breaks when the API is only reachable via the dev proxy.
  const apiHostRaw =
    envApiHost ||
    process.env.NEXT_PUBLIC_API_URL ||
    window.location.origin ||
    config.apiBaseUrl;
  const apiHost = normalizeTrackerApiHost(apiHostRaw);

  const trackerUrl =
    envTrackerUrl ||
    `${window.location.origin}/api/tracker/seentics.js`;

  if (!siteId) return null;

  return (
    <Script
      id="seentics-tracker"
      defer
      src={trackerUrl}
      data-website-id={siteId}
      {...(apiHost ? { 'data-api-host': apiHost } : {})}
      strategy="afterInteractive"
    />
  );
}
