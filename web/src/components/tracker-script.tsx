'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

interface TrackerScriptProps {
  testMode?: boolean;
  siteId?: string;
}

/**
 * Unified Seentics tracker script.
 * - Localhost: Uses local dev site_id with local tracker
 * - Production: Uses production tracker with production site_id
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

  const localSiteId = process.env.NEXT_PUBLIC_DEFAULT_SITE_ID || '8a9a0f057175fc7f98d09293';

  if (isLocalhost) {
    return (
      <Script
        async
        data-website-id={localSiteId}
        src="http://localhost:3000/trackers/seentics.js"
        strategy="afterInteractive"
      />
    );
  }

  return (
    <Script
      id="seentics-tracker"
      async
      src="https://www.seentics.com/trackers/seentics.js"
      data-site-id="4d3b4215-7e19-495c-8428-6e03dcaaeb86"
      data-api-host="https://api.seentics.com"
      strategy="afterInteractive"
    />
  );
}