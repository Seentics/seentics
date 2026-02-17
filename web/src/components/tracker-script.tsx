'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

interface TrackerScriptProps {
  testMode?: boolean;
  siteId?: string;
}

/**
 * Simplified TrackerScript as requested.
 * - Localhost: Uses hardcoded ID 5c05b1c8... and seentics-core.js
 * - Production: Fallback to process.env.NEXT_PUBLIC_DEFAULT_SITE_ID or clean logic
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

  if (isLocalhost) {
    return (
        <Script
          async
          data-site-id="9f3cd976-d8d3-4163-b3d6-de503af05ef6"
          src="http://localhost:3000/trackers/seentics-core.js"
          strategy="afterInteractive"
        />
    );
  }

  // Production: Use specific tracking code as requested
  return (
    <Script
        id="seentics-analytics"
        src="https://www.seentics.com/trackers/seentics-core.js"
        data-website-id="2324e420-987e-4f63-b9ff-f27101bfb1c4"
        data-auto-load="analytics,automation,funnels,heatmap,replay"
        strategy="afterInteractive"
    />
  );
}