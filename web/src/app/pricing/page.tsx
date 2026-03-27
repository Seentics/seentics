'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { isEnterprise } from '@/lib/features';
import { useRouter } from 'next/navigation';
import { PlanBuilder, PlanSelection } from '@/components/subscription/PlanBuilder';
import api from '@/lib/api';
import { openCheckout } from '@/lib/checkout';
import { cn } from '@/lib/utils';
import { Users, Building2 } from 'lucide-react';

export default function PricingPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'individual' | 'agency'>('individual');

    useEffect(() => {
        if (!isEnterprise) {
            router.replace('/');
        }
    }, [router]);

    if (!isEnterprise) return null;

    const handleSubscribe = async (selection: PlanSelection) => {
        try {
            setLoading(true);
            if (selection.price === 0) {
                window.location.href = '/websites';
                return;
            }

            const response = await api.post('/user/billing/checkout', {
                plan: selection.plan,
            });

            if (response.data.success && response.data.data.checkoutUrl) {
                openCheckout(response.data.data.checkoutUrl);
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
                <div className="text-center space-y-4 mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                        Simple, transparent pricing
                    </h1>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                        Unlimited websites on every plan. Pay only for events.
                    </p>
                </div>

                {/* Tab switcher */}
                <div className="flex items-center justify-center mb-12">
                    <div className="flex items-center gap-1 p-1 bg-muted/50 border border-border/60 rounded-xl">
                        <button
                            onClick={() => setMode('individual')}
                            className={cn(
                                'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all',
                                mode === 'individual'
                                    ? 'bg-background text-foreground shadow-sm border border-border/60'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            <Users className="h-4 w-4" />
                            Individual
                        </button>
                        <button
                            onClick={() => setMode('agency')}
                            className={cn(
                                'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all',
                                mode === 'agency'
                                    ? 'bg-background text-foreground shadow-sm border border-border/60'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            <Building2 className="h-4 w-4" />
                            Agency
                        </button>
                    </div>
                </div>

                {/* Agency description */}
                {mode === 'agency' && (
                    <div className="text-center mb-10 animate-in fade-in duration-300">
                        <p className="text-muted-foreground text-sm max-w-xl mx-auto">
                            Manage unlimited client workspaces, white-label the entire platform, and access all data via API.
                            Events are pooled across all clients.
                        </p>
                    </div>
                )}

                {/* Plans */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <PlanBuilder onSubscribe={handleSubscribe} loading={loading} mode={mode} />
                </div>

                {/* Trust section */}
                <div className="mt-24 text-center">
                    <p className="text-muted-foreground font-medium uppercase tracking-wider text-xs mb-8">Trusted by teams worldwide</p>
                    <div className="flex flex-wrap justify-center items-center gap-12 opacity-40 grayscale contrast-200">
                        <div className="text-2xl font-bold italic">TECH FLOW</div>
                        <div className="text-2xl font-bold tracking-tighter">DATA<span className="text-primary italic">CORE</span></div>
                        <div className="text-2xl font-bold underline decoration-emerald-500 underline-offset-4">SAAS.LY</div>
                        <div className="text-2xl font-bold tracking-widest">GROWTH</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
