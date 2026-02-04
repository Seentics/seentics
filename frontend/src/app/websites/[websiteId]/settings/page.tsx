'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    User,
    Globe,
    Target,
    Settings
} from 'lucide-react';

import { ProfileSettings } from '@/components/profile-settings';
import { WebsitesSettingsComponent } from '@/components/settings/WebsitesSettingsComponent';
import { GoalsSettingsComponent } from '@/components/settings/GoalsSettingsComponent';
import { DashboardPageHeader } from '@/components/dashboard-header';

export default function SettingsPage() {
    const params = useParams();
    const websiteId = params?.websiteId as string;

    const tabs = [
        { id: 'profile', label: 'User Profile', icon: User, component: ProfileSettings },
        { id: 'websites', label: 'Websites', icon: Globe, component: WebsitesSettingsComponent },
    ];

    return (
        <div className="p-4  space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1440px] mx-auto">
            <DashboardPageHeader 
                title="Settings"
                description="Manage your personal profile and website configurations."
            />

            <Tabs defaultValue="profile" className="w-full space-y-8">
                <div className="border-b border-border/40 pb-px">
                    <TabsList className="h-auto dark:bg-gray-800/50 p-2 gap-6 w-full justify-start overflow-x-auto custom-scrollbar no-scrollbar flex-nowrap rounded-md">
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
                        <div className="">
                            {/* @ts-ignore */}
                            <tab.component websiteId={websiteId} />
                        </div>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
}
