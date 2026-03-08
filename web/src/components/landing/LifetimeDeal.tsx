"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Zap, Sparkles, ShieldCheck, Clock, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/stores/useAuthStore";
import api from "@/lib/api";
import { openCheckout } from "@/lib/checkout";
import { toast } from "sonner";

const LIMITS = [
    "3 Websites",
    "100,000 Monthly Events",
    "20 Heatmap Pages",
    "3,000 Session Recordings",
    "10 Funnels",
    "10 Automations",
    "1 Month Recording Retention",
    "1 Year Analytics Retention",
    "Email Support",
];

const PERKS = [
    "All future updates included",
    "Privacy focused design",
    "No recurring costs ever",
];

export function LifetimeDeal() {
    const { isAuthenticated } = useAuth();
    const [loading, setLoading] = useState(false);

    const handleGrabDeal = async () => {
        if (!isAuthenticated) {
            window.location.href = '/signup';
            return;
        }

        try {
            setLoading(true);
            const response = await api.post('/user/billing/checkout', {
                plan: 'lifetime',
                billing: 'lifetime',
            });

            if (response.data.success && response.data.data.checkoutUrl) {
                openCheckout(response.data.data.checkoutUrl);
            }
        } catch {
            toast.error('Failed to initialize checkout. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="py-24 md:py-32 bg-background relative overflow-hidden" id="lifetime-deal">
            <div className="container mx-auto px-6">
                {/* Section header */}
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <motion.p
                        initial={{ opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="text-xs font-semibold uppercase tracking-widest text-primary mb-3"
                    >
                        Limited Time Offer
                    </motion.p>
                    <motion.h2
                        initial={{ opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.05 }}
                        className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4"
                    >
                        One payment. Lifetime access.
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="text-muted-foreground text-lg"
                    >
                        Skip the monthly bills forever. Get the full Seentics Basic plan with a single payment &mdash; built for early adopters who believe in what we&apos;re building.
                    </motion.p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="max-w-4xl mx-auto"
                >
                    <div className="rounded-2xl border border-border bg-card p-8 md:p-12">
                        <div className="flex flex-col lg:flex-row gap-10 lg:gap-16 items-center">

                            {/* Left: what's included */}
                            <div className="flex-1 w-full">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6">
                                    <Sparkles size={12} />
                                    Early Adopter Exclusive
                                </div>

                                <p className="text-sm font-medium text-muted-foreground mb-4">What&apos;s included:</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                                    {LIMITS.map((item, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-2.5 text-sm text-foreground"
                                        >
                                            <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                                <Check size={12} strokeWidth={3} />
                                            </div>
                                            {item}
                                        </div>
                                    ))}
                                </div>

                                <div className="flex flex-wrap gap-x-5 gap-y-2 mb-6">
                                    {PERKS.map((perk, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                                            <Check size={10} strokeWidth={3} className="text-green-600" />
                                            {perk}
                                        </div>
                                    ))}
                                </div>

                                <div className="flex flex-wrap items-center gap-5 text-muted-foreground">
                                    <div className="flex items-center gap-2 text-xs font-medium">
                                        <ShieldCheck size={14} className="text-green-600" />
                                        30-day money-back guarantee
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-medium">
                                        <Clock size={14} className="text-orange-500" />
                                        Only 15 slots remaining
                                    </div>
                                </div>
                            </div>

                            {/* Right: price + CTA */}
                            <div className="w-full lg:w-auto shrink-0">
                                <div className="rounded-xl border border-border bg-background p-8 text-center lg:w-[280px]">
                                    <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-4">Lifetime Plan</p>

                                    <div className="flex items-baseline justify-center gap-2 mb-1">
                                        <span className="text-5xl font-black tracking-tight text-foreground">$99</span>
                                        <div className="flex flex-col items-start">
                                            <span className="text-base text-muted-foreground line-through">$299</span>
                                            <span className="text-xs font-semibold text-green-600">67% off</span>
                                        </div>
                                    </div>
                                    <p className="text-muted-foreground text-xs mb-6">One-time payment, forever yours</p>

                                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 flex items-center gap-3 mb-6 text-left">
                                        <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground shrink-0">
                                            <Zap size={16} fill="currentColor" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-foreground">Full Basic plan</p>
                                            <p className="text-[10px] text-muted-foreground">All features, no recurring costs</p>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={handleGrabDeal}
                                        disabled={loading}
                                        className="w-full h-11 text-sm font-semibold rounded-lg group"
                                    >
                                        {loading ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <>
                                                {isAuthenticated ? 'Get Lifetime Access' : 'Sign up & Grab the Deal'}
                                                <ArrowRight size={16} className="ml-2 group-hover:translate-x-0.5 transition-transform" />
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
