import LandingHeader from './LandingHeader';
import Hero from './Hero';
import SocialProof from './SocialProof';
import ProductShowcase from './ProductShowcase';
import FeatureSections from './FeatureSections';
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
        <ProductShowcase />
        <SocialProof />
        <FeatureSections />
        <APISection />
        <UIBlocksSection />
        <PricingSection />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
