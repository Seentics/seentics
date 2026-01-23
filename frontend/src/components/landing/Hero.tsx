import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play, LayoutDashboard, MousePointer2 } from 'lucide-react';
import Link from 'next/link';

export default function Hero() {
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
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-32 pb-40 overflow-hidden bg-background">
      {/* Soft Mesh Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-violet-500/5 blur-[100px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-5xl mx-auto flex flex-col items-center text-center"
        >
          {/* Status Badge */}
          <motion.div variants={itemVariants} className="mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 border border-primary/10 backdrop-blur-md text-[11px] font-bold uppercase tracking-wider text-primary shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Next-Gen Analytics Engine
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1 
            variants={itemVariants}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[1.1] mb-8 text-foreground"
          >
            Better data. <br />
            <span className="gradient-text font-black">Better results.</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p 
            variants={itemVariants}
            className="text-lg sm:text-xl text-muted-foreground/70 max-w-2xl mx-auto mb-12 leading-relaxed font-medium"
          >
            Simple, privacy-first analytics for modern teams. Grow your business with data you actually understand.
          </motion.p>

          {/* Action Hub */}
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto mb-20">
            <Link href="/signup" className="w-full sm:w-auto">
              <Button variant="brand" size="lg" className="h-14 px-10 text-[13px] font-bold uppercase tracking-wider rounded-full w-full sm:w-auto active:scale-95 group">
                Start Free Forever
                <ArrowRight className="ml-3 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/websites/demo" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="h-14 px-10 text-[13px] font-bold uppercase tracking-wider rounded-full w-full sm:w-auto glass border-white/10 hover:bg-white/5 transition-all flex items-center gap-3">
                <Play className="h-3 w-3 fill-current" />
                Live Preview
              </Button>
            </Link>
          </motion.div>

          {/* High-Fidelity Dashboard Card */}
          <motion.div 
            variants={itemVariants}
            className="relative w-full max-w-4xl group"
          >
            <div className="absolute -inset-10 bg-primary/10 blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 -z-10" />
            
            <div className="relative glass p-2 rounded-[2.5rem] border-white/10 shadow-2xl overflow-hidden aspect-[16/10] bg-black/5 dark:bg-white/5 backdrop-blur-[40px]">
              <div className="w-full h-full rounded-[2rem] bg-background/50 p-6 sm:p-10 flex flex-col items-start justify-start text-left relative overflow-hidden">
                
                {/* Mock UI Header */}
                <div className="w-full flex items-center justify-between mb-8 pb-4 border-b border-border/40">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <LayoutDashboard className="h-4 w-4 text-primary" />
                    </div>
                    <div className="h-4 w-32 bg-foreground/10 rounded" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-2 w-8 bg-foreground/5 rounded" />
                    <div className="h-2 w-12 bg-foreground/10 rounded" />
                  </div>
                </div>

                {/* Mock Charts/Stats */}
                <div className="grid grid-cols-3 gap-6 w-full mb-8">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-3">
                      <div className="h-2 w-16 bg-muted-foreground/20 rounded" />
                      <div className="h-6 w-24 bg-foreground/10 rounded" />
                    </div>
                  ))}
                </div>

                {/* Large Chart Area */}
                <div className="w-full flex-1 rounded-2xl bg-white/5 border border-white/5 p-6 relative">
                  <div className="absolute inset-x-6 bottom-6 h-[60%] flex items-end gap-2">
                    {[40, 70, 45, 90, 65, 80, 55, 75, 50, 85].map((h, i) => (
                      <div 
                        key={i} 
                        className="flex-1 bg-primary/20 rounded-t-sm hover:bg-primary/40 transition-colors" 
                        style={{ height: `${h}%` }}
                      >
                        {i === 3 && <div className="absolute -top-10 left-1/2 -translate-x-1/2 glass px-3 py-1 rounded text-[10px] font-bold text-primary animate-bounce">Live +24%</div>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating Snippets */}
                <div className="absolute top-1/4 -right-12 hidden xl:block">
                  <div className="glass p-4 rounded-2xl shadow-xl border-white/10 w-48 animate-float" style={{ animationDelay: '1s' }}>
                    <div className="flex items-center gap-3 mb-2">
                      <MousePointer2 className="h-3 w-3 text-primary" />
                      <div className="h-1.5 w-12 bg-foreground/20 rounded" />
                    </div>
                    <div className="h-3 w-24 bg-foreground/10 rounded" />
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
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 text-muted-foreground"
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Explore</span>
        <div className="relative h-12 w-[1px] bg-foreground/10 overflow-hidden">
          <motion.div 
            animate={{ y: [0, 48] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="absolute top-0 w-full h-1/2 bg-gradient-to-b from-transparent via-primary to-transparent"
          />
        </div>
      </motion.div>
    </section>
  );
}