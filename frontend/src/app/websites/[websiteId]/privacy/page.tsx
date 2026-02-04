'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { PrivacySettingsComponent } from '@/components/settings/PrivacySettingsComponent';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Shield } from 'lucide-react';

export default function PrivacyPage() {
    const params = useParams();
    const websiteId = params?.websiteId as string;

    return (
        <div className="p-4 sm:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1440px] mx-auto">
            <DashboardPageHeader 
                title="Privacy & Compliance"
                description="Configure data protection and GDPR compliance for your website."
            />

            <div className="bg-card rounded-[2.5rem] border border-border/40 p-8 shadow-sm">
                <PrivacySettingsComponent websiteId={websiteId} />
            </div>
        </div>
    );
}
