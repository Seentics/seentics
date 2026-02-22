'use client';
import React from 'react';
import { isEnterprise } from '@/lib/features';
import LandingHeader from '@/components/landing/LandingHeader';
import Hero from '@/components/landing/Hero';
import StickyScrollStack from '@/components/landing/StickyScrollStack';
import BYODBSection from '@/components/landing/BYODBSection';
import AutomationWorkflows from '@/components/landing/AutomationWorkflows';
import ImportExportSection from '@/components/landing/ImportExportSection';
import VisionSection from '@/components/landing/VisionSection';
import Features from '@/components/landing/Features';

import Pricing from '@/components/landing/Pricing';
import { LifetimeDeal } from '@/components/landing/LifetimeDeal';
import FAQ from '@/components/landing/FAQ';
import Footer from '@/components/landing/Footer';
import Link from 'next/link';
import { Logo } from '@/components/ui/logo';
import { ArrowRight, BarChart3, Shield, Zap, MousePointer2, Video, Filter, Workflow, Terminal, Github, Server, Database } from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/stores/useAuthStore';

const ossFeatures = [
  {
    icon: BarChart3,
    title: 'Real-time Analytics',
    description: 'Track pageviews, visitors, referrers, UTM campaigns, and custom events with sub-second latency.',
  },
  {
    icon: MousePointer2,
    title: 'Heatmaps',
    description: 'Visualize exactly where users click, scroll, and move on every page of your site.',
  },
  {
    icon: Video,
    title: 'Session Replays',
    description: 'Watch real user sessions to understand behavior, debug issues, and improve UX.',
  },
  {
    icon: Filter,
    title: 'Conversion Funnels',
    description: 'Build multi-step funnels to identify where users drop off and optimize conversions.',
  },
  {
    icon: Workflow,
    title: 'Behavioral Automations',
    description: 'Trigger emails, webhooks, and actions based on user behavior and events.',
  },
  {
    icon: Shield,
    title: 'Privacy First',
    description: 'No cookies by default. GDPR & CCPA compliant. Your data never leaves your servers.',
  },
];

function OSSLanding() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      {/* Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-500/5 blur-[100px] rounded-full animate-pulse delay-1000" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between px-6 md:px-12 py-6 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <Logo size="lg" />
            <span className="text-xl font-black tracking-tighter text-foreground">SEENTICS</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://discord.gg/TYdPvDRA" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="font-medium gap-1.5 text-muted-foreground hover:text-foreground">
                <FaDiscord size={16} /> Discord
              </Button>
            </a>
            {isAuthenticated ? (
              <Link href="/websites">
                <Button size="sm" className="font-bold">Dashboard <ArrowRight size={14} className="ml-1" /></Button>
              </Link>
            ) : (
              <>
                <Link href="/signin">
                  <Button variant="ghost" size="sm" className="font-bold">Sign In</Button>
                </Link>
                <Link href="/setup">
                  <Button size="sm" className="font-bold">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </header>

        {/* Hero */}
        <section className="px-6 md:px-12 pt-20 pb-24 max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest mb-10">
            <Server size={14} /> Open Source &middot; Self-Hosted &middot; Free Forever
          </div>

          <h1 className="text-4xl md:text-6xl  font-black tracking-tight text-foreground leading-[1.08] mb-8">
            The Open-Source Alternative to{' '}
            <br />
            <span className="text-primary">Hotjar + Google Analytics</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground/80 max-w-2xl mx-auto mb-12 leading-relaxed">
            Track visitors, watch session replays, analyze funnels, and automate actions — all from your own infrastructure.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            {isAuthenticated ? (
              <Link href="/websites">
                <Button size="lg" className="h-14 px-8 text-base font-bold rounded-xl shadow-xl shadow-primary/20">
                  Go to Dashboard <ArrowRight size={18} className="ml-2" />
                </Button>
              </Link>
            ) : (
              <Link href="/setup">
                <Button size="lg" className="h-14 px-8 text-base font-bold rounded-xl shadow-xl shadow-primary/20">
                  Set Up Instance <ArrowRight size={18} className="ml-2" />
                </Button>
              </Link>
            )}
            <a href="https://github.com/Seentics/seentics" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="lg" className="h-14 px-8 text-base font-bold rounded-xl">
                <Github size={18} className="mr-2" /> View on GitHub
              </Button>
            </a>
          </div>

          {/* Quick Install */}
          <div className="max-w-lg mx-auto">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
              <Terminal size={14} /> Quick Install
            </div>
            <div className="bg-card border border-border/50 rounded-xl p-4 text-left font-mono text-sm">
              <p className="text-muted-foreground mb-1">
                <span className="text-primary select-none">$ </span>
                <span className="text-foreground select-all">git clone https://github.com/Seentics/seentics.git</span>
              </p>
              <p className="text-muted-foreground mb-1">
                <span className="text-primary select-none">$ </span>
                <span className="text-foreground select-all">cd seentics</span>
              </p>
              <p className="text-muted-foreground">
                <span className="text-primary select-none">$ </span>
                <span className="text-foreground select-all">docker compose up -d</span>
              </p>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="px-6 md:px-12 py-20 max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-foreground mb-4">
              Everything you need, nothing you don't
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              All features unlocked. No usage limits. No premium tiers. Just powerful analytics on your infrastructure.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ossFeatures.map((feature) => (
              <Card key={feature.title} className="bg-card/50 border-border/40 hover:border-primary/30 transition-colors">
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon size={20} className="text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Tech Stack */}
        <section className="px-6 md:px-12 py-20 max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-black tracking-tight text-foreground mb-8">Built with proven technology</h2>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {[
              { icon: Database, label: 'PostgreSQL' },
              { icon: Zap, label: 'ClickHouse' },
              { icon: Server, label: 'Go Backend' },
              { icon: BarChart3, label: 'Next.js' },
              { icon: Database, label: 'Redis' },
              { icon: Server, label: 'Kafka' },
            ].map((tech) => (
              <div key={tech.label} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border/40 text-sm font-medium text-muted-foreground">
                <tech.icon size={16} className="text-primary/70" />
                {tech.label}
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 md:px-12 py-12 border-t border-border/30 max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Logo size="sm" />
              <span className="text-sm font-bold text-muted-foreground">Seentics &middot; Open Source Analytics</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="https://github.com/Seentics/seentics" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-center gap-1.5">
                <Github size={14} /> GitHub
              </a>
              <Link href="/docs" className="hover:text-primary transition-colors">Docs</Link>
              <Link href="/contact" className="hover:text-primary transition-colors">Contact</Link>
            </div>
            <p className="text-xs text-muted-foreground/60">AGPL v3 &middot; Free forever</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function LandingPage() {
  if (!isEnterprise) {
    return <OSSLanding />;
  }

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      <LandingHeader />
      <main>
        <Hero />
        <Features />
        <AutomationWorkflows />
        <Pricing />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
