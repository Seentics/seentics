'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { isEnterprise } from '@/lib/features';
import { useRouter } from 'next/navigation';
import { PlanBuilder, PlanSelection } from '@/components/subscription/PlanBuilder';
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
                <div className="text-center space-y-4 mb-16 animate-in fade-in slide-in-from-top-4 duration-700">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                        Simple, transparent pricing
                    </h1>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                        Choose the plan that fits your needs. Start free and scale as you grow.
                    </p>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <PlanBuilder onSubscribe={handleSubscribe} loading={loading} />
                </div>

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
