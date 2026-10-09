'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { isEnterprise } from '@/lib/features';
import { useRouter } from 'next/navigation';
import { PlanBuilder, PlanSelection } from '@/components/subscription/PlanBuilder';
import { useAuth } from '@/stores/useAuthStore';
import { rememberCheckoutIntent, startCheckout } from '@/lib/checkout';

export default function PricingPage() {
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const [loading, setLoading] = useState(false);

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
            await startCheckout(selection.plan);
        } catch (error: any) {
            toast.error(error.response?.data?.error || error.response?.data?.message || 'Failed to create checkout. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background py-20 px-6">
            <div className="max-w-7xl mx-auto">
                <div className="text-center space-y-4 mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                        Start free. Pay only as you grow.
                    </h1>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                        Analytics, replay and observability in one plan.
                    </p>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <PlanBuilder onSubscribe={handleSubscribe} loading={loading} />
                </div>
            </div>
        </div>
    );
}
