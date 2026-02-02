import { motion } from 'framer-motion';
import { BarChart3, Shield, Zap, Globe, Check, Layers, Database, MoveRight, Workflow, Filter } from 'lucide-react';
import React from 'react';

export default function Features() {
  const features = [
    {
      icon: BarChart3,
      title: "Live Analytics",
      description: "See exactly who is on your site right now and what they're doing. No delays, just live data.",
      color: "text-primary bg-primary/10"
    },
    {
      icon: Filter,
      title: "Sales Funnels",
      description: "Find exactly where you're losing customers. Visualize your path to checkout and fix leaks instantly.",
      color: "text-primary bg-primary/10"
    },
    {
      icon: Workflow,
      title: "Smart Automation",
      description: "Reach your users at the perfect moment. Trigger actions based on what they do on your site.",
      color: "text-primary bg-primary/10"
    },
    {
      icon: Shield,
      title: "Safe & Private",
      description: "Track everything without annoying cookie banners. We respect privacy while giving you the data you need.",
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
    <section id="features" className="py-24 sm:py-48 relative overflow-hidden bg-transparent">
      <div className="container mx-auto px-6">
        {/* Header Section */}
        <div className="text-center mb-24 sm:mb-32">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl sm:text-6xl font-black tracking-tighter mb-8 leading-[0.95] text-foreground"
          >
            Built for <br />
            <span className="text-primary italic">better results.</span>
          </motion.h2>
          <p className="text-lg sm:text-xl text-muted-foreground/60 max-w-2xl mx-auto font-bold tracking-tight">
            Everything you need to dominate your market, refined into a single intuitive dashboard.
          </p>
        </div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="p-10 rounded-xl bg-card border border-border group hover:border-primary/20 transition-all duration-500"
            >
              <div className={`p-4 rounded bg-background w-fit mb-8 border border-border shadow-sm group-hover:scale-110 transition-transform`}>
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-3xl font-black mb-4 tracking-tighter text-foreground">
                {feature.title}
              </h3>
              <p className="text-muted-foreground/60 leading-relaxed font-bold tracking-tight">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
