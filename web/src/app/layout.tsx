
import { QueryProvider } from '@/components/query-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeCustomizationProvider } from '@/contexts/ThemeCustomizationContext';
import { cn } from '@/lib/utils';
import { SITE_URL } from '@/lib/site';
import type { Metadata } from 'next';
import './globals.css';

import AuthInitializer from '@/components/auth-initializer';
import TrackerScript from '@/components/tracker-script';
import CrispChat from '@/components/crisp-chat';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

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
  metadataBase: new URL(SITE_URL),
  title: 'Seentics | See everything happening on your website',
  description: 'Product analytics, session replay, heatmaps and automations in one privacy-first platform. Observability for SaaS teams.',
  openGraph: {
    title: 'Seentics | See everything happening on your website',
    description: 'Product analytics, session replay, heatmaps and automations in one privacy-first platform. Observability for SaaS teams.',
    url: 'https://seentics.com',
    siteName: 'Seentics',
    images: [
      {
        url: 'https://seentics.com/images/app/photo-1.png',
        width: 2940,
        height: 1598,
        alt: 'Seentics Analytics Dashboard',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Seentics | See everything happening on your website',
    description: 'Product analytics, session replay, heatmaps and automations in one privacy-first platform. Observability for SaaS teams.',
    images: ['https://seentics.com/images/app/photo-1.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn('antialiased font-sans')} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >

          <QueryProvider>
            <ThemeCustomizationProvider>
            <div className="relative min-h-screen isolate overflow-x-clip">
              {/* Ambient Background Blobs */}
              {/* <div className="ambient-blob w-[500px] h-[500px] bg-primary/20 -top-24 -left-24 animate-[pulse_8s_infinite]" />
              <div className="ambient-blob w-[400px] h-[400px] bg-indigo-600/10 top-1/2 -right-24 animate-[pulse_10s_infinite] delay-1000" />
              <div className="ambient-blob w-[600px] h-[600px] bg-indigo-500/10 -bottom-48 left-1/4 animate-[pulse_12s_infinite] delay-500" /> */}

              <div className="relative z-10">
                {children}
              </div>

            </div>
            </ThemeCustomizationProvider>
          </QueryProvider>
          <Toaster />
          <SonnerToaster />
        </ThemeProvider>

        {/* Initialize authentication state */}
        <AuthInitializer />

        {/* Tracking Code Components */}
        <TrackerScript />
        {/* Asks before recording replays and heatmaps, on public pages only */}

        {/* Global Chat Support */}
        <CrispChat />
      </body>
    </html>
  );
}
