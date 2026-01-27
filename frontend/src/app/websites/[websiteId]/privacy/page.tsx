'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { PrivacySettingsComponent } from '@/components/settings/PrivacySettingsComponent';

export default function PrivacyPage() {
    const params = useParams();
    const websiteId = params?.websiteId as string;

    return (
        <div className="p-4 sm:p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1440px] mx-auto">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Privacy & Compliance</h1>
                <p className="text-muted-foreground font-medium">Configure data protection and GDPR compliance for your website.</p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-border/40 p-8 shadow-sm">
                <PrivacySettingsComponent websiteId={websiteId} />
            </div>
        </div>
    );
}
