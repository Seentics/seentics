import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Workflow, Filter, Mail, FileText, MessageSquare, Check, Sparkles } from 'lucide-react';

const visionItems = [
  {
    icon: BarChart3,
    title: 'Analytics',
    status: 'Live',
    description: 'Privacy-first web analytics with heatmaps and recordings.'
  },
  {
    icon: Workflow,
    title: 'Automation',
    status: 'Live',
    description: 'Visual workflow builder to trigger actions on user behavior.'
  },
  {
    icon: Filter,
    title: 'Funnels',
    status: 'Live',
    description: 'Conversion tracking to optimize user journeys.'
  },
  {
    icon: Mail,
    title: 'Email Marketing',
    status: 'Upcoming',
    description: 'Send newsletters and automated sequences directly.',
    highlight: true
  },
  {
    icon: FileText,
    title: 'Forms',
    status: 'Upcoming',
    description: 'Capture leads with high-converting forms and popups.',
    highlight: true
  },
  {
    icon: MessageSquare,
    title: 'Support Desk',
    status: 'Upcoming',
    description: 'Live chat and ticketing system to support your users.',
    highlight: true
  }
];

export default function VisionSection() {
  return (
    <section id="vision" className="py-24 sm:py-32 relative overflow-hidden bg-white dark:bg-[#020617]">
      <div className="container mx-auto px-6">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 text-primary text-sm font-bold mb-8 border border-primary/10"
          >
            <Sparkles className="w-4 h-4" />
            <span>The Master Plan</span>
          </motion.div>
          
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl sm:text-6xl font-black tracking-tighter mb-6 text-slate-900 dark:text-white leading-[0.95]"
          >
            One platform to <br/>
            <span className="text-primary transparent-text-stroke">replace them all.</span>
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg sm:text-xl text-muted-foreground/80 font-medium leading-relaxed"
          >
            Stop stitching together 10 different tools. We are building the ultimate operating system for your website—integrating analytics, marketing, and support into one seamless experience.
          </motion.p>
        </div>

        {/* Bento Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {visionItems.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`relative overflow-hidden p-8 rounded-3xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 group hover:border-primary/20 transition-colors ${item.highlight ? 'dark:bg-slate-900/60' : ''}`}
            >
              <div className="flex items-center justify-between mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${item.status === 'Live' ? 'bg-primary/10 text-primary' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                  <item.icon className="w-6 h-6" />
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  item.status === 'Live' 
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
                    : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
                }`}>
                  {item.status}
                </span>
              </div>
              
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
                {item.title}
              </h3>
              <p className="text-muted-foreground/70 font-medium leading-relaxed">
                {item.description}
              </p>

              {item.status === 'Upcoming' && (
                 <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
