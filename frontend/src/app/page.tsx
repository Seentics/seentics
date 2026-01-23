'use client';
import React from 'react';
import LandingHeader from '@/components/landing/LandingHeader';
import Hero from '@/components/landing/Hero';
import Features from '@/components/landing/Features';
import Pricing from '@/components/landing/Pricing';
import FAQ from '@/components/landing/FAQ';
import Footer from '@/components/landing/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-transparent relative">
    <LandingHeader />
    <main>
      <Hero />
      <Features />
      <Pricing />
      <FAQ />
    </main>
    <Footer />
  </div>
  );
}
