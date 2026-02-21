'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

interface TrackerScriptProps {
  testMode?: boolean;
  siteId?: string;
}

/**
 * Simplified TrackerScript as requested.
 * - Localhost: Uses the local site_id from env or hardcoded fallback, with seentics-core.js
 * - Production: Uses the production tracker with the production site_id
 */
export default function TrackerScript({ testMode, siteId }: TrackerScriptProps = {}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isLocalhost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('localhost')
  );

  // Use env var if set, otherwise fall back to the local dev site_id
  const localSiteId = process.env.NEXT_PUBLIC_DEFAULT_SITE_ID || '8a9a0f057175fc7f98d09293';

  if (isLocalhost) {
    return (
      <Script
        async
        data-website-id={localSiteId}
        data-auto-load="analytics,automation,funnels,heatmap,replay"
        src="http://localhost:3000/trackers/seentics-core.js"
        strategy="afterInteractive"
      />
    );
  }

  // Production: Use specific tracking code as requested
  return (
    <Script
      id="seentics-analytics"
      src="https://www.seentics.com/trackers/seentics-core.min.js"
      data-website-id="2324e420-987e-4f63-b9ff-f27101bfb1c4"
      data-auto-load="analytics,automation,funnels,heatmap,replay"
      strategy="afterInteractive"
    />
  );
}