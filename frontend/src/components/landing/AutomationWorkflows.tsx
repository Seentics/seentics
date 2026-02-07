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
  Briefcase,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

const WorkflowNode = ({ type, icon, label, description }: { type: string, icon: any, label: string, description?: string }) => (
  <div className="flex items-start gap-4">
    <div className={cn(
      "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border",
      type === 'trigger' && "bg-amber-500/10 text-amber-600 border-amber-200/50",
      type === 'logic' && "bg-blue-500/10 text-blue-600 border-blue-200/50",
      type === 'action' && "bg-primary text-primary-foreground border-transparent"
    )}>
      {React.cloneElement(icon as React.ReactElement, { size: 20 })}
    </div>
    <div className="flex-1 pt-1">
      <h4 className="text-[14px] font-bold text-foreground leading-none mb-1.5">{label}</h4>
      {description && <p className="text-[12px] text-muted-foreground font-medium leading-tight">{description}</p>}
    </div>
  </div>
);

const workflows = [
  {
    title: "Smarter Retargeting",
    badge: "Revenue",
    description: "Convert leaving visitors with timely offers that match their intent.",
    diagram: (
      <div className="space-y-4">
        {/* Step 1: Trigger */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
            <MousePointer2 size={16} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-amber-600/60 uppercase tracking-widest">Trigger</p>
            <p className="text-xs font-bold text-foreground">Exit Intent Detected</p>
          </div>
        </div>
        
        <div className="flex justify-center -my-2 h-4">
          <div className="w-px bg-border" />
        </div>

        {/* Step 2: Logic */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
            <ShoppingCart size={16} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-blue-600/60 uppercase tracking-widest">Logic</p>
            <p className="text-xs font-bold text-foreground">Cart Value &gt; $100</p>
          </div>
        </div>

        <div className="flex justify-center -my-2 h-4">
          <div className="w-px bg-border" />
        </div>

        {/* Step 3: Action Visualization */}
        <div className="relative group/demo">
          <div className="p-4 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-white/80" />
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Instant Action</p>
            </div>
            <p className="text-xs font-bold mb-2">Show &quot;Special 15% Discount&quot; Modal</p>
            <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-white"
                initial={{ width: "0%" }}
                whileInView={{ width: "100%" }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    title: "Enterprise Lead Sync",
    badge: "Sales",
    description: "Instantly alert your team when a high-value prospect lands on your site.",
    diagram: (
      <div className="space-y-4">
        {/* Step 1: Trigger */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
            <Globe size={16} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-amber-600/60 uppercase tracking-widest">Trigger</p>
            <p className="text-xs font-bold text-foreground">Pricing Page Visit</p>
          </div>
        </div>
        
        <div className="flex justify-center -my-2 h-4">
          <div className="w-px bg-border" />
        </div>

        {/* Step 2: Logic */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
            <Briefcase size={16} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-blue-600/60 uppercase tracking-widest">Logic</p>
            <p className="text-xs font-bold text-foreground">Fortune 500 IP Match</p>
          </div>
        </div>

        <div className="flex justify-center -my-2 h-4">
          <div className="w-px bg-border" />
        </div>

        {/* Step 3: Action Visualization */}
        <div className="p-4 rounded-xl bg-zinc-900 text-zinc-100 border border-zinc-800 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center">
                <Webhook size={10} />
              </div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Slack Notification</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-[11px] leading-relaxed">
            <span className="text-emerald-400 font-bold">@sales-team</span> New Enterprise lead active on pricing!
          </p>
        </div>
      </div>
    )
  },
  {
    title: "Proactive Support",
    badge: "Service",
    description: "Identify frustrated users and offer help before they even ask.",
    diagram: (
      <div className="space-y-4">
        {/* Step 1: Trigger */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
            <AlertCircle size={16} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-amber-600/60 uppercase tracking-widest">Trigger</p>
            <p className="text-xs font-bold text-foreground">Rage Clicks Detected</p>
          </div>
        </div>
        
        <div className="flex justify-center -my-2 h-4">
          <div className="w-px bg-border" />
        </div>

        {/* Step 2: Logic */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
            <UserCheck size={16} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-blue-600/60 uppercase tracking-widest">Logic</p>
            <p className="text-xs font-bold text-foreground">Paying Customer</p>
          </div>
        </div>

        <div className="flex justify-center -my-2 h-4">
          <div className="w-px bg-border" />
        </div>

        {/* Step 3: Action Visualization */}
        <div className="bg-white dark:bg-zinc-950 border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="bg-primary p-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle size={10} className="text-white" />
              <p className="text-[9px] font-bold text-white uppercase tracking-tighter">Live Support</p>
            </div>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
              <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
            </div>
          </div>
          <div className="p-3">
            <div className="h-3 w-3/4 bg-muted rounded mb-2" />
            <div className="h-3 w-1/2 bg-muted rounded opacity-60" />
          </div>
        </div>
      </div>
    )
  }
];

export default function AutomationWorkflows() {
  return (
    <section id="automations" className="py-24 bg-background border-y border-border/40">
      <div className="container mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center mb-20">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-6">
            Turn every click <br />
            <span className="text-primary italic">into an action.</span>
          </h2>
          <p className="text-lg text-muted-foreground/80 font-medium">
            Stop watching data and start using it. Build logical sequences that engage visitors when it matters most.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-7xl mx-auto">
          {workflows.map((workflow, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] border border-border/50 bg-card/50 flex flex-col hover:border-primary/20 transition-all duration-300"
            >
              <div className="mb-8 md:mb-10">
                <span className="px-2.5 py-1 rounded-full bg-muted text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4 inline-block">
                  {workflow.badge}
                </span>
                <h3 className="text-xl md:text-2xl font-bold text-foreground mb-3 tracking-tight">{workflow.title}</h3>
                <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                  {workflow.description}
                </p>
              </div>

              <div className="p-6 md:p-8 rounded-2xl bg-background/50 border border-border/40 mb-6 md:mb-8 flex-grow">
                {workflow.diagram}
              </div>

              <button className="flex items-center gap-2 text-primary text-sm font-bold group/btn mt-auto">
                Try this automation <ChevronRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
