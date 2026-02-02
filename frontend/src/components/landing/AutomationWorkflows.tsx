'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowRight, 
  Mail, 
  Zap, 
  UserCheck, 
  MousePointer2,
  ShoppingCart,
  Bell,
  Globe,
  ChevronRight,
  Webhook,
  Layout,
  MessageCircle,
  AlertCircle,
  Briefcase
} from 'lucide-react';
import { cn } from '@/lib/utils';

const WorkflowNode = ({ type, icon, label, isSmall }: { type: string, icon: any, label: string, isSmall?: boolean }) => (
  <div className={cn("relative flex flex-col items-center", isSmall ? "w-1/2" : "w-full")}>
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      className={cn(
        "relative z-10 p-3 rounded-xl border flex items-center gap-3 transition-all duration-500 w-full",
        type === 'trigger' && "bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 shadow-sm",
        type === 'logic' && "bg-slate-50/50 dark:bg-slate-900/30 border-dashed border-slate-300 dark:border-white/20",
        type === 'action' && "bg-primary text-white shadow-lg border-transparent mesh-gradient"
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
        type === 'trigger' && "bg-amber-500/10 text-amber-600",
        type === 'logic' && "bg-blue-500/10 text-blue-600",
        type === 'action' && "bg-white/20 text-white"
      )}>
        {React.cloneElement(icon as React.ReactElement, { size: 14 })}
      </div>
      <div className="flex-1 min-w-0">
        <span className={cn(
          "text-[8px] font-black uppercase tracking-wider block opacity-70 mb-0.5",
          type === 'action' ? "text-white" : "text-muted-foreground"
        )}>
          {type}
        </span>
        <h4 className={cn("text-[11px] font-bold truncate", type === 'action' ? "text-white" : "text-foreground")}>
          {label}
        </h4>
      </div>
    </motion.div>
  </div>
);

const workflows = [
  {
    title: "Conversion Recovery",
    badge: "Revenue",
    description: "Multi-step logic to prevent churn before it happens.",
    diagram: (
      <div className="space-y-4">
        <WorkflowNode type="trigger" icon={<MousePointer2 />} label="Exit Intent Detected" />
        <div className="flex justify-center -my-2 h-6 w-px bg-slate-200 dark:bg-white/10 mx-auto" />
        <WorkflowNode type="logic" icon={<ShoppingCart />} label="Cart Value > $100" />
        <div className="flex justify-center -my-2 h-6 w-px bg-slate-200 dark:bg-white/10 mx-auto" />
        <div className="flex gap-4 relative">
          <WorkflowNode type="action" icon={<Layout />} label="Show Modal" isSmall />
          <WorkflowNode type="action" icon={<Mail />} label="Email Coupon" isSmall />
        </div>
      </div>
    )
  },
  {
    title: "Enterprise Lead Sync",
    badge: "Sales",
    description: "Route high-value leads through complex validation paths.",
    diagram: (
      <div className="space-y-4">
        <WorkflowNode type="trigger" icon={<Globe />} label="Pricing Page Visit" />
        <div className="flex justify-center -my-2 h-6 w-px bg-slate-200 dark:bg-white/10 mx-auto" />
        <WorkflowNode type="logic" icon={<Briefcase />} label="Enterprise IP Match" />
        <div className="flex justify-center -my-2 h-6 w-px bg-slate-200 dark:bg-white/10 mx-auto" />
        <WorkflowNode type="action" icon={<Webhook />} label="Sync to Salesforce" />
      </div>
    )
  },
  {
    title: "Smart Support Routing",
    badge: "Product",
    description: "Identify frustrations and deploy proactive solutions.",
    diagram: (
      <div className="space-y-4">
        <WorkflowNode type="trigger" icon={<AlertCircle />} label="Multiple Rage Clicks" />
        <div className="flex justify-center -my-2 h-6 w-px bg-slate-200 dark:bg-white/10 mx-auto" />
        <WorkflowNode type="logic" icon={<UserCheck />} label="Is Paying Customer" />
        <div className="flex justify-center -my-2 h-6 w-px bg-slate-200 dark:bg-white/10 mx-auto" />
        <div className="flex gap-4 relative">
          <WorkflowNode type="action" icon={<MessageCircle />} label="Open Live Chat" isSmall />
          <WorkflowNode type="action" icon={<Bell />} label="Team Alert" isSmall />
        </div>
      </div>
    )
  }
];

export default function AutomationWorkflows() {
  return (
    <section className="py-24 relative overflow-hidden bg-transparent">
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 1.5px 1.5px, currentColor 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-primary text-[10px] font-black uppercase tracking-widest"
          >
            <Zap className="w-3.5 h-3.5" />
            Logic-Driven Growth
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-black tracking-tight text-foreground leading-[1.1]"
          >
            Data that <br />
            <span className="text-primary italic text-glow">Actually Acts.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-lg text-muted-foreground/70 font-medium max-w-2xl mx-auto leading-relaxed"
          >
            Don&apos;t just collect data. Build logical sequences that turn every click into a meaningful business result.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto items-start">
          {workflows.map((workflow, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group flex flex-col h-full"
            >
              <div className="mb-6 space-y-2">
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-[9px] font-black text-slate-500 border border-slate-200 dark:border-white/10 uppercase tracking-tighter">
                    {workflow.badge}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-foreground group-hover:text-primary transition-colors tracking-tight">
                  {workflow.title}
                </h3>
                <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                  {workflow.description}
                </p>
              </div>

              <div className="flex-1 p-8 rounded-[2.5rem] bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 relative group-hover:border-primary/20 transition-all duration-500">
                {workflow.diagram}
                
                <div className="absolute -right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-2 group-hover:translate-x-0 theme-shadow-primary">
                  <div className="p-2 rounded-full bg-primary text-white shadow-xl">
                    <ArrowRight size={18} />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between px-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Workflow Ready</span>
                <button className="text-xs font-bold text-primary flex items-center gap-1 hover:gap-2 transition-all group-hover:underline decoration-2 underline-offset-4">
                  Clone Logic <ChevronRight size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="absolute top-1/2 left-1/4 w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full -z-10" />
    </section>
  );
}
