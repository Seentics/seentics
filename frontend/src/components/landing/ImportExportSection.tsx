import { motion } from 'framer-motion';
import { ArrowRightLeft, Download, Upload, Database, FileSpreadsheet, FileJson, CheckCircle2 } from 'lucide-react';
import React from 'react';

const integrations = [
  { name: 'Google Analytics', description: 'Universal & GA4', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  { name: 'Plausible', description: 'One-click import', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
  { name: 'Umami', description: 'Seamless migration', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  { name: 'Fathom', description: 'Full history sync', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
];

export default function ImportExportSection() {
  return (
    <section id="import-export" className="py-24 sm:py-32 relative overflow-hidden bg-slate-50 dark:bg-[#020617]/50 border-y border-slate-100 dark:border-slate-800/50">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Text Content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-bold mb-6">
                <ArrowRightLeft className="w-4 h-4" />
                <span>Data Portability</span>
              </div>
              <h2 className="text-4xl sm:text-5xl font-black tracking-tighter text-slate-900 dark:text-white mb-6 leading-[0.95]">
                Switch in minutes, <br />
                <span className="text-muted-foreground/50">not days.</span>
              </h2>
              <p className="text-lg text-muted-foreground/80 font-medium leading-relaxed max-w-lg">
                Don't lose your history. Import data directly from your existing tools, or take your data with you whenever you want. No lock-in, ever.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="p-3 rounded-lg bg-green-500/10 text-green-600">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Easy Import</h4>
                  <p className="text-sm text-muted-foreground font-medium">Auto-sync from GA4, Plausible, and more</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="p-3 rounded-lg bg-blue-500/10 text-blue-600">
                  <Download className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Full Export</h4>
                  <p className="text-sm text-muted-foreground font-medium">Download as CSV or JSON anytime</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Visual Content */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            {/* Abstract Background Design */}
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent rounded-full blur-3xl opacity-30 animate-pulse" />
            
            <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-8">
              
              {/* Header of the 'Card' */}
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-primary" />
                  <span className="font-bold text-slate-900 dark:text-white">Data Sources</span>
                </div>
                <div className="flex gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-400/20" />
                  <span className="w-3 h-3 rounded-full bg-amber-400/20" />
                  <span className="w-3 h-3 rounded-full bg-green-400/20" />
                </div>
              </div>

              {/* Integrations Grid */}
              <div className="grid gap-4">
                {integrations.map((item, i) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 hover:border-primary/20 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${item.color}`}>
                        {item.name.charAt(0)}
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900 dark:text-white text-sm">{item.name}</h5>
                        <p className="text-xs text-muted-foreground font-medium">{item.description}</p>
                      </div>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.div>
                ))}
              </div>

              {/* Bottom Actions */}
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex gap-4">
                <div className="flex-1 flex items-center justify-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 text-xs font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export CSV</span>
                </div>
                <div className="flex-1 flex items-center justify-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 text-xs font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                  <FileJson className="w-4 h-4" />
                  <span>Export JSON</span>
                </div>
              </div>
            </div>
            
            {/* Floating Badge */}
            <motion.div 
              className="absolute -bottom-6 -right-6 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 hidden sm:block"
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-bold text-slate-900 dark:text-white">Migration Complete</span>
              </div>
            </motion.div>

          </motion.div>
        </div>
      </div>
    </section>
  );
}
