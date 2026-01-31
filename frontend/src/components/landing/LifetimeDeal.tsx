"use client";

import { motion } from "framer-motion";
import { Check, Zap, Sparkles, ShieldCheck, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useAuth } from "@/stores/useAuthStore";

const FEATURES = [
    "Unlimited Websites Tracking",
    "Lifetime Data Storage",
    "Real-time Analytics Dashboard",
    "Conversion Goal Tracking",
    "Automated PDF Reports",
    "Priority Dev Support",
    "All Future Features Included",
    "Privacy-First (GDPR Ready)"
];

export function LifetimeDeal() {
    const { isAuthenticated } = useAuth();
    return (
        <section className="py-24 relative overflow-hidden bg-slate-50/50 dark:bg-slate-950/50" id="lifetime-deal">
            <div className="container mx-auto px-6">
                <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-16">
                    
                    {/* Left Side: Copy */}
                    <div className="flex-1 text-center lg:text-left">
                        <motion.div
                            initial={{ opacity: 0, x: -25 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7 }}
                        >
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-8">
                                <Sparkles size={14} className="animate-pulse" />
                                Exclusive Early Adopter Deal
                            </div>
                            <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-6 leading-none text-slate-900 dark:text-white">
                                One Payment. <br />
                                <span className="text-indigo-600 dark:text-indigo-400">Lifetime Insight.</span>
                            </h2>
                            <p className="text-lg text-slate-600 dark:text-slate-400 mb-10 leading-relaxed max-w-xl mx-auto lg:mx-0">
                                Ditch the monthly subscriptions. Lock in lifetime access to the Seentics Analytics Pro stack and never worry about recurring costs again.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 mb-12">
                                {FEATURES.map((feature, i) => (
                                    <div key={i} className="flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        <div className="h-6 w-6 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                            <Check size={16} strokeWidth={3} />
                                        </div>
                                        {feature}
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-wrap justify-center lg:justify-start items-center gap-8">
                                <div className="flex items-center gap-2 group cursor-help">
                                    <div className="p-2 rounded-full bg-green-500/10 text-green-600">
                                        <ShieldCheck size={20} />
                                    </div>
                                    <span className="text-sm font-bold text-slate-500 group-hover:text-green-600 transition-colors">30-day guarantee</span>
                                </div>
                                <div className="flex items-center gap-2 group cursor-help">
                                    <div className="p-2 rounded-full bg-orange-500/10 text-orange-600 animate-pulse">
                                        <Clock size={20} />
                                    </div>
                                    <span className="text-sm font-bold text-slate-500 group-hover:text-orange-600 transition-colors">Only 15 slots remaining</span>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Right Side: Pricing Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, delay: 0.2 }}
                        className="w-full lg:w-[450px] shrink-0"
                    >
                        <div className="relative group p-1 ring-1 ring-slate-200 dark:ring-slate-800 rounded-[3rem] bg-white dark:bg-slate-900 shadow-2xl">
                             {/* Floating Elements */}
                            <div className="absolute -top-6 -right-6 h-12 w-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg transform rotate-12 z-20 font-black text-xs">
                                HOT
                            </div>

                            <div className="relative rounded-[2.8rem] p-10 overflow-hidden border-2 border-transparent">
                                <div className="flex justify-between items-center mb-8">
                                    <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Lifetime Plan</p>
                                    <div className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500">POPULAR</div>
                                </div>

                                <div className="mb-10 text-center lg:text-left">
                                    <div className="flex items-baseline justify-center lg:justify-start gap-2">
                                        <span className="text-7xl font-black tracking-tighter text-slate-900 dark:text-white">$99</span>
                                        <div className="flex flex-col">
                                            <span className="text-lg text-slate-400 line-through font-bold decoration-red-500/50 decoration-2">$299</span>
                                            <span className="text-xs font-bold text-green-500">65% OFF</span>
                                        </div>
                                    </div>
                                    <p className="text-slate-500 text-sm font-medium mt-2">One-time payment, unlimited value</p>
                                </div>

                                <div className="space-y-4 mb-10">
                                    <div className="p-5 rounded bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-500/20 flex items-start gap-4">
                                        <div className="h-10 w-10 rounded bg-indigo-600 flex items-center justify-center text-white shrink-0">
                                            <Zap size={22} fill="white" />
                                        </div>
                                        <div>
                                            <p className="font-black text-sm text-slate-900 dark:text-white">Pro Perks Enabled</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">Unlock all current and future pro features without monthly bills.</p>
                                        </div>
                                    </div>
                                </div>

                                <Link href={isAuthenticated ? "/websites" : "/signup"} className="group relative w-full inline-flex items-center justify-center gap-2 bg-slate-900 dark:bg-indigo-600 text-white py-5 rounded text-lg font-black transition-all hover:bg-black dark:hover:bg-indigo-500 shadow-xl active:scale-95">
                                    {isAuthenticated ? "Go to Dashboard" : "Grab the Deal"}
                                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </Link>

                                <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                    <div className="flex -space-x-3">
                                        {[1, 2, 3, 4].map(i => (
                                            <div key={i} className="h-9 w-9 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                                <img src={`https://i.pravatar.cc/150?u=${i + 124}`} alt="Avatar" className="grayscale" />
                                            </div>
                                        ))}
                                        <div className="h-9 w-9 rounded-full border-2 border-white dark:border-slate-900 bg-indigo-600 flex items-center justify-center text-[10px] font-black text-white">
                                            +4K
                                        </div>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 tracking-wide">TRUSTED WORLDWIDE</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                </div>
            </div>
        </section>
    );
}
