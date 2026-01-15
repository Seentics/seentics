
import { QueryProvider } from '@/components/query-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import './globals.css';

import AuthInitializer from '@/components/auth-initializer';
import CookieConsentManager from '@/components/cookie-consent-manager';
import TrackerScript from '@/components/tracker-script';
import { Toaster } from '@/components/ui/toaster';
import { LimitReachedTopBar } from '@/components/subscription';
// import { Toaster } from "@/components/ui/sonner"

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
          defaultTheme="light"
          disableTransitionOnChange
        >

          <QueryProvider>
              <LimitReachedTopBar />
              {children}
          </QueryProvider>
          <Toaster />
        </ThemeProvider>
        
        {/* Initialize authentication state */}
        <AuthInitializer />
        
        {/* Load the Seentics tracker script */}
        <TrackerScript />
        
        {/* Cookie Consent Manager */}
        <CookieConsentManager />
      </body>
    </html>
  );
}
