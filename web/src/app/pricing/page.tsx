'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { isEnterprise } from '@/lib/features';
import { useRouter } from 'next/navigation';
import { PlanBuilder, PlanSelection } from '@/components/subscription/PlanBuilder';
import type { PlanFamily } from '@/features/plans/types';
import { useAuth } from '@/stores/useAuthStore';
import { rememberCheckoutIntent, startCheckout } from '@/lib/checkout';

export default function PricingPage() {
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const [loading, setLoading] = useState(false);
    // The Observability site links here with ?product=observe, so the page opens on Suite + that product — the
    // same two tabs its own pricing section shows. Read once on mount
    // rather than via useSearchParams, which would need a Suspense boundary
    // around the whole page for no benefit.
    const [families, setFamilies] = useState<PlanFamily[]>(['suite', 'core']);
    useEffect(() => {
        const product = new URLSearchParams(window.location.search).get('product');
        if (product === 'observe') setFamilies(['suite', product]);
    }, []);

    useEffect(() => {
        if (!isEnterprise) {
            router.replace('/');
        }
    }, [router]);

    if (!isEnterprise) return null;

    const handleSubscribe = async (selection: PlanSelection) => {
        if (selection.price === 0) {
            window.location.href = isAuthenticated ? '/websites' : '/signup';
            return;
        }
        if (!isAuthenticated) {
            // Sign up first; the dashboard then takes them straight to this plan's checkout.
            rememberCheckoutIntent(selection.plan);
            router.push('/signup');
            return;
        }
        try {
            setLoading(true);
            const result = await startCheckout(selection.plan);
            if (result.kind === 'changed') {
                toast.success('Plan changed. The difference is prorated on your bill.');
                router.push('/websites');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || error.response?.data?.message || 'Failed to create checkout. Please try again.');
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
                        Start free. Take the whole suite, or just the product you need.
                    </p>
                </div>

                {/* Plans */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <PlanBuilder onSubscribe={handleSubscribe} loading={loading} families={families} />
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
