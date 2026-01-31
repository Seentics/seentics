"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Timer } from "lucide-react";
import Link from "next/link";

export function PromotionBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative z-[60] overflow-hidden bg-[#0f172a] border-b border-blue-500/10"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-sky-500/10 to-cyan-500/10 opacity-50" />
      
      <div className="container mx-auto relative">
        <div className="flex flex-col md:flex-row items-center justify-between py-2 gap-3 md:gap-0">
          
          {/* Left Side: Offer Details */}
          <div className="flex items-center gap-3">
            {/* <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/20">
              <Sparkles size={16} className="text-white animate-pulse" />
            </div> */}
            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
              
              <div className="flex items-center gap-2">
                <p className="text-sm text-blue-100/80">
                  Get <span className="text-white font-bold underline decoration-blue-500/50 underline-offset-4 decoration-2 text-md">Lifetime Access</span> for only <span className="text-white font-black text-lg ml-1 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">$99</span>
                </p>
              </div>
            </div>
          </div>

          {/* Right Side: Scarcity & CTA */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
              <Timer size={14} className="text-blue-400" />
              <p className="text-[11px] font-bold text-blue-300 uppercase tracking-tighter">
                Limited Time Offer
              </p>
            </div>
            
            <Link 
              href="/pricing"
              target="_blank"
              className="relative group overflow-hidden flex items-center gap-2 bg-primary dark:bg-primary/50 text-white px-5 py-1.5 rounded-full text-sm font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(99,102,241,0.2)]"
            >
              <span className="relative z-10 flex items-center gap-2">
                Claim Offer
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          </div>
        </div>
      </div>

      {/* Glossy line effect */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
      
      {/* Moving shimmer effect */}
      <motion.div 
        animate={{ 
          x: ["-100%", "200%"],
        }}
        transition={{ 
          duration: 6, 
          repeat: Infinity, 
          ease: "linear",
          repeatDelay: 3
        }}
        className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-[-25deg]"
      />
    </motion.div>
  );
}
