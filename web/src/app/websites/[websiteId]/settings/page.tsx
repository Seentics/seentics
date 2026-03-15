'use client';

import React, { useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
    Zap,
    MousePointer2,
    Video,
    Target,
    PanelLeft,
    Key,
    Users,
    Shield,
    Bell,
    FileText,
} from 'lucide-react';

import { ScriptSettingsComponent } from '@/components/settings/ScriptSettingsComponent';
import { HeatmapSettingsComponent } from '@/components/settings/HeatmapSettingsComponent';
import { ReplaySettingsComponent } from '@/components/settings/ReplaySettingsComponent';
import { GoalsSettingsComponent } from '@/components/settings/GoalsSettingsComponent';
import { LayoutSettingsComponent } from '@/components/settings/LayoutSettingsComponent';
import { AlertsSettingsComponent } from '@/components/settings/AlertsSettingsComponent';
import { ReportsSettingsComponent } from '@/components/settings/ReportsSettingsComponent';
import { ApiKeysSettingsComponent } from '@/components/settings/ApiKeysSettingsComponent';
import { TeamSettingsComponent } from '@/components/settings/TeamSettingsComponent';
import { PrivacySettingsComponent } from '@/components/settings/PrivacySettingsComponent';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { cn } from '@/lib/utils';
import { isEnterprise } from '@/lib/features';

const sectionGroups = [
    {
        label: 'Features',
        items: [
            { id: 'goals',    label: 'Goals',    icon: Target,        description: 'Conversion tracking' },
            { id: 'heatmaps', label: 'Heatmaps', icon: MousePointer2, description: 'Click & scroll maps' },
            { id: 'replays',  label: 'Replays',  icon: Video,         description: 'Session recordings' },
            { id: 'scripts',  label: 'Scripts',   icon: Zap,           description: 'Tracking snippet' },
        ],
    },
    {
        label: 'Automation',
        items: [
            { id: 'alerts',   label: 'Alerts',   icon: Bell,     description: 'Traffic notifications' },
            { id: 'reports',  label: 'Reports',  icon: FileText, description: 'Scheduled email reports' },
        ],
    },
    {
        label: 'Advanced',
        items: [
            { id: 'privacy',  label: 'Privacy',   icon: Shield,    description: 'Data protection & GDPR' },
            { id: 'layout',   label: 'Layout',    icon: PanelLeft, description: 'Dashboard layout' },
            ...(isEnterprise ? [
                { id: 'api-keys', label: 'API Keys', icon: Key,      description: 'Raw data API access' },
                { id: 'team',     label: 'Team',     icon: Users,    description: 'Manage members & roles' },
            ] : []),
        ],
    },
];

const allTabs = sectionGroups.flatMap(g => g.items);

const iconColors: Record<string, string> = {
    goals:         'text-orange-500 bg-orange-500/10',
    heatmaps:      'text-rose-500 bg-rose-500/10',
    replays:       'text-indigo-500 bg-indigo-500/10',
    scripts:       'text-yellow-500 bg-yellow-500/10',
    alerts:        'text-amber-500 bg-amber-500/10',
    reports:       'text-indigo-500 bg-indigo-500/10',
    privacy:       'text-emerald-600 bg-emerald-500/10',
    layout:        'text-cyan-500 bg-cyan-500/10',
    'api-keys':    'text-emerald-500 bg-emerald-500/10',
    team:          'text-indigo-500 bg-indigo-500/10',
};

const renderContent = (activeTab: string, websiteId: string) => {
    switch (activeTab) {
        case 'heatmaps':      return <HeatmapSettingsComponent websiteId={websiteId} />;
        case 'replays':       return <ReplaySettingsComponent websiteId={websiteId} />;
        case 'goals':         return <GoalsSettingsComponent websiteId={websiteId} />;
        case 'scripts':       return <ScriptSettingsComponent websiteId={websiteId} />;
        case 'alerts':        return <AlertsSettingsComponent />;
        case 'reports':       return <ReportsSettingsComponent />;
        case 'privacy':       return <PrivacySettingsComponent websiteId={websiteId} />;
        case 'layout':        return <LayoutSettingsComponent />;
        case 'api-keys':      return <ApiKeysSettingsComponent websiteId={websiteId} />;
        case 'team':          return <TeamSettingsComponent websiteId={websiteId} />;
        default:              return <GoalsSettingsComponent websiteId={websiteId} />;
    }
};

export default function SettingsPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const websiteId = params?.websiteId as string;
    const tabParam = searchParams.get('tab');
    const isValidTab = allTabs.some(t => t.id === tabParam);
    const [activeTab, setActiveTab] = useState(isValidTab ? tabParam! : 'goals');

    const activeItem = allTabs.find(t => t.id === activeTab);
    const ActiveIcon = activeItem?.icon;

    return (
        <div className="p-6 md:p-8 max-w-[1300px] mx-auto animate-in fade-in duration-500">
            {/* Page header */}
            <div className="mb-6">
                <DashboardPageHeader
                    title="Settings"
                    description="Configure features, automation, and advanced options."
                />
            </div>

            {/* Tab bar — grouped with dividers */}
            <div className="flex items-end gap-0 border-b border-border/60 mb-8 overflow-x-auto">
                {sectionGroups.map((group, gi) => (
                    <React.Fragment key={group.label}>
                        {/* Divider between groups (not before first) */}
                        {gi > 0 && (
                            <div className="w-px h-5 bg-border/60 self-center mx-1 flex-shrink-0" />
                        )}
                        {group.items.map((tab) => {
                            const isActive = activeTab === tab.id;
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex-shrink-0',
                                        isActive
                                            ? 'border-primary text-foreground'
                                            : 'border-transparent text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <div className={cn(
                                        'w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all',
                                        isActive ? iconColors[tab.id] : 'text-muted-foreground'
                                    )}>
                                        <Icon className="h-3 w-3" />
                                    </div>
                                    {tab.label}
                                </button>
                            );
                        })}
                    </React.Fragment>
                ))}
            </div>

            {/* Content */}
            <div className="animate-in fade-in duration-200" key={activeTab}>
                {activeItem && (
                    <div className="mb-6 pb-6 border-b border-border/40 flex items-center gap-3">
                        {ActiveIcon && (
                            <div className={cn(
                                'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                                iconColors[activeTab] || 'bg-muted text-muted-foreground'
                            )}>
                                <ActiveIcon className="h-4 w-4" />
                            </div>
                        )}
                        <div>
                            <h2 className="text-sm font-bold text-foreground leading-none">{activeItem.label}</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">{activeItem.description}</p>
                        </div>
                    </div>
                )}
                {renderContent(activeTab, websiteId)}
            </div>
        </div>
    );
}
