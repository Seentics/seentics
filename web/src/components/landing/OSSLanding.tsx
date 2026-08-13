import LandingHeader from './LandingHeader';
import Hero from './Hero';
import SocialProof from './SocialProof';
import Features from './Features';
import APISection from './CodeExamples';
import UIBlocksSection from './SDKsSection';
import PricingSection from './PricingSection';
import FAQ from './FAQ';
import Footer from './Footer';

export default function OSSLanding() {
  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      <LandingHeader />
      <main>
        <Hero />
        <SocialProof />
        <Features />
        <APISection />
        <UIBlocksSection />
        <PricingSection />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
