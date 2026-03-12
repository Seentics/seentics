'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play, X } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/stores/useAuthStore';

export default function Hero() {
  const { isAuthenticated } = useAuth();
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    if (isZoomed) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isZoomed]);

  return (
    <section className="relative pt-32 pb-16 md:pt-44 md:pb-24 bg-background overflow-hidden">
      {/* Dot pattern background */}
      <div className="absolute inset-0 [background-image:radial-gradient(hsl(var(--border)/0.4)_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Radial fade so dots don't have hard edges */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,hsl(var(--background))_70%)]" />

      {/* Top glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/[0.07] rounded-full blur-[120px]" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted/50 border border-border/60 text-xs font-medium text-muted-foreground mb-8"
          >
            Open Source &middot; No Cookies &middot; EU Hosted
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="mb-6"
          >
            <span className="block text-4xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.2]">
              The Open Source
            </span>
            <span className="block text-4xl md:text-6xl font-bold tracking-tight leading-[1.2] mt-1">
              <span className="text-primary underline decoration-primary/30 decoration-4 underline-offset-4">Google Analytics</span>{' '}
              <span className="text-foreground">Alternative</span>
            </span>
            <span className="block text-lg md:text-2xl text-muted-foreground font-normal mt-4 tracking-normal">
              with Session Recording, Heatmaps &amp; Automations
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-3xl mx-auto mb-10 leading-relaxed"
          >
            Simple, fast, and privacy-friendly website analytics. No cookies, no consent banners. See your traffic, top pages, referrers, and conversions in one clean dashboard.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="flex items-center justify-center gap-3 mb-20"
          >
            {isAuthenticated ? (
              <Link href="/websites">
                <Button size="lg" className="h-12 px-8 text-sm font-semibold rounded-full shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Link href="/signup">
                <Button size="lg" className="h-12 px-8 text-sm font-semibold rounded-full shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all">
                  Start for Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
            <Link href="/websites/demo">
              <Button variant="outline" size="lg" className="h-12 px-8 text-sm font-semibold rounded-full border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary hover:text-primary shadow-sm">
                <Play className="h-4 w-4 mr-2 fill-primary/30" />
                Live Demo
              </Button>
            </Link>
          </motion.div>

          {/* Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative max-w-5xl mx-auto"
          >
            {/* Glow behind the image */}
            <div className="absolute -inset-4 bg-primary/[0.04] rounded-2xl blur-2xl" />

            <div
              className="relative group cursor-zoom-in rounded-xl border border-border/50 bg-card p-1.5 shadow-2xl shadow-black/5"
              onClick={() => setIsZoomed(true)}
            >
              <div className="rounded-lg overflow-hidden">
                <Image
                  src="/analytics-dashboard.png"
                  alt="Seentics Analytics Dashboard"
                  width={2400}
                  height={1350}
                  className="w-full h-auto"
                  priority
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Zoom Modal */}
      <AnimatePresence>
        {isZoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsZoomed(false)}
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 md:p-10"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative max-w-7xl w-full max-h-[90vh] rounded-xl overflow-hidden border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setIsZoomed(false)}
                className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <Image
                src="/analytics-dashboard.png"
                alt="Seentics Analytics Dashboard"
                width={2400}
                height={1350}
                className="object-contain w-full h-full"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
