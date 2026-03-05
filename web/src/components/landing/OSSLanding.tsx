import LandingHeader from './LandingHeader';
import Hero from './Hero';
import Features from './Features';
import FAQ from './FAQ';
import Footer from './Footer';

export default function OSSLanding() {
  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      <LandingHeader />
      <main>
        <Hero />
        <Features />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
