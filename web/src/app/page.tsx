import { isEnterprise } from '@/lib/features';
import OSSLanding from '@/components/landing/OSSLanding';
import LandingHeader from '@/components/landing/LandingHeader';
import Hero from '@/components/landing/Hero';
import SuiteTabs from '@/components/landing/SuiteTabs';
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
        <SuiteTabs />
        <WhyChoose />
        <Pricing />
        <FaqCta />
      </main>
      <Footer />
    </div>
  );
}
