import { isEnterprise } from '@/lib/features';
import OSSLanding from '@/components/landing/OSSLanding';
import LandingHeader from '@/components/landing/LandingHeader';
import Hero from '@/components/landing/Hero';
import PlatformStrip from '@/components/landing/PlatformStrip';
import Statement from '@/components/landing/Statement';
import FeatureRows from '@/components/landing/FeatureRows';
import Pricing from '@/components/landing/Pricing';
import FaqCta from '@/components/landing/FaqCta';
import ClosingCta from '@/components/landing/ClosingCta';
import Footer from '@/components/landing/Footer';

export const dynamic = 'force-static';

export default function LandingPage() {
  if (!isEnterprise) {
    return <OSSLanding />;
  }

  return (
    <div className="lx relative min-h-screen overflow-x-clip bg-background">
      <LandingHeader />
      <main>
        <Hero />
        <PlatformStrip />
        <Statement />
        <FeatureRows />
        <Pricing />
        <FaqCta />
        <ClosingCta />
      </main>
      <Footer />
    </div>
  );
}
