'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
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
              Critical Error
            </h1>
            <p style={{ color: '#a1a1aa', marginBottom: '32px', lineHeight: 1.6 }}>
              The application encountered a critical error. Please try refreshing the page.
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
              Refresh page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
