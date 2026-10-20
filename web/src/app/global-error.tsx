'use client';

import { useEffect, useState } from 'react';
import { readLocaleCookie, type Locale } from '@/lib/i18n/locale';
import { dashboardEn } from '@/lib/i18n/messages/dashboard-en';
import { dashboardBn } from '@/lib/i18n/messages/dashboard-bn';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // This replaces the root layout, language provider included: the visitor's chosen language
  // is read from its cookie once mounted.
  const [locale, setLocale] = useState<Locale>('en');
  useEffect(() => setLocale(readLocaleCookie() ?? 'en'), []);
  const t = (locale === 'bn' ? dashboardBn : dashboardEn).errorPages;
  return (
    <html lang={locale}>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0a0a0a', color: '#fafafa' }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}>
          <div style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              fontSize: '32px',
            }}>
              !
            </div>

            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
              {t.criticalTitle}
            </h1>
            <p style={{ color: '#a1a1aa', marginBottom: '32px', lineHeight: 1.6 }}>
              {t.criticalBody}
            </p>

            <button
              onClick={reset}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                background: '#1d4ed8',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              {t.refresh}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
