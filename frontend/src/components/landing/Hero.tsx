'use client';

import { Button } from '@/components/ui/button';
import { ArrowRight, Play, Check } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function Hero() {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Demo screenshots for the slider
  const demoImages = [
    { src: '/demo/dashboard.png', alt: 'Analytics Dashboard' },
    { src: '/demo/realtime.png', alt: 'Real-time Visitor Tracking' },
    { src: '/demo/reports.png', alt: 'Detailed Reports' },
  ];

  return (
    <section className="flex items-center justify-center relative overflow-hidden py-16 sm:py-20 md:py-32">
      <div className="absolute inset-0 bg-gradient-to-br from-white via-blue-50/30 to-purple-50/20 dark:from-slate-950 dark:via-blue-950/10 dark:to-purple-950/10" />

      {/* Minimal floating elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-20 left-20 w-64 h-64 bg-blue-200 dark:bg-blue-800 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-20 right-20 w-80 h-80 bg-purple-200 dark:bg-purple-800 rounded-full blur-3xl animate-float-slow" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="max-w-5xl mx-auto text-center">

          {/* Open Source + Free Badge */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-full text-green-700 dark:text-green-300 text-sm font-semibold shadow-sm">
              <Check className="h-4 w-4" />
              1 Website Free Forever
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-700 dark:text-purple-300 text-sm font-semibold shadow-sm">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Open Source
            </div>
          </div>

          {/* Clean, powerful headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-tight mb-6 sm:mb-8 text-slate-900 dark:text-white">
            <span className="block mb-2">
              Simple Analytics.
            </span>
            <span className="block text-blue-600 dark:text-blue-400">
              Actually Free.
            </span>
          </h1>

          {/* Simple value proposition */}
          <p className="text-lg sm:text-xl md:text-2xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto mb-8 sm:mb-10 leading-relaxed px-4 sm:px-0">
            Other analytics tools are <span className="font-bold text-slate-900 dark:text-white">heavy, complex, and expensive</span>. 
            <br className="hidden sm:block" />
            We're <span className="font-bold text-blue-600 dark:text-blue-400">open source, scalable, and free forever</span> for 1 website.
          </p>

          {/* Clean CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-10 sm:mb-12 px-4 sm:px-0">
            <Link href="/signup">
              <Button size="lg" className="px-8 sm:px-10 md:px-12 py-5 sm:py-6 md:py-7 text-lg sm:text-xl font-bold rounded-lg w-full sm:w-auto shadow-xl hover:shadow-2xl transition-all duration-300 bg-blue-600 hover:bg-blue-700">
                Start Free Now
                <ArrowRight className="ml-2 h-5 w-5 sm:h-6 sm:w-6" />
              </Button>
            </Link>

            <Link href="/websites/demo">
              <Button 
                variant="outline" 
                size="lg" 
                className="px-8 sm:px-10 md:px-12 py-5 sm:py-6 md:py-7 text-lg sm:text-xl font-bold border-2 border-slate-300 dark:border-slate-600 rounded-lg transition-all duration-300 w-full sm:w-auto hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Play className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
                View Demo
              </Button>
            </Link>
          </div>

          {/* Key benefits */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm sm:text-base text-slate-600 dark:text-slate-400 mb-12">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              <span>Open source</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              <span>Free forever</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              <span>Scalable</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              <span>Data export</span>
            </div>
          </div>

          {/* Image Slider Section */}
          <div className="relative w-full max-w-6xl mx-auto mt-8 sm:mt-12 md:mt-16 px-4 sm:px-0">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700">
              <div className="relative aspect-video">
                {/* Slider Images */}
                {demoImages.map((image, index) => (
                  <div
                    key={index}
                    className={`absolute inset-0 transition-opacity duration-700 ${
                      index === currentSlide ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    <div className="relative w-full h-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                      <div className="text-center p-8">
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="bg-white dark:bg-slate-700 rounded-xl p-8 sm:p-12 shadow-xl max-w-2xl">
                            <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-4">
                              {image.alt}
                            </h3>
                            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300">
                              Clean, simple interface. No complexity. Just the insights you need.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Navigation Dots */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
                  {demoImages.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentSlide(index)}
                      className={`w-3 h-3 rounded-full transition-all duration-300 ${
                        index === currentSlide
                          ? 'bg-blue-600 w-8'
                          : 'bg-slate-400 dark:bg-slate-600 hover:bg-slate-500'
                      }`}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>

                {/* Navigation Arrows */}
                <button
                  onClick={() => setCurrentSlide((prev) => (prev === 0 ? demoImages.length - 1 : prev - 1))}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-700 rounded-full p-3 shadow-lg transition-all duration-200 z-10"
                  aria-label="Previous slide"
                >
                  <svg className="w-6 h-6 text-slate-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentSlide((prev) => (prev === demoImages.length - 1 ? 0 : prev + 1))}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-700 rounded-full p-3 shadow-lg transition-all duration-200 z-10"
                  aria-label="Next slide"
                >
                  <svg className="w-6 h-6 text-slate-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Simple animations */}
      <style jsx>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 0.4; }
        }
        
        .animate-float-slow {
          animation: float-slow 8s ease-in-out infinite;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 6s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
}