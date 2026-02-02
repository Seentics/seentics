import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play, LayoutDashboard, MousePointer2, ShieldCheck, CheckCircle, Zap } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/stores/useAuthStore';

export default function Hero() {
  const { isAuthenticated } = useAuth();
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
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-60 pb-40 overflow-hidden bg-transparent">
      {/* Ambient Background Visuals */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-500/5 blur-[100px] rounded-full animate-pulse delay-1000" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-5xl mx-auto flex flex-col items-center text-center"
        >
          {/* Headline */}
          <motion.h1
            variants={itemVariants}
            className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.2] mb-8 text-foreground"
          >
            Websites Analytics <br />
            That <span className="text-primary italic relative">
              Acts
              <span className="absolute -bottom-1 left-0 w-full h-2 bg-primary/20 -z-10 rounded-full" />
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={itemVariants}
            className="text-lg sm:text-xl text-muted-foreground/70 max-w-3xl mx-auto mb-14 leading-[1.6] font-medium"
          >
            Understand how visitors use your site and take action instantly. Automatically <span className="text-foreground font-semibold">show modals</span>, <span className="text-foreground font-semibold">send emails</span>, or <span className="text-foreground font-semibold">trigger webhooks</span> to engage your users at exactly the right moment.
          </motion.p>

          {/* Action Hub */}
          <motion.div variants={itemVariants} className="flex flex-col items-center gap-8 w-full mb-24">
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              {isAuthenticated ? (
                <Link href="/websites" className="w-full sm:w-auto">
                  <Button variant="brand" className="h-16 px-12 text-lg font-bold rounded-xl active:scale-95 group shadow-2xl shadow-primary/20 transition-all text-primary-foreground">
                    Go to dashboard
                    <ArrowRight className="ml-3 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              ) : (
                <Link href="/signup" className="w-full sm:w-auto">
                  <Button variant="brand" className="h-16 px-12 text-lg font-bold rounded-xl active:scale-95 group shadow-2xl shadow-primary/20 transition-all text-primary-foreground">
                    Get started for free
                    <ArrowRight className="ml-3 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              )}
              <Link href="/websites/demo" className="w-full sm:w-auto">
                <Button variant="outline" className="h-16 px-12 text-lg font-bold rounded-xl w-full sm:w-auto bg-transparent border-border hover:bg-accent text-foreground transition-all flex items-center justify-center gap-3">
                  <Play className="h-5 w-5 fill-current text-primary" />
                  View live demo
                </Button>
              </Link>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap justify-center gap-8 mt-4 opacity-80 grayscale-[0.5] hover:grayscale-0 transition-all duration-500">
               <div className="flex items-center gap-3">
                 <ShieldCheck className="h-5 w-5 text-primary" />
                 <span className="text-sm font-bold tracking-wide text-foreground/80">Privacy First</span>
               </div>
               <div className="flex items-center gap-3">
                 <CheckCircle className="h-5 w-5 text-primary" />
                 <span className="text-sm font-bold tracking-wide text-foreground/80">GDPR Compliant</span>
               </div>
               <div className="flex items-center gap-3">
                 <Zap className="h-5 w-5 text-primary" />
                 <span className="text-sm font-bold tracking-wide text-foreground/80">Lightweight Script</span>
               </div>
            </div>
          </motion.div>

          {/* High-Fidelity Dashboard Card */}
          <motion.div
            variants={itemVariants}
            className="relative w-full max-w-5xl"
          >
            <div className="absolute -inset-10 bg-primary/10 blur-[100px] opacity-50 -z-10" />

            <div className="relative p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 shadow-2xl overflow-hidden aspect-[16/9]">
              <div className="w-full h-full rounded-lg bg-white dark:bg-slate-900 p-8 flex flex-col items-start justify-start text-left relative overflow-hidden">

                {/* Mock UI Header */}
                <div className="w-full flex items-center justify-between mb-8 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <LayoutDashboard className="h-5 w-5 text-primary" />
                    </div>
                    <div className="h-5 w-40 bg-slate-100 dark:bg-slate-800 rounded-full" />
                  </div>
                  <div className="flex gap-3">
                    <div className="h-3 w-12 bg-slate-50 dark:bg-slate-800/50 rounded-full" />
                    <div className="h-3 w-20 bg-primary/20 rounded-full" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6 w-full mb-10">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-6 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/30 flex flex-col gap-3">
                      <div className="h-2.5 w-20 bg-slate-200 dark:bg-slate-700 rounded-full" />
                      <div className="h-8 w-32 bg-slate-900 dark:bg-white/10 rounded" />
                    </div>
                  ))}
                </div>

                {/* Large Chart Area */}
                <div className="w-full flex-1 rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50 p-8 relative overflow-hidden">
                    {/* Simplified Grid Lines */}
                    <div className="absolute inset-0 flex flex-col justify-between p-8 opacity-10">
                        {[1, 2, 3, 4].map(i => <div key={i} className="h-px bg-slate-400 w-full" />)}
                    </div>
                  <div className="absolute inset-x-8 bottom-8 h-[70%] flex items-end gap-3">
                    {[35, 65, 40, 85, 55, 75, 50, 95, 60, 80, 45, 90].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-primary/10 hover:bg-primary/30 transition-all duration-500 rounded-t-sm relative group"
                        style={{ height: `${h}%` }}
                      >
                        {i === 7 && (
                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-4 py-2 bg-primary text-white text-[10px] font-black tracking-widest rounded shadow-xl animate-bounce">
                                Live
                            </div>
                        )}
                        <div className="absolute inset-0 bg-primary opacity-0 group-hover:opacity-20 transition-opacity" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>

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