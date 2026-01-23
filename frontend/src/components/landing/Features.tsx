import { motion } from 'framer-motion';
import { BarChart3, Shield, Zap, Globe, Check, Layers, Database, MoveRight } from 'lucide-react';
import React from 'react';

export default function Features() {
  const features = [
    {
      icon: BarChart3,
      title: "Clarity in Analytics",
      description: "Track visitors, page views, and traffic sources with surgical precision. Zero complexity, maximum insight.",
      color: "text-primary bg-primary/10"
    },
    {
      icon: Shield,
      title: "Privacy First",
      description: "Cookieless by default. GDPR & PECR compliant. Collect insights without compromising user trust.",
      color: "text-green-500 bg-green-500/10"
    },
    {
      icon: Zap,
      title: "Blazing Performance",
      description: "Under 2KB script. Won't slow down your site. Dashboards that feel like they're running locally.",
      color: "text-amber-500 bg-amber-500/10"
    },
    {
      icon: Globe,
      title: "Global Intelligence",
      description: "See visitors as they interact. Live updates from across the globe, instant traffic patterns.",
      color: "text-primary bg-primary/10"
    },
    {
      icon: Layers,
      title: "Infinite Scale",
      description: "Built on high-performance infrastructure. Handles millions of events without breaking a sweat.",
      color: "text-violet-500 bg-violet-500/10"
    },
    {
      icon: Database,
      title: "Total Sovereignty",
      description: "Fully open source. No vendor lock-in. Export your data in CSV or JSON at any scale.",
      color: "text-primary bg-primary/10"
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
    }
  };

  return (
    <section id="features" className="py-24 sm:py-32 relative overflow-hidden bg-background">
      <div className="container mx-auto px-6">
        {/* Header Section */}
        <div className="text-center mb-16 sm:mb-28 px-4">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-6"
          >
            Capabilities
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="text-4xl sm:text-6xl md:text-7xl font-[1000] tracking-[-0.03em] mb-10 leading-[0.95]"
          >
            Everything you need. <br />
            <span className="gradient-text">Zero Compromise.</span>
          </motion.h2>
          <p className="text-lg sm:text-xl text-muted-foreground/60 max-w-2xl mx-auto font-medium tracking-tight">
            We stripped away the complexity of legacy metrics to give you a tool that's actually designed for growth.
          </p>
        </div>

        {/* Features Grid */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-7xl mx-auto mb-32 sm:mb-48"
        >
          {features.map((feature, index) => (
            <motion.div 
              key={index}
              variants={itemVariants}
              className="glass-card p-10 rounded-[2.5rem] group border-white/10 dark:border-white/[0.05] hover:bg-white/[0.02] active:scale-[0.99] transition-all"
            >
              <div className={`p-4 rounded-2xl w-fit mb-8 ${feature.color} group-hover:scale-110 transition-transform duration-500 shadow-sm border border-white/10`}>
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-black mb-4 tracking-[-0.02em]">
                {feature.title}
              </h3>
              <p className="text-muted-foreground/80 leading-relaxed font-medium tracking-tight">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Data Integration - Expanded Visual */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-6xl mx-auto"
        >
          <div className="relative glass p-8 sm:p-20 rounded-[3rem] overflow-hidden border-white/10 shadow-2xl bg-gradient-to-br from-white/5 to-transparent">
            {/* Background Mesh */}
            <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-primary/10 blur-[120px] rounded-full -mr-40 -mt-40 opacity-50" />
            
            <div className="relative z-10 grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-6">Integration</div>
                <h3 className="text-4xl sm:text-5xl font-black mb-8 leading-[0.95] tracking-[-0.03em]">
                  Your Data is <br />
                  <span className="text-primary italic font-serif underline decoration-primary/30 decoration-4 underline-offset-8">Sovereign.</span>
                </h3>
                <p className="text-lg text-muted-foreground/80 mb-10 font-medium leading-relaxed tracking-tight">
                  Export history in CSV, JSON, or access it via our high-speed API. No vendor lock-in, ever. Your growth shouldn't be held hostage.
                </p>
                <div className="space-y-5">
                  {[
                    "Import from Google Analytics (Universal & GA4)",
                    "High-resolution CSV and JSON exporting",
                    "Infinite scale REST API endpoints"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4 group">
                      <div className="flex-shrink-0 p-1.5 bg-primary/10 rounded-full border border-primary/20 group-hover:bg-primary/20 transition-colors">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm font-bold text-foreground/70 group-hover:text-foreground transition-colors">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="glass p-8 rounded-3xl border-white/10 animate-float shadow-xl flex flex-col items-center text-center">
                  <div className="h-2 w-12 bg-primary/30 rounded-full mb-6" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2 opacity-60">Source</p>
                  <p className="text-sm font-black">Google Analytics</p>
                </div>
                <div className="glass p-8 rounded-3xl border-white/10 animate-float delay-500 shadow-xl flex flex-col items-center text-center">
                  <div className="h-2 w-12 bg-green-500/30 rounded-full mb-6" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-green-500 mb-2 opacity-60">Export</p>
                  <p className="text-sm font-black">Raw JSON/CSV</p>
                </div>
                <div className="glass p-8 rounded-3xl border-white/10 animate-float delay-1000 col-span-2 shadow-xl flex items-center justify-between group cursor-pointer hover:bg-white/5 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                      <Database className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1 opacity-60">Real-time sync</p>
                      <p className="text-sm font-black">Rest API v2.0</p>
                    </div>
                  </div>
                  <MoveRight className="h-5 w-5 text-primary group-hover:translate-x-2 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
