'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    Settings, 
    Users, 
    Code, 
    Target, 
    Globe, 
    CreditCard 
} from 'lucide-react';

import { GeneralSettingsComponent } from '@/components/settings/GeneralSettingsComponent';
import { TeamSettingsComponent } from '@/components/settings/TeamSettingsComponent';
import { TrackingSettingsComponent } from '@/components/settings/TrackingSettingsComponent';
import { GoalsSettingsComponent } from '@/components/settings/GoalsSettingsComponent';
import { WebsitesSettingsComponent } from '@/components/settings/WebsitesSettingsComponent';
export default function SettingsPage() {
    const params = useParams();
    const websiteId = params?.websiteId as string;

    const tabs = [
        { id: 'general', label: 'General', icon: Settings, component: GeneralSettingsComponent },
        { id: 'websites', label: 'Websites', icon: Globe, component: WebsitesSettingsComponent },
        { id: 'team', label: 'Team', icon: Users, component: TeamSettingsComponent },
        { id: 'tracking', label: 'Tracking', icon: Code, component: TrackingSettingsComponent },
        { id: 'goals', label: 'Goals', icon: Target, component: GoalsSettingsComponent },
    ];

    return (
        <div className="p-4 sm:p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1440px] mx-auto">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Website Settings</h1>
                <p className="text-muted-foreground font-medium">Configure and manage your property preferences and compliance.</p>
            </div>

            <Tabs defaultValue="general" className="w-full space-y-8">
                <div className="border-b border-border/40 pb-px">
                    <TabsList className="h-auto bg-transparent p-0 gap-6 w-full justify-start overflow-x-auto custom-scrollbar no-scrollbar flex-nowrap">
                        {tabs.map((tab) => (
                            <TabsTrigger
                                key={tab.id}
                                value={tab.id}
                                className="h-11 px-1 bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none text-muted-foreground data-[state=active]:text-foreground font-bold transition-all gap-2"
                            >
                                <tab.icon className="h-4 w-4" />
                                {tab.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                {tabs.map((tab) => (
                    <TabsContent key={tab.id} value={tab.id} className="mt-0 outline-none">
                        <tab.component websiteId={websiteId} />
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
}
