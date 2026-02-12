import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play, LayoutDashboard, MousePointer2, ShieldCheck, CheckCircle, Zap, X, Maximize2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/stores/useAuthStore';

export default function Hero() {
  const { isAuthenticated } = useAuth();
  const [isZoomed, setIsZoomed] = useState(false);

  // Prevent scroll when zoomed
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
    }
  };

  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-background">
      {/* Background decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[20%] right-[-5%] w-[30%] h-[30%] bg-blue-500/5 blur-[100px] rounded-full" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full dark:bg-slate-900/50 backdrop-blur-md border border-slate-800 dark:text-slate-300 text-xs md:text-sm font-bold tracking-tight mb-4 group hover:border-primary/30 transition-colors"
          >
            <ShieldCheck size={16} className="text-primary group-hover:scale-110 transition-transform" />
            <span>Privacy First & GDPR Compliant</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground mt-4 mb-6 md:mb-8 leading-[1.1]"
          >
            Analytics that actually <br />
            <span className="text-primary italic">drives growth.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base md:text-xl text-muted-foreground/80 max-w-2xl mx-auto mb-10 md:mb-12 leading-relaxed"
          >
            Understand visitor behavior with <span className="text-foreground font-semibold">Live Analytics</span>, <span className="text-foreground font-semibold">Heatmaps</span>, <span className="text-foreground font-semibold">Webcam-free Session Recordings</span>, and <span className="text-foreground font-semibold">Funnels</span>. And take<span className="text-foreground font-semibold"> actions</span> automatically with logic-driven popups and emails.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20"
          >
            {isAuthenticated ? (
              <Link href="/websites" className="w-full sm:w-auto">
                <Button variant="brand" className="h-14 px-10 text-base font-bold rounded-xl active:scale-95 group shadow-xl shadow-primary/20 transition-all w-full">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            ) : (
              <Link href="/signup" className="w-full sm:w-auto">
                <Button variant="brand" className="h-14 px-10 text-base font-bold rounded-xl active:scale-95 group shadow-xl shadow-primary/20 transition-all w-full">
                  Start for Free
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            )}
            <Link href="/websites/demo" className="w-full sm:w-auto">
              <Button variant="outline" className="h-14 px-10 text-base font-bold rounded-xl active:scale-95 shadow-sm bg-card/50 backdrop-blur-sm border-border hover:bg-accent text-foreground transition-all flex items-center justify-center gap-2 w-full">
                <Play className="h-4 w-4 fill-primary text-primary" />
                View Demo
              </Button>
            </Link>
          </motion.div>

          {/* Real Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative max-w-7xl mx-auto px-4"
          >
            <div className="absolute inset-x-0 -top-40 -z-10 flex justify-center overflow-hidden [mask-image:radial-gradient(50%_50%_at_50%_50%,#000_20%,transparent_100%)]">
              <div className="w-[70rem] flex-none h-[40rem] bg-gradient-to-r from-primary/20 via-sky-400/20 to-primary/20 blur-3xl opacity-40 animate-pulse" />
            </div>

            <div className="relative group cursor-zoom-in" onClick={() => setIsZoomed(true)}>
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-sky-500/20 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000" />
              <div className="relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-2 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)]">
                <div className="rounded-xl overflow-hidden border border-border/40 relative">
                  <Image 
                    src="/analytics-dashboard.png"
                    alt="Seentics Analytics Dashboard"
                    width={2400}
                    height={1350}
                    className="w-full h-auto transition-transform duration-500 group-hover:scale-[1.01]"
                    priority
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-full shadow-lg backdrop-blur-md">
                      <Maximize2 className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

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
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative max-w-7xl w-full max-h-[90vh] rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setIsZoomed(false)}
                className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition-colors border border-white/10"
              >
                <X className="w-6 h-6" />
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

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 text-slate-400"
      >
        <div className="relative h-12 w-[2px] bg-slate-100 dark:bg-slate-800 overflow-hidden rounded-full">
          <motion.div
            animate={{ y: [0, 48] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="absolute top-0 w-full h-1/2 bg-primary"
          />
        </div>
      </motion.div>
    </section>
  );
}