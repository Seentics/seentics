'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { config } from '@/lib/config';

type TrackerScriptProps = {
  /** Dashboard fallback when `NEXT_PUBLIC_SEENTICS_SITE_ID` is unset (URL site UUID). */
  websiteId?: string;
};

// Tracker appends `/api/v1/...`; env often uses `NEXT_PUBLIC_API_URL` with a trailing `/api/v1`.
function normalizeTrackerApiHost(raw: string): string {
  let s = raw.trim().replace(/\/+$/, '');
  while (/\/api\/v1$/i.test(s)) {
    s = s.replace(/\/api\/v1$/i, '');
  }
  return s;
}

/**
 * Loader for `trackers/seentics.js`. Configure via env (preferred):
 * - NEXT_PUBLIC_SEENTICS_SITE_ID
 * - NEXT_PUBLIC_SEENTICS_TRACKER_URL (full script URL, e.g. http://localhost:3000/trackers/seentics.js)
 * - NEXT_PUBLIC_SEENTICS_API_HOST (optional; defaults from NEXT_PUBLIC_API_URL / api base)
 */
export default function TrackerScript({ websiteId }: TrackerScriptProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isPerWebsiteDashboard = /^\/websites\/[^/]+/.test(pathname ?? '');

  if (isPerWebsiteDashboard && !websiteId) {
    return null;
  }

  const envSiteId = process.env.NEXT_PUBLIC_SEENTICS_SITE_ID?.trim() ?? '';
  const envTrackerUrl = process.env.NEXT_PUBLIC_SEENTICS_TRACKER_URL?.trim() ?? '';
  const envApiHost = process.env.NEXT_PUBLIC_SEENTICS_API_HOST?.trim() ?? '';

  const siteId = envSiteId || (websiteId || '').trim();
  const apiHostRaw = envApiHost || process.env.NEXT_PUBLIC_API_URL || config.apiBaseUrl;
  const apiHost = normalizeTrackerApiHost(apiHostRaw);

  const trackerUrl =
    envTrackerUrl ||
    `${window.location.origin}/trackers/seentics.js`;

  if (!siteId || !trackerUrl) return null;

  return (
    <Script
      id="seentics-tracker"
      defer
      src={trackerUrl}
      data-website-id={siteId}
      data-api-host={apiHost}
      strategy="afterInteractive"
    />
  );
}
