'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Database, Shield, Zap, Lock, DatabaseBackup, ChevronRight, Server, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function BYODBSection() {
  const features = [
    {
      icon: <Lock className="w-6 h-6 text-primary" />,
      title: "Full Privacy Control",
      description: "Keep your data on your own servers. Perfect for staying compliant with privacy laws like GDPR."
    },
    {
      icon: <Server className="w-6 h-6 text-primary" />,
      title: "Use Your Own Tools",
      description: "Connect your favorite business tools directly to your database without any middleman."
    },
    {
      icon: <Zap className="w-6 h-6 text-primary" />,
      title: "Keep Data Forever",
      description: "Save as much history as you want without paying extra for storage. Your data, your rules."
    }
  ];

  return (
    <section className="py-32 relative overflow-hidden bg-white dark:bg-[#020617]">
      {/* Background patterns */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, gray 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          {/* Left Content */}
          <div className="flex-1 space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-primary text-[10px] font-black uppercase tracking-widest mb-8"
            >
              <Database className="w-3.5 h-3.5" />
              Enterprise Feature
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-5xl font-black tracking-tight text-foreground leading-[1.1]"
            >
              Your Data, <br />
              <span className="text-primary italic">Your Control.</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-lg text-muted-foreground leading-relaxed max-w-xl font-medium"
            >
              Take total ownership of your information. Connect Seentics to your own database and manage your infrastructure exactly how you want it.
            </motion.p>

            <div className="grid gap-6">
              {features.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex gap-4 p-4 rounded-2xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] hover:bg-white/[0.04] transition-colors group"
                >
                  <div className="mt-1">{f.icon}</div>
                  <div>
                    <h4 className="font-bold text-foreground mb-1">{f.title}</h4>
                    <p className="text-sm text-muted-foreground/80 leading-relaxed">{f.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="pt-4"
            >
              <Link href="/signup">
                <Button variant="brand" className="h-14 px-8 font-bold rounded-xl group">
                  Connect your DB
                  <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </motion.div>
          </div>

          {/* Right Visual Representation */}
          <div className="flex-1 relative w-full max-w-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative aspect-square md:aspect-video rounded-3xl border border-slate-100 dark:border-white/10 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden p-8 flex flex-col justify-center"
            >
              {/* Visual Architecture */}
              <div className="relative flex items-center justify-between gap-4">
                {/* Seentics Layer */}
                <div className="flex flex-col items-center gap-4 z-20">
                  <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                    <Globe className="w-10 h-10 text-white" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest text-primary">Seentics Cloud</span>
                </div>

                {/* Connection Line */}
                <div className="flex-1 h-0.5 border-t-2 border-dashed border-primary/30 relative">
                  <motion.div 
                    animate={{ left: ['0%', '100%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-1 w-2 h-2 rounded-full bg-primary shadow-lg shadow-primary/50"
                  />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-900 px-3 py-1 border border-primary/20 rounded-full flex items-center gap-2">
                    <Lock className="w-3 h-3 text-primary" />
                    <span className="text-[10px] font-bold text-primary">AES-256 Encrypted</span>
                  </div>
                </div>

                {/* Customer DB Layer */}
                <div className="flex flex-col items-center gap-4 z-20">
                  <div className="w-20 h-20 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                    <Database className="w-10 h-10 text-emerald-500" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest text-emerald-500">Your Database</span>
                </div>
              </div>

              {/* Decorative Glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-1/2 bg-primary/20 blur-[100px] rounded-full -z-10" />
            </motion.div>

            {/* Floating Badges */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="absolute -top-4 -right-4 p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/10 shadow-xl flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                <DatabaseBackup className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-left">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Supported</div>
                <div className="text-sm font-bold">PostgreSQL / Clickhouse</div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
