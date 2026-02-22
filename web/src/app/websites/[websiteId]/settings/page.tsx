'use client';

import React, { useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
    User,
    Globe,
    Zap,
    MousePointer2,
    Video,
} from 'lucide-react';

import { ProfileSettings } from '@/components/profile-settings';
import { WebsitesSettingsComponent } from '@/components/settings/WebsitesSettingsComponent';
import { ScriptSettingsComponent } from '@/components/settings/ScriptSettingsComponent';
import { HeatmapSettingsComponent } from '@/components/settings/HeatmapSettingsComponent';
import { ReplaySettingsComponent } from '@/components/settings/ReplaySettingsComponent';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { cn } from '@/lib/utils';

const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'websites', label: 'Websites', icon: Globe },
    { id: 'heatmaps', label: 'Heatmaps', icon: MousePointer2 },
    { id: 'replays', label: 'Replays', icon: Video },
    { id: 'scripts', label: 'Scripts', icon: Zap },
];

export default function SettingsPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const websiteId = params?.websiteId as string;
    const tabParam = searchParams.get('tab');
    const isValidTab = tabs.some(t => t.id === tabParam);
    const [activeTab, setActiveTab] = useState(isValidTab ? tabParam! : 'profile');

    const renderContent = () => {
        switch (activeTab) {
            case 'profile': return <ProfileSettings />;
            case 'websites': return <WebsitesSettingsComponent />;
            case 'heatmaps': return <HeatmapSettingsComponent websiteId={websiteId} />;
            case 'replays': return <ReplaySettingsComponent websiteId={websiteId} />;
            case 'scripts': return <ScriptSettingsComponent websiteId={websiteId} />;
            default: return <ProfileSettings />;
        }
    };

    return (
        <div className="p-4 sm:p-8 space-y-6 animate-in fade-in duration-500 max-w-[1440px] mx-auto">
            <DashboardPageHeader
                title="Settings"
                description="Manage your account, websites, and feature configurations."
            />

            {/* Horizontal Tabs */}
            <div className="border-b border-border/40">
                <nav className="flex gap-1 overflow-x-auto pb-px -mb-px">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all',
                                    isActive
                                        ? 'border-primary text-foreground'
                                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                                )}
                            >
                                <tab.icon className={cn(
                                    'h-4 w-4',
                                    isActive ? 'text-primary' : 'text-muted-foreground'
                                )} />
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="animate-in fade-in duration-300">
                {renderContent()}
            </div>
        </div>
    );
}
