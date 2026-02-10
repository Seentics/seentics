import { motion } from 'framer-motion';
import { BarChart3, Shield, Zap, Globe, Check, Layers, Database, MoveRight, Workflow, Filter, Play } from 'lucide-react';
import React from 'react';

export default function Features() {
  const features = [
    {
      icon: BarChart3,
      title: "Real-time Analytics",
      description: "See exactly who is on your site right now and what they're doing. No delays, just raw live data.",
      color: "text-primary bg-primary/10"
    },
    {
      icon: Filter,
      title: "Advanced Funnels",
      description: "Visualize customer journeys and identify drop-off points. Optimize your path to conversion.",
      color: "text-primary bg-primary/10"
    },
    {
      icon: Play,
      title: "Session Recordings",
      description: "Watch high-fidelity replays of user sessions. See where they hesitate, where they get stuck, and why they leave.",
      color: "text-primary bg-primary/10"
    },
    {
      icon: Shield,
      title: "Privacy Guaranteed",
      description: "PII masking by default. We never capture passwords or sensitive data. 100% GDPR, CCPA, and PECR compliant.",
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
    <section id="features" className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-6">
            Powerful features. <br />
            <span className="text-primary italic">Zero-config setup.</span>
          </h2>
          <p className="text-lg text-muted-foreground/80 leading-relaxed font-medium">
            Get comprehensive insights without the technical overhead. Seentics works out of the box with any website.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="p-6 md:p-8 rounded-2xl border border-border/50 bg-card hover:border-primary/20 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-6 text-primary">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold mb-3 tracking-tight text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground/70 leading-relaxed font-medium">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
