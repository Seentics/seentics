'use client';

import React, { useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
    User,
    Globe,
    Zap,
    MousePointer2,
    Video,
    Settings,
    ChevronRight,
} from 'lucide-react';

import { ProfileSettings } from '@/components/profile-settings';
import { WebsitesSettingsComponent } from '@/components/settings/WebsitesSettingsComponent';
import { ScriptSettingsComponent } from '@/components/settings/ScriptSettingsComponent';
import { HeatmapSettingsComponent } from '@/components/settings/HeatmapSettingsComponent';
import { ReplaySettingsComponent } from '@/components/settings/ReplaySettingsComponent';
import { cn } from '@/lib/utils';

const tabs = [
    { id: 'profile', label: 'Profile', description: 'Your account details', icon: User },
    { id: 'websites', label: 'Websites', description: 'Manage tracked sites', icon: Globe },
    { id: 'heatmaps', label: 'Heatmaps', description: 'Click & scroll tracking', icon: MousePointer2 },
    { id: 'replays', label: 'Replays', description: 'Session recording config', icon: Video },
    { id: 'scripts', label: 'Scripts', description: 'Feature toggles', icon: Zap },
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

    const activeTabData = tabs.find(t => t.id === activeTab);

    return (
        <div className="min-h-[calc(100vh-4rem)] animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row">
                {/* Sidebar */}
                <aside className="w-full lg:w-64 xl:w-72 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-border/40 bg-muted/20">
                    <div className="p-5 lg:p-6 lg:sticky lg:top-16">
                        <div className="flex items-center gap-2.5 mb-6">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Settings className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-sm font-semibold text-foreground">Settings</h1>
                                <p className="text-[11px] text-muted-foreground">Manage your preferences</p>
                            </div>
                        </div>

                        {/* Navigation */}
                        <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-1 lg:pb-0 -mx-1">
                            {tabs.map((tab) => {
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={cn(
                                            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all w-full min-w-fit group',
                                            isActive
                                                ? 'bg-background shadow-sm border border-border/60 text-foreground'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                        )}
                                    >
                                        <div className={cn(
                                            'h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0 transition-colors',
                                            isActive ? 'bg-primary/10' : 'bg-transparent group-hover:bg-muted/50'
                                        )}>
                                            <tab.icon className={cn(
                                                'h-4 w-4 transition-colors',
                                                isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                                            )} />
                                        </div>
                                        <div className="hidden lg:block flex-1 min-w-0">
                                            <p className={cn(
                                                'text-[13px] font-medium truncate',
                                                isActive ? 'text-foreground' : ''
                                            )}>
                                                {tab.label}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground/70 truncate">
                                                {tab.description}
                                            </p>
                                        </div>
                                        <span className="lg:hidden text-xs font-medium whitespace-nowrap">{tab.label}</span>
                                        <ChevronRight className={cn(
                                            'h-3.5 w-3.5 flex-shrink-0 hidden lg:block transition-opacity',
                                            isActive ? 'opacity-40' : 'opacity-0 group-hover:opacity-30'
                                        )} />
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                </aside>

                {/* Content */}
                <main className="flex-1 min-w-0">
                    <div className="p-6 md:p-8 max-w-4xl">
                        {/* Content header */}
                        <div className="mb-6 pb-5 border-b border-border/40">
                            <h2 className="text-lg font-semibold text-foreground">{activeTabData?.label}</h2>
                            <p className="text-sm text-muted-foreground mt-0.5">{activeTabData?.description}</p>
                        </div>

                        {/* Tab content */}
                        <div className="animate-in fade-in duration-300">
                            {renderContent()}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
