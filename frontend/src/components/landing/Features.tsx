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
    <section id="features" className="py-24 relative overflow-hidden bg-transparent">
      <div className="container mx-auto px-6">
        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="p-8 rounded-3xl bg-card/40 backdrop-blur-xl border border-border/50 group hover:border-primary/30 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/5 flex flex-col items-start"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 border border-primary/20 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 tracking-tight text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground/70 leading-relaxed font-medium">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
