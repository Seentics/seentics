'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

/**
 * Unified Seentics tracker script.
 * Uses environment variables so cloned OSS repos don't inherit production tracking.
 * Set NEXT_PUBLIC_SEENTICS_SITE_ID and NEXT_PUBLIC_SEENTICS_TRACKER_URL in .env
 */
export default function TrackerScript() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const siteId = process.env.NEXT_PUBLIC_SEENTICS_SITE_ID;
  const trackerUrl = process.env.NEXT_PUBLIC_SEENTICS_TRACKER_URL;
  const apiHost = process.env.NEXT_PUBLIC_SEENTICS_API_HOST;

  // Don't render tracker if env vars are not configured
  if (!siteId || !trackerUrl) return null;

  return (
    <Script
      id="seentics-tracker"
      async
      src={trackerUrl}
      data-website-id={siteId}
      {...(apiHost ? { 'data-api-host': apiHost } : {})}
      strategy="afterInteractive"
    />
  );
}
