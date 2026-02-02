'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MousePointer2, Mail, MessageSquare, Zap, ArrowRight, UserPlus, ShoppingCart, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkflowStepProps {
  icon: React.ReactNode;
  label: string;
  color: string;
}

const WorkflowStep = ({ icon, label, color }: WorkflowStepProps) => (
  <div className="flex flex-col items-center gap-2">
    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-transform hover:scale-110", color)}>
      {icon}
    </div>
    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
  </div>
);

const Connector = () => (
  <div className="flex-1 h-px border-t-2 border-dashed border-slate-200 dark:border-white/10 relative min-w-[30px] sm:min-w-[60px]">
    <motion.div
      animate={{ left: ['0%', '100%'] }}
      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      className="absolute -top-1 w-2 h-2 rounded-full bg-primary/40"
    />
  </div>
);

const workflows = [
  {
    title: "Cart Abandonment Rescue",
    description: "Trigger a personalized discount when a high-value user leaves the checkout page without purchasing.",
    steps: [
      { icon: <ShoppingCart className="w-6 h-6" />, label: "Exit Intent", color: "bg-orange-500 text-white" },
      { icon: <UserCheck className="w-6 h-6" />, label: "Check Value", color: "bg-blue-500 text-white" },
      { icon: <Mail className="w-6 h-6" />, label: "Send Coupon", color: "bg-primary text-white" }
    ]
  },
  {
    title: "Power User Onboarding",
    description: "Identify users who have used 3+ features in their first hour and invite them to an exclusive Discord.",
    steps: [
      { icon: <Zap className="w-6 h-6" />, label: "Feature Use", color: "bg-yellow-500 text-white" },
      { icon: <UserPlus className="w-6 h-6" />, label: "Identify", color: "bg-emerald-500 text-white" },
      { icon: <MessageSquare className="w-6 h-6" />, label: "Invite", color: "bg-indigo-500 text-white" }
    ]
  },
  {
    title: "B2B Lead Qualification",
    description: "When a visitor from a Fortune 500 company visits your pricing page, alert your sales team on Slack instantly.",
    steps: [
      { icon: <MousePointer2 className="w-6 h-6" />, label: "Visit Page", color: "bg-pink-500 text-white" },
      { icon: <Zap className="w-6 h-6" />, label: "Enrich Data", color: "bg-cyan-500 text-white" },
      { icon: <Zap className="w-6 h-6" />, label: "Slack Alert", color: "bg-rose-500 text-white" }
    ]
  }
];

export default function AutomationWorkflows() {
  return (
    <section className="py-32 relative overflow-hidden bg-slate-50 dark:bg-[#020617]/50">
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-widest"
          >
            <Zap className="w-3.5 h-3.5" />
            Turn Data into Revenue
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-black tracking-tight text-foreground leading-[1.1]"
          >
            Example <span className="text-primary italic">Workflows</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-lg text-muted-foreground font-medium"
          >
            Discover how Seentics automates your growth by connecting behavior to action.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {workflows.map((workflow, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="p-8 rounded-3xl border border-slate-200 dark:border-white/5 bg-white dark:bg-gray-900/40 backdrop-blur-sm flex flex-col h-full group hover:border-primary/30 transition-all duration-500 shadow-xl shadow-slate-200/50 dark:shadow-none"
            >
              <div className="flex-1 space-y-6">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">{workflow.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{workflow.description}</p>
                </div>
                
                {/* Visual Flow */}
                <div className="pt-6 pb-2 flex items-center justify-between">
                  {workflow.steps.map((step, sIndex) => (
                    <React.Fragment key={sIndex}>
                      <WorkflowStep {...step} />
                      {sIndex < workflow.steps.length - 1 && <Connector />}
                    </React.Fragment>
                  ))}
                </div>
              </div>
              
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-primary transition-colors">Setup in 2 mins</span>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Background Decorative Blur */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/5 blur-[120px] rounded-full -z-10 pointer-events-none" />
    </section>
  );
}
