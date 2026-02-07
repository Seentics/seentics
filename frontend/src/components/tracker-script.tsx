'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

/**
 * Simplified TrackerScript as requested.
 * - Localhost: Uses hardcoded ID 5c05b1c8... and seentics-core.js
 * - Production: Fallback to process.env.NEXT_PUBLIC_DEFAULT_SITE_ID or clean logic
 */
export default function TrackerScript() {
  const [isLocalhost, setIsLocalhost] = useState(false);

  useEffect(() => {
    setIsLocalhost(
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.includes('localhost')
    );
  }, []);

  if (isLocalhost) {
    return (
      <>
        <Script
          defer
          data-website-id="a6e093753d63695749a942e8"
          data-auto-load="analytics,automation,funnels,heatmap"
          src="http://localhost:3000/trackers/seentics-core.js"
          strategy="afterInteractive"
        />
        <Script
          defer
          data-website-id="a6e093753d63695749a942e8"
          src="http://localhost:3000/trackers/seentics-automation.js"
          strategy="afterInteractive"
        />
      </>
    );
  }

  // Production fallback: Use environment variable or simple logic
  // Since user asked to remove complexity, we keep it minimal.
  const prodSiteId = process.env.NEXT_PUBLIC_DEFAULT_SITE_ID;
  if (!prodSiteId) return null;

  return (
    <Script
        src="/trackers/seentics-core.js"
        data-website-id={prodSiteId}
        data-auto-load="analytics,automation,funnels"
        strategy="afterInteractive"
    />
  );
}