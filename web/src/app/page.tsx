import { isEnterprise } from '@/lib/features';
import OSSLanding from '@/components/landing/OSSLanding';
import LandingHeader from '@/components/landing/LandingHeader';
import Hero from '@/components/landing/Hero';
import SocialProof from '@/components/landing/SocialProof';
import ProductShowcase from '@/components/landing/ProductShowcase';
import FeatureSections from '@/components/landing/FeatureSections';
import Pricing from '@/components/landing/Pricing';
import WhySwitch from '@/components/landing/WhySwitch';
import LifetimeDeal from '@/components/landing/LifetimeDeal';
import FAQ from '@/components/landing/FAQ';
import Footer from '@/components/landing/Footer';

export const dynamic = 'force-static';

export default function LandingPage() {
  if (!isEnterprise) {
    return <OSSLanding />;
  }

  return (
    <div className="landing-light min-h-screen bg-background relative overflow-x-hidden">
      <LandingHeader />
      <main>
        <Hero />
        <ProductShowcase />
        <SocialProof />
        <FeatureSections />
        <WhySwitch />
        <Pricing />
        <LifetimeDeal />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
