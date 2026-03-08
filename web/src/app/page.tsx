import { isEnterprise } from '@/lib/features';
import OSSLanding from '@/components/landing/OSSLanding';
import LandingHeader from '@/components/landing/LandingHeader';
import LifetimeBanner from '@/components/landing/LifetimeBanner';
import Hero from '@/components/landing/Hero';
import Features from '@/components/landing/Features';
import AutomationWorkflows from '@/components/landing/AutomationWorkflows';
import Comparison from '@/components/landing/Comparison';
import { LifetimeDeal } from '@/components/landing/LifetimeDeal';
import Pricing from '@/components/landing/Pricing';
import FAQ from '@/components/landing/FAQ';
import Footer from '@/components/landing/Footer';

export const dynamic = 'force-static';

export default function LandingPage() {
  if (!isEnterprise) {
    return <OSSLanding />;
  }

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      <LifetimeBanner />
      <LandingHeader />
      <main>
        <Hero />
        <Features />
        <AutomationWorkflows />
        <Comparison />
        <LifetimeDeal />
        <Pricing />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
