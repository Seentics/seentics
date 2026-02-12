import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Workflow, Filter, Mail, FileText, MessageSquare, Check, Sparkles } from 'lucide-react';

const visionItems = [
  {
    icon: BarChart3,
    title: 'Analytics',
    status: 'Live',
    description: "Simple web analytics that respect your visitors' privacy."
  },
  {
    icon: Workflow,
    title: 'Automation',
    status: 'Live',
    description: "Easily set up actions that trigger based on user behavior."
  },
  {
    icon: Filter,
    title: 'Campaigns',
    status: 'Live',
    description: "Track your marketing results and see what's working."
  },
  {
    icon: Mail,
    title: 'Emails',
    status: 'Upcoming',
    description: "Send newsletters and messages directly from one place.",
    highlight: true
  },
  {
    icon: FileText,
    title: 'Grow Leads',
    status: 'Upcoming',
    description: "Capture more customers with beautiful forms and popups.",
    highlight: true
  },
  {
    icon: MessageSquare,
    title: 'Customer Help',
    status: 'Upcoming',
    description: "Chat with your users and help them in real-time.",
    highlight: true
  }
];

export default function VisionSection() {
  return (
    <section id="vision" className="py-24 sm:py-32 relative overflow-hidden bg-transparent">
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
            <span>Where We're Heading</span>
          </motion.div>
          
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl sm:text-6xl font-black tracking-tighter mb-6 text-slate-900 dark:text-white leading-[0.95]"
          >
            Everything you need <br/>
            <span className="text-primary transparent-text-stroke">in one place.</span>
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg sm:text-xl text-muted-foreground/80 font-medium leading-relaxed"
          >
            Stop using 10 different tools for your website. We're building one simple platform that handles everything from analytics to marketing and customer support.
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
