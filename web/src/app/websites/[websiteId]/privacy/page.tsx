'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PrivacySettingsComponent } from '@/components/settings/PrivacySettingsComponent';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Shield } from 'lucide-react';
import { isEnterprise } from '@/lib/features';

export default function PrivacyPage() {
    const params = useParams();
    const websiteId = params?.websiteId as string;
    const router = useRouter();

    useEffect(() => {
        if (!isEnterprise) {
            router.replace(`/websites/${websiteId}`);
        }
    }, [router, websiteId]);

    if (!isEnterprise) return null;

    return (
        <div className="p-4 sm:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1440px] mx-auto">
            <DashboardPageHeader 
                title="Privacy & Compliance"
                description="Configure data protection and GDPR compliance for your website."
            />

            <div className="bg-card rounded border border-border/40 p-8 shadow-sm">
                <PrivacySettingsComponent websiteId={websiteId} />
            </div>
        </div>
    );
}
