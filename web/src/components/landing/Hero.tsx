import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Github, X } from 'lucide-react';
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
    <section className="relative pt-32 pb-16 md:pt-44 md:pb-24 bg-background">
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-sm text-muted-foreground font-medium mb-6"
          >
            Self-hosted &middot; Privacy-first &middot; Open source
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-4xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.1] mb-6"
          >
            Analytics that respects
            <br />
            your users
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed"
          >
            Live analytics, heatmaps, session recordings, and funnels — all in one platform. No cookies, fully GDPR compliant, and you own every byte of data.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="flex items-center justify-center gap-3 mb-20"
          >
            {isAuthenticated ? (
              <Link href="/websites">
                <Button size="lg" className="h-11 px-6 text-sm font-semibold rounded-lg">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Link href="/signup">
                <Button size="lg" className="h-11 px-6 text-sm font-semibold rounded-lg">
                  Start for Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
            <Link href="https://github.com/Seentics/seentics" target="_blank">
              <Button variant="outline" size="lg" className="h-11 px-6 text-sm font-semibold rounded-lg">
                <Github className="h-4 w-4 mr-2" />
                GitHub
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
            <div
              className="relative group cursor-zoom-in rounded-xl border border-border/50 bg-card p-1.5 shadow-lg"
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
