'use client';

import React, { useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
    User,
    Globe,
    Zap,
    MousePointer2,
    Video,
    Target,
    Palette,
    PanelLeft,
} from 'lucide-react';

import { ProfileSettings } from '@/components/profile-settings';
import { WebsitesSettingsComponent } from '@/components/settings/WebsitesSettingsComponent';
import { ScriptSettingsComponent } from '@/components/settings/ScriptSettingsComponent';
import { HeatmapSettingsComponent } from '@/components/settings/HeatmapSettingsComponent';
import { ReplaySettingsComponent } from '@/components/settings/ReplaySettingsComponent';
import { GoalsSettingsComponent } from '@/components/settings/GoalsSettingsComponent';
import { CustomizationSettingsComponent } from '@/components/settings/CustomizationSettingsComponent';
import { LayoutSettingsComponent } from '@/components/settings/LayoutSettingsComponent';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { cn } from '@/lib/utils';

const sectionGroups = [
    {
        label: 'Account',
        items: [
            { id: 'profile', label: 'Profile', icon: User },
            { id: 'websites', label: 'Websites', icon: Globe },
        ],
    },
    {
        label: 'Features',
        items: [
            { id: 'goals', label: 'Goals', icon: Target },
            { id: 'heatmaps', label: 'Heatmaps', icon: MousePointer2 },
            { id: 'replays', label: 'Replays', icon: Video },
            { id: 'scripts', label: 'Scripts', icon: Zap },
        ],
    },
    {
        label: 'Appearance',
        items: [
            { id: 'customization', label: 'Customization', icon: Palette },
            { id: 'layout', label: 'Layout', icon: PanelLeft },
        ],
    },
    // HIDDEN: Enterprise section — uncomment to re-enable
    // ...(isEnterprise ? [{
    //     label: 'Enterprise',
    //     items: [
    //         { id: 'api-keys', label: 'API Keys', icon: Key },
    //         { id: 'alerts', label: 'Alerts', icon: Bell },
    //         { id: 'reports', label: 'Reports', icon: FileText },
    //         { id: 'integrations', label: 'Integrations', icon: Plug },
    //         { id: 'dashboards', label: 'Dashboards', icon: LayoutDashboard },
    //     ],
    // }] : []),
];

const allTabs = sectionGroups.flatMap(g => g.items);

export default function SettingsPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const websiteId = params?.websiteId as string;
    const tabParam = searchParams.get('tab');
    const isValidTab = allTabs.some(t => t.id === tabParam);
    const [activeTab, setActiveTab] = useState(isValidTab ? tabParam! : 'profile');

    const activeItem = allTabs.find(t => t.id === activeTab);

    const renderContent = () => {
        switch (activeTab) {
            case 'profile': return <ProfileSettings />;
            case 'websites': return <WebsitesSettingsComponent />;
            case 'heatmaps': return <HeatmapSettingsComponent websiteId={websiteId} />;
            case 'replays': return <ReplaySettingsComponent websiteId={websiteId} />;
            case 'goals': return <GoalsSettingsComponent websiteId={websiteId} />;
            case 'scripts': return <ScriptSettingsComponent websiteId={websiteId} />;
            case 'customization': return <CustomizationSettingsComponent />;
            case 'layout': return <LayoutSettingsComponent />;
            // HIDDEN: Enterprise tabs — uncomment to re-enable
            // case 'api-keys': return <ApiKeysSettingsComponent />;
            // case 'alerts': return <AlertsSettingsComponent />;
            // case 'reports': return <ReportsSettingsComponent />;
            // case 'integrations': return <IntegrationsSettingsComponent />;
            // case 'dashboards': return <DashboardsSettingsComponent />;
            default: return <ProfileSettings />;
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500 max-w-[1440px] mx-auto">
            <DashboardPageHeader
                title="Settings"
                description="Manage your account, websites, and feature configurations."
            />

            <div className="mt-6 flex gap-6 items-start">
                {/* ── Sidebar nav ── */}
                <aside className="w-52 flex-shrink-0 sticky top-8 max-h-[calc(100vh-6rem)] overflow-y-auto">
                    <nav className="flex flex-col gap-5">
                        {sectionGroups.map((group) => (
                            <div key={group.label}>
                                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
                                    {group.label}
                                </p>
                                <ul className="flex flex-col gap-0.5">
                                    {group.items.map((tab) => {
                                        const isActive = activeTab === tab.id;
                                        return (
                                            <li key={tab.id}>
                                                <button
                                                    onClick={() => setActiveTab(tab.id)}
                                                    className={cn(
                                                        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                                                        isActive
                                                            ? 'bg-primary/10 text-primary'
                                                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                                                    )}
                                                >
                                                    <tab.icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                                                    {tab.label}
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))}
                    </nav>
                </aside>

                {/* ── Divider ── */}
                <div className="w-px self-stretch bg-border/40 flex-shrink-0" />

                {/* ── Content ── */}
                <main className="flex-1 min-w-0 animate-in fade-in duration-300" key={activeTab}>
                    {renderContent()}
                </main>
            </div>
        </div>
    );
}
