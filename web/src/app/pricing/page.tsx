'use client';

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { isEnterprise } from '@/lib/features';
import { useRouter } from 'next/navigation';
import { PlanBuilder, PlanBuilderSelection } from '@/components/subscription/PlanBuilder';
import api from '@/lib/api';

export default function PricingPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isEnterprise) {
            router.replace('/');
        }
    }, [router]);

    if (!isEnterprise) return null;

    const handleSubscribe = async (selection: PlanBuilderSelection) => {
        try {
            setLoading(true);
            if (selection.totalPrice === 0) {
                window.location.href = '/websites';
                return;
            }

            const response = await api.post('/user/billing/checkout', {
                plan: 'custom',
                custom_limits: {
                    max_monthly_events: selection.events,
                    max_automations: selection.automations,
                    max_funnels: selection.funnels,
                    max_heatmaps: selection.heatmaps,
                    max_replays: selection.recordings,
                    max_websites: selection.websites,
                    price_monthly: selection.totalPrice,
                },
            });

            if (response.data.success && response.data.data.checkoutUrl) {
                let checkoutUrl = response.data.data.checkoutUrl;
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    if (!checkoutUrl.includes('test=1')) {
                        checkoutUrl += (checkoutUrl.includes('?') ? '&' : '?') + 'test=1';
                    }
                }
                window.location.href = checkoutUrl;
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to create checkout. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background py-20 px-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center space-y-4 mb-16 animate-in fade-in slide-in-from-top-4 duration-700">
                    <h1 className="text-5xl md:text-6xl font-black tracking-tight text-foreground">
                        Pay for what<br />
                        <span className="text-primary italic">you need.</span>
                    </h1>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto font-medium">
                        Pick a preset or drag the sliders to build your perfect plan. Only pay for what you use.
                    </p>
                </div>

                {/* Plan Builder */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <PlanBuilder onSubscribe={handleSubscribe} loading={loading} />
                </div>

                {/* Footer Trust */}
                <div className="mt-24 text-center">
                    <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-xs mb-8">Trusted by teams worldwide</p>
                    <div className="flex flex-wrap justify-center items-center gap-12 opacity-40 grayscale contrast-200">
                        <div className="text-2xl font-black italic">TECH FLOW</div>
                        <div className="text-2xl font-black tracking-tighter">DATA<span className="text-primary italic">CORE</span></div>
                        <div className="text-2xl font-black underline decoration-emerald-500 underline-offset-4">SAAS.LY</div>
                        <div className="text-2xl font-black tracking-widest">GROWTH</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
