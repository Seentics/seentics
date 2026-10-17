'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { isEnterprise } from '@/lib/features';
import { useRouter } from 'next/navigation';
import { PlanBuilder, PlanSelection } from '@/components/subscription/PlanBuilder';
import { useAuth } from '@/stores/useAuthStore';
import { rememberCheckoutIntent, startCheckout } from '@/lib/checkout';
import LandingHeader from '@/components/landing/LandingHeader';
import Footer from '@/components/landing/Footer';

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
            rememberCheckoutIntent(selection.plan, selection.interval, selection.discount);
            router.push('/signup');
            return;
        }
        try {
            setLoading(true);
            await startCheckout(selection.plan, selection.interval, selection.discount);
        } catch (error: any) {
            toast.error(error.response?.data?.error || error.response?.data?.message || 'Failed to create checkout. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // The site's header and footer, and the landing page's ground and type: this page used
    // to stand alone, with neither, and read as a different site.
    return (
        <div className="lx flex min-h-screen flex-col bg-background">
            <LandingHeader alwaysBordered />
            <main className="flex-1 pt-[72px] sm:pt-20">
                <div className="landing-container py-16 sm:py-24">
                    <div className="mb-12 grid gap-6 lg:grid-cols-2 lg:items-end lg:gap-16">
                        <h1 className="lx-display text-[2.25rem] sm:text-5xl">
                            Every plan has everything.
                            <br />
                            <span className="lx-dim">Only the amounts differ.</span>
                        </h1>
                        <p className="lx-dim max-w-md text-base leading-relaxed">
                            Analytics, replay, heatmaps, funnels and popups on every plan. Free, Starter and Pro differ only in how many events and recordings they include; Agency adds client workspaces for the sites you run for clients.
                        </p>
                    </div>
                    <PlanBuilder onSubscribe={handleSubscribe} loading={loading} />
                </div>
            </main>
            <Footer />
        </div>
    );
}
