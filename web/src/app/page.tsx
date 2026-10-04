import { isEnterprise } from '@/lib/features';
import OSSLanding from '@/components/landing/OSSLanding';
import LandingHeader from '@/components/landing/LandingHeader';
import Hero from '@/components/landing/Hero';
import ObservabilityBonus from '@/components/landing/ObservabilityBonus';
import { FeatureGrid } from '@/components/landing/FeatureSections';
import WhyChoose from '@/components/landing/WhyChoose';
import Pricing from '@/components/landing/Pricing';
import FaqCta from '@/components/landing/FaqCta';
import Footer from '@/components/landing/Footer';

export const dynamic = 'force-static';

export default function LandingPage() {
  if (!isEnterprise) {
    return <OSSLanding />;
  }

  return (
    <div className="landing-light min-h-screen bg-background relative overflow-x-clip">
      <LandingHeader />
      <main>
        <Hero />
        <FeatureGrid />
        <WhyChoose />
        <ObservabilityBonus />
        <Pricing />
        <FaqCta />
      </main>
      <Footer />
    </div>
  );
}
