'use client';
import React from 'react';
import LandingHeader from '@/components/landing/LandingHeader';
import Hero from '@/components/landing/Hero';
import StickyScrollStack from '@/components/landing/StickyScrollStack';
import BYODBSection from '@/components/landing/BYODBSection';
import AutomationWorkflows from '@/components/landing/AutomationWorkflows';
import ImportExportSection from '@/components/landing/ImportExportSection';
import VisionSection from '@/components/landing/VisionSection';
import Features from '@/components/landing/Features';
import Comparison from '@/components/landing/Comparison';
import Pricing from '@/components/landing/Pricing';
import { LifetimeDeal } from '@/components/landing/LifetimeDeal';
import FAQ from '@/components/landing/FAQ';
import Footer from '@/components/landing/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      <LandingHeader />
      <main>
        <Hero /> 
        <div className="relative">
          <Comparison />
          <Features />
          <AutomationWorkflows />
          <Pricing />
          <FAQ />
        </div>
      </main>
      <Footer />
    </div>
  );
}
