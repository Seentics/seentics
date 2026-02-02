
import { QueryProvider } from '@/components/query-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import './globals.css';

import AuthInitializer from '@/components/auth-initializer';
import CookieConsentManager from '@/components/cookie-consent-manager';
import TrackerScript from '@/components/tracker-script';
import TawkMessenger from '@/components/tawk-messenger';
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
  title: 'Seentics',
  description: 'Privacy-focused real-time website analytics. Understand your traffic without compromise.',
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
          defaultTheme="system"
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

        {/* Load the Seentics tracker script */}
        <TrackerScript />

        {/* Cookie Consent Manager */}
        <CookieConsentManager />

        {/* Global Chat Support */}
        <TawkMessenger />

        {/* Lemon Squeezy Checkout Script */}
        <Script src="https://assets.lemonsqueezy.com/lemon.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
