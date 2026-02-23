'use client';

import Script from 'next/script';

export default function LemonSqueezyScript() {
  return (
    <Script
      src="https://assets.lemonsqueezy.com/lemon.js"
      strategy="afterInteractive"
      onLoad={() => {
        if (window.createLemonSqueezy) {
          window.createLemonSqueezy();
        }
      }}
    />
  );
}
