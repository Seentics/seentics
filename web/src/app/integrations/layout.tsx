import LandingHeader from '@/components/landing/LandingHeader';
import Footer from '@/components/landing/Footer';

export const metadata = {
  title: 'Integrations · Seentics',
  description: 'Add Seentics to WordPress, WooCommerce, Shopify, Next.js, React, Vue, Nuxt, Astro, Webflow, Google Tag Manager and more.',
};

export default function IntegrationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lx flex min-h-screen flex-col bg-background">
      <LandingHeader alwaysBordered />
      <main className="flex-1 pt-[72px] sm:pt-20">{children}</main>
      <Footer />
    </div>
  );
}
