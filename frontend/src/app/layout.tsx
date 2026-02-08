
import { QueryProvider } from '@/components/query-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import './globals.css';

import AuthInitializer from '@/components/auth-initializer';
import CookieConsentManager from '@/components/cookie-consent-manager';
import TrackerScript from '@/components/tracker-script';
// import TawkMessenger from '@/components/tawk-messenger';
import { Toaster } from '@/components/ui/toaster';
import { LimitReachedTopBar } from '@/components/subscription';
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import Script from 'next/script';

// Temporarily disable custom fonts for build
// const fontBody = Inter({
//   subsets: ['latin'],
//   variable: '--font-body',
// });

// const fontHeadline = Space_Grotesk({
//   subsets: ['latin'],
//   weight: ['400', '700'],
//   variable: '--font-headline',
// });

export const metadata: Metadata = {
  title: 'Seentics | Analytics that actually drives growth',
  description: 'Privacy-focused real-time website analytics with built-in behavioral automations. Understand your traffic and act on it automatically.',
  openGraph: {
    title: 'Seentics | Analytics that actually drives growth',
    description: 'Privacy-focused real-time website analytics with built-in behavioral automations. Understand your traffic and act on it automatically.',
    url: 'https://seentics.com',
    siteName: 'Seentics',
    images: [
      {
        url: 'https://seentics.com/analytics-dashboard.png',
        width: 1200,
        height: 630,
        alt: 'Seentics Analytics Dashboard',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Seentics | Analytics that actually drives growth',
    description: 'Privacy-focused real-time website analytics with built-in behavioral automations.',
    images: ['https://seentics.com/analytics-dashboard.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn('antialiased font-sans')}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >

          <QueryProvider>
            {/* <LimitReachedTopBar /> */}
            <div className="relative min-h-screen isolate overflow-x-hidden">
              {/* Ambient Background Blobs */}
              <div className="ambient-blob w-[500px] h-[500px] bg-primary/20 -top-24 -left-24 animate-[pulse_8s_infinite]" />
              <div className="ambient-blob w-[400px] h-[400px] bg-violet-600/10 top-1/2 -right-24 animate-[pulse_10s_infinite] delay-1000" />
              {/* <div className="ambient-blob w-[600px] h-[600px] bg-indigo-500/10 -bottom-48 left-1/4 animate-[pulse_12s_infinite] delay-500" /> */}

              <div className="relative z-10">
                {children}
              </div>
            </div>
          </QueryProvider>
          <Toaster />
          <SonnerToaster />
        </ThemeProvider>

        {/* Initialize authentication state */}
        <AuthInitializer />

        {/* Seentics Analytics */}
        <Script 
          async 
          src="https://www.seentics.com/trackers/seentics-core.js" 
          data-website-id="b6b8419e270d8a6dd69f0c2a"
        />

        {/* Tracking Code Components */}
        <TrackerScript />

        {/* Cookie Consent Manager */}
        <CookieConsentManager />

        {/* Global Chat Support */}
        {/* <TawkMessenger /> */}

        {/* Lemon Squeezy Checkout Script */}
        <Script src="https://assets.lemonsqueezy.com/lemon.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
