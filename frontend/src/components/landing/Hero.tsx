'use client';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/stores/useAuthStore';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import { FaGithub } from "react-icons/fa";

export default function Hero() {
  const { isAuthenticated, user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);

  // Video is muted by default, no need to set volume

  return (
    <section className="flex items-center justify-center relative overflow-hidden py-12 sm:py-16 md:py-32">
      <div className="absolute inset-0 bg-white dark:bg-slate-950" />

      {/* Minimal floating elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-20 left-20 w-64 h-64 bg-slate-200 dark:bg-slate-800 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-20 right-20 w-80 h-80 bg-purple-200 dark:bg-purple-800 rounded-full blur-3xl animate-float-slow" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">



          {/* Clean, powerful headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-6 sm:mb-8 text-slate-900 dark:text-white">
            <span className="block mb-3 sm:mb-4 md:mb-6">
              Track <span className="text-blue-500">visitors</span>,
            </span>

            <span className="block mb-3 sm:mb-4 md:mb-6">
              Respect <span className="text-purple-500">Privacy</span>
            </span>

            <span className="block text-2xl sm:text-3xl md:text-4xl font-bold text-green-600 dark:text-green-400">
              real-time, cookieless & simple
            </span>
          </h1>

          {/* Simple value proposition */}
          <p className="text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto mb-6 sm:mb-8 leading-relaxed px-4 sm:px-0">
            Get website analytics that show what visitors do and where they come from. Understand your traffic without compromising user privacy. Build a better web with <span className="font-semibold text-slate-900 dark:text-white">transparent and ethical tracking.</span>
          </p>

          {/* Clean CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-6 sm:mb-8 px-4 sm:px-0">
            {isAuthenticated && user ? (
              <>
                <Link href="/websites">
                  <Button size="lg" className="px-6 sm:px-8 md:px-10 py-4 sm:py-5 md:py-6 text-base sm:text-lg font-semibold rounded-md w-full sm:w-auto">
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </Link>

                <a href="https://github.com/seentics/seentics" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="lg" className="px-6 sm:px-8 md:px-10 py-4 sm:py-5 md:py-6 text-base sm:text-lg font-semibold border-2 border-slate-300 dark:border-slate-600 rounded-md transition-all duration-300 w-full sm:w-auto">
                    <FaGithub size={20} className="sm:w-6 sm:h-6 md:w-7 md:h-7" />
                    View Source
                  </Button>
                </a>
              </>
            ) : (
              <>
                <Link href="/signup">
                  <Button size="lg" className="px-6 sm:px-8 md:px-10 py-4 sm:py-5 md:py-6 text-base sm:text-lg font-semibold rounded-md w-full sm:w-auto">
                    Start Free Today
                    <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </Link>

                <a href="https://github.com/skshohagmiah/Seentics" target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" size="lg" className="font-semibold text-base sm:text-lg rounded-md px-6 sm:px-8 md:px-10 py-4 sm:py-5 md:py-6 w-full sm:w-auto">
                    <FaGithub size={20} className="sm:w-6 sm:h-6 md:w-7 md:h-7" />
                    GitHub
                  </Button>
                </a>
              </>
            )}
          </div>

          {/* Simple bottom text */}
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-6 sm:mb-8 px-4 sm:px-0 text-center">
            Replaces Google Analytics, HubSpot, Mixpanel and more.
            <span className="font-medium"> No tracking. No limits. Own your data.</span>
          </p>

          {/* Video Section */}
          <div className="relative w-full max-w-7xl mx-auto mt-8 sm:mt-12 md:mt-16 px-4 sm:px-0">
            <div className="relative rounded-xl overflow-hidden shadow-2xl bg-slate-900 dark:bg-slate-800">
              <div className="relative aspect-video">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  controls
                  autoPlay
                  muted
                  loop
                  preload="metadata"
                >
                  <source src="/seentics.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
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
        
        /* Ensure poster image maintains aspect ratio */
        video {
          object-fit: cover !important;
        }
        
        video::poster {
          object-fit: cover !important;
        }
      `}</style>
    </section>
  );
}