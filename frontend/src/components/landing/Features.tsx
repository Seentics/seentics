'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart3, Shield, Zap, Globe, Check } from 'lucide-react';

export default function Features() {
  const features = [
    {
      icon: BarChart3,
      title: "Simple Analytics",
      description: "Track visitors, page views, and traffic sources. No complexity, just what you need.",
    },
    {
      icon: Shield,
      title: "Privacy-First",
      description: "Cookieless tracking. GDPR compliant. No personal data collection.",
    },
    {
      icon: Zap,
      title: "Lightweight & Fast",
      description: "Under 2KB script. Won't slow down your website. Blazing fast performance.",
    },
    {
      icon: Globe,
      title: "Real-time Updates",
      description: "See visitors as they browse. Live updates. Instant insights into your traffic.",
    },
    {
      icon: Check,
      title: "Open Source",
      description: "Fully open source. Self-hostable. Transparent code you can trust and customize.",
    },
    {
      icon: BarChart3,
      title: "Scalable",
      description: "Built to scale. Handle millions of pageviews. Grows with your business.",
    },
  ];

  return (
    <section id="features" className="py-16 md:py-24 bg-slate-50 dark:bg-slate-900/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 dark:text-slate-100 mb-4 sm:mb-6">
            Everything you need.
            <span className="block text-blue-600 dark:text-blue-400 mt-2">Nothing you don't.</span>
          </h2>
          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            No bloat. No complexity. Just simple, powerful analytics.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <Card key={index} className="border-slate-200 dark:border-slate-700 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white dark:bg-slate-800">
              <CardContent className="p-6 text-center">
                <div className="mx-auto p-4 bg-blue-100 dark:bg-blue-900/30 rounded-xl mb-4 w-fit">
                  <feature.icon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                  {feature.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Data Import/Export Section */}
        <div className="mt-16 sm:mt-20 max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-2xl p-8 sm:p-12 border border-blue-200 dark:border-blue-800">
            <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-4 text-center">
              Your Data, Your Control
            </h3>
            <p className="text-lg text-slate-600 dark:text-slate-300 mb-6 text-center leading-relaxed">
              Import and export your analytics data between almost all platforms. No vendor lock-in.
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg p-4 text-center border border-slate-200 dark:border-slate-700">
                <p className="font-semibold text-slate-900 dark:text-white mb-1">Import Data</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">From Google Analytics, Plausible, and more</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-lg p-4 text-center border border-slate-200 dark:border-slate-700">
                <p className="font-semibold text-slate-900 dark:text-white mb-1">Export Data</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">CSV, JSON, or API access</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-lg p-4 text-center border border-slate-200 dark:border-slate-700">
                <p className="font-semibold text-slate-900 dark:text-white mb-1">Own Your Data</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Self-host or use our cloud</p>
              </div>
            </div>
          </div>
        </div>

        {/* Why We're Different */}
        <div className="mt-16 sm:mt-20 max-w-4xl mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 sm:p-12 shadow-lg border border-slate-200 dark:border-slate-700">
            <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-6 text-center">
              Why we built Seentics
            </h3>
            <p className="text-lg text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              Every analytics tool out there is either <span className="font-bold text-slate-900 dark:text-white">too expensive</span>, 
              <span className="font-bold text-slate-900 dark:text-white"> too complex</span>, or 
              <span className="font-bold text-slate-900 dark:text-white"> locks you into their platform</span>.
            </p>
            <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 leading-relaxed">
              We believe analytics should be <span className="font-bold text-blue-600 dark:text-blue-400">simple, free, and open</span>. 
              That's why Seentics is <span className="font-bold text-blue-600 dark:text-blue-400">open source</span>, 
              <span className="font-bold text-blue-600 dark:text-blue-400"> free forever for 1 website</span>, and gives you 
              <span className="font-bold text-blue-600 dark:text-blue-400"> complete control over your data</span>.
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Open Source</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Transparent & trustworthy</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Scalable</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Millions of pageviews</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Your Data</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Import & export freely</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
