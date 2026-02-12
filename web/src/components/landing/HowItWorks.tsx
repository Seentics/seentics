'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, BarChart3, CheckCircle, Clock, Code, Play, Rocket, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../ui/button';

const steps = [
  {
    step: "01",
    icon: Code,
    title: "Add One Line of Code",
    description: "Copy and paste one simple line into your website. That's it - no technical skills needed.",
    details: [
      "Works on any website",
      "Takes less than 2 minutes",
      "No impact on site speed",
      "Start tracking immediately"
    ],
    benefits: "Setup in 2 minutes"
  },
  {
    step: "02",
    icon: BarChart3,
    title: "Watch Your Data Grow",
    description: "See who visits your site, what they do, and where they come from. All in real-time.",
    details: [
      "See visitors as they browse",
      "Track which pages work best",
      "Know where traffic comes from",
      "Monitor sales and signups"
    ],
    benefits: "Instant insights"
  },
  {
    step: "03",
    icon: TrendingUp,
    title: "Grow Your Business",
    description: "Use what you learn to make your website better. Create automations that turn visitors into customers.",
    details: [
      "Build welcome messages",
      "Send targeted emails",
      "Test different approaches",
      "Increase your sales"
    ],
    benefits: "More customers"
  }
];
export default function HowItWorks() {
  return (
    <section className="py-20 bg-slate-50 dark:bg-slate-900 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-blue-200/20 dark:bg-blue-800/10 rounded-full blur-2xl"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-purple-200/20 dark:bg-purple-800/10 rounded-full blur-2xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-100/10 dark:bg-blue-900/5 rounded-full blur-3xl"></div>
      </div>

      <div className=" px-4 relative z-10">

        {/* Enhanced Header */}
        <div className="text-center mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-700 dark:text-blue-300 text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            Simple Process
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 text-slate-900 dark:text-white px-4 sm:px-0">
            How It Works
          </h2>

          <p className="text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto px-4 sm:px-0">
            Get up and running in minutes. No complicated setup, no technical headaches.
          </p>
        </div>

        {/* Enhanced Steps with Timeline */}
        <div className="relative max-w-7xl mx-auto  mb-20">
          {/* Timeline Line - Hidden on mobile */}
          <div className="hidden md:block absolute top-24 left-0 right-0 h-0.5 bg-blue-200 dark:bg-blue-800/50"></div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {steps.map((step, index) => (
              <div key={index} className="relative group">

                {/* Timeline Dot */}
                <div className="hidden md:block absolute top-20 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white dark:bg-slate-800 border-4 border-blue-500 rounded-full z-20 group-hover:scale-125 transition-transform duration-300"></div>

                {/* Connection Arrow - Mobile */}
                {index < steps.length - 1 && (
                  <div className="md:hidden flex justify-center my-6">
                    <ArrowRight className="h-6 w-6 text-slate-300 dark:text-slate-600 rotate-90" />
                  </div>
                )}

                {/* Enhanced Card */}
                <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-lg hover:shadow-2xl transition-all duration-500 border border-slate-200/50 dark:border-slate-700/50 h-full group-hover:-translate-y-2 relative overflow-hidden">
                  {/* Card Gradient Overlay */}
                  <div className="absolute inset-0 bg-blue-50/50 dark:bg-blue-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <CardHeader className="text-center pb-6 relative z-10">

                    {/* Combined Step Number and Icon */}
                    <div className="relative mx-auto mb-6">
                      <div className="w-20 h-20 bg-blue-600 rounded flex items-center justify-center mx-auto shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110">
                        <step.icon className="h-10 w-10 text-white" />
                      </div>
                      <div className="absolute -top-2 -right-2 w-8 h-8 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-md border-2 border-blue-500">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{step.step}</span>
                      </div>
                    </div>

                    {/* Title */}
                    <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-4 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">
                      {step.title}
                    </CardTitle>

                    {/* Description */}
                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                      {step.description}
                    </p>

                    {/* Enhanced Benefits Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/30 rounded-full border border-green-200/50 dark:border-green-700/50">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium text-green-700 dark:text-green-300">{step.benefits}</span>
                    </div>
                  </CardHeader>

                  <CardContent className="relative z-10">
                    {/* Enhanced Feature List */}
                    <ul className="space-y-4">
                      {step.details.map((detail, detailIndex) => (
                        <li key={detailIndex} className="flex items-start gap-3 group/item">
                          <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 group-hover/item:scale-110 transition-transform duration-200">
                            <CheckCircle className="h-3 w-3 text-white" />
                          </div>
                          <span className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed group-hover/item:text-slate-900 dark:group-hover/item:text-slate-200 transition-colors duration-200">
                            {detail}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>

        {/* Enhanced Bottom CTA */}
        <div className="text-center">
          <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded p-8 sm:p-12 border border-slate-200/50 dark:border-slate-700/50 shadow-xl max-w-4xl mx-auto">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4">
              Ready to Transform Your Website?
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-2xl mx-auto">
              Join thousands of businesses already using Seentics to boost their conversions
            </p>

            <Link href={'/signup'}>

              <Button className="mb-8 px-8 py-4 text-lg font-semibold bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-300 group">
                <Rocket className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                <span>Get Started Now</span>
                <Play className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
              </Button>
            </Link>

            {/* Enhanced Trust Indicators */}
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-sm text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-full">
                <Clock className="h-4 w-4 text-blue-500" />
                <span>2-minute setup</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-full">
                <Users className="h-4 w-4 text-purple-500" />
                <span>No coding required</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-full">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Free to start</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}