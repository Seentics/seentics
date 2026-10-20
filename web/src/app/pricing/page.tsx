'use client';

import { useEffect } from 'react';
import { isEnterprise } from '@/lib/features';
import { useRouter } from 'next/navigation';
import { PlanBuilder } from '@/components/subscription/PlanBuilder';
import { useFoundingSpots } from '@/features/plans/queries';
import { usePlanSubscribe } from '@/features/billing/usePlanSubscribe';
import { useT } from '@/lib/i18n';
import LandingHeader from '@/components/landing/LandingHeader';
import Footer from '@/components/landing/Footer';

export default function PricingPage() {
    const router = useRouter();
    const t = useT();
    const { subscribe, loading } = usePlanSubscribe();
    const { data: founding } = useFoundingSpots();

    useEffect(() => {
        if (!isEnterprise) {
            router.replace('/');
        }
    }, [router]);

    if (!isEnterprise) return null;

    // The site's header and footer, and the landing page's ground and type: this page used
    // to stand alone, with neither, and read as a different site.
    return (
        <div className="lx flex min-h-screen flex-col bg-background">
            <LandingHeader alwaysBordered />
            <main className="flex-1 pt-[72px] sm:pt-20">
                <div className="landing-container py-16 sm:py-24">
                    <div className="mb-12 grid gap-6 lg:grid-cols-2 lg:items-end lg:gap-16">
                        <h1 className="lx-display text-[2.25rem] sm:text-5xl">
                            {t.pricingSection.titleA}
                            <br />
                            <span>{t.pricingSection.titleB}</span>
                        </h1>
                        <p className="lx-dim max-w-md text-base leading-relaxed">
                            {t.pricingSection.body}
                        </p>
                    </div>
                    <PlanBuilder onSubscribe={subscribe} loading={loading} founding={founding} />
                </div>
            </main>
            <Footer />
        </div>
    );
}
