import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, CheckCircle, Zap, TrendingUp, Users } from 'lucide-react';

export default function CTA() {
  return (
    <section className="py-16 md:py-20 lg:py-24  dark:bg-slate-950">
      <div className="container mx-auto px-4">
        <Card className="text-center max-w-5xl md:max-w-6xl mx-auto bg-white dark:bg-slate-800 shadow-2xl relative overflow-hidden border-0">
          {/* Simple CTA Background Illustration */}
          <div className="absolute top-0 right-0 w-1/3 h-full opacity-5">
            <svg viewBox="0 0 200 200" className="w-full h-full">
              <defs>
                <linearGradient id="ctaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="#1E40AF" stopOpacity="0.1"/>
                </linearGradient>
              </defs>
              <circle cx="100" cy="100" r="60" fill="url(#ctaGradient)"/>
              <path d="M50 100 Q75 50 100 100 Q125 150 150 100" stroke="#3B82F6" strokeWidth="2" fill="none" opacity="0.3"/>
              <circle cx="50" cy="100" r="3" fill="#3B82F6" opacity="0.5"/>
              <circle cx="100" cy="100" r="3" fill="#3B82F6" opacity="0.5"/>
              <circle cx="150" cy="100" r="3" fill="#3B82F6" opacity="0.5"/>
            </svg>
          </div>
          
          <CardHeader className="pb-6 md:pb-8 pt-8 md:pt-12">
            <CardTitle className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-3 sm:mb-4 md:mb-6 px-4 sm:px-0">
              Ready to Transform Your Business?
            </CardTitle>
            <CardDescription className="text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-300 px-4 max-w-4xl mx-auto leading-relaxed">
              Join thousands of businesses using Seentics to automatically convert visitors into customers. 
              <span className="text-slate-600 dark:text-slate-400 font-semibold"> Start seeing results in 30 days.</span>
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-8 md:space-y-10 pb-8 md:pb-12">
            {/* Benefits Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-4xl mx-auto mb-8 md:mb-10">
              <div className="flex items-center gap-3 text-center md:text-left">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-green-100 dark:bg-green-900/30 rounded flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-6 w-6 md:h-7 md:w-7 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white text-sm md:text-base">23% Conversion Boost</div>
                  <div className="text-xs md:text-sm text-slate-600 dark:text-slate-400">Average increase</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-center md:text-left">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center flex-shrink-0">
                  <Zap className="h-6 w-6 md:h-7 md:w-7 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white text-sm md:text-base">2-Minute Setup</div>
                  <div className="text-xs md:text-sm text-slate-600 dark:text-slate-400">No coding required</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-center md:text-left">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-purple-100 dark:bg-purple-900/30 rounded flex items-center justify-center flex-shrink-0">
                  <Users className="h-6 w-6 md:h-7 md:w-7 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white text-sm md:text-base">500+ Businesses</div>
                  <div className="text-xs md:text-sm text-slate-600 dark:text-slate-400">Already trust us</div>
                </div>
              </div>
            </div>
            
            {/* Clean CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 md:gap-6 px-4 sm:px-0">
              <Link href="/signup" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto px-6 sm:px-8 py-4 sm:py-5 text-base sm:text-lg">
                  Start Free Trial
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </Link>
              <Link href="/demo" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto px-6 sm:px-8 py-4 sm:py-5 text-base sm:text-lg">
                  Watch Demo
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </Link>
            </div>
            
            {/* Clean Trust Signals */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 md:gap-8 text-xs sm:text-sm md:text-base text-slate-500 dark:text-slate-400 px-4 sm:px-0">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
                <span className="font-medium">No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
                <span className="font-medium">Setup in 2 minutes</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
                <span className="font-medium">Cancel anytime</span>
              </div>
            </div>
            
            {/* Final CTA */}
            <div className="bg-slate-50 dark:bg-slate-700 rounded p-6 md:p-8 border border-slate-200 dark:border-slate-600">
              <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-2 sm:mb-3 md:mb-4 px-4 sm:px-0">
                Still Have Questions?
              </h3>
              <p className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-300 mb-4 md:mb-6 px-4 sm:px-0">
                Our team is here to help you get started and see results fast.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4 px-4 sm:px-0">
                <Button className="w-full sm:w-auto text-sm sm:text-base">
                  Schedule a Call
                </Button>
                <Button variant="outline" className="w-full sm:w-auto text-sm sm:text-base">
                  View Documentation
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
