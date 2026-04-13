'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CreditCard, Goal, KeyRound, LayoutGrid, LifeBuoy, Shield, User, Users, Layers } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Card, CardContent } from '@/components/ui/card';
import { isEnterprise } from '@/lib/features';
import { isDemo } from '@/lib/demo';

export default function SettingsPage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;

  const pages = [
    {
      title: 'Websites',
      description: 'Add sites, copy tracking snippets, edit details, or remove properties.',
      href: `/websites/${websiteId}/settings/websites`,
      icon: LayoutGrid,
    },
    {
      title: 'Features',
      description: 'Heatmaps, session replay, funnels, automations — enable, disable, and URL patterns.',
      href: `/websites/${websiteId}/settings/features`,
      icon: Layers,
    },
    {
      title: 'Profile',
      description: 'Your name, email, and password.',
      href: `/websites/${websiteId}/settings/profile`,
      icon: User,
    },
    {
      title: 'Developers',
      description: 'API keys, REST API, and integration docs.',
      href: `/websites/${websiteId}/settings/developers`,
      icon: KeyRound,
    },
    {
      title: 'Goals',
      description: 'Define and monitor conversion events.',
      href: `/websites/${websiteId}/settings/goals`,
      icon: Goal,
    },
    {
      title: 'Privacy',
      description: 'Control data collection and compliance options.',
      href: `/websites/${websiteId}/settings/privacy`,
      icon: Shield,
    },
    ...(isEnterprise
      ? [
          {
            title: 'Team',
            description: 'Manage members and permissions.',
            href: `/websites/${websiteId}/settings/team`,
            icon: Users,
          },
        ]
      : []),
    ...(isEnterprise || isDemo(websiteId)
      ? [
          {
            title: 'Billing',
            description: 'Manage subscription and usage.',
            href: `/websites/${websiteId}/settings/billing`,
            icon: CreditCard,
          },
        ]
      : []),
    {
      title: 'Support',
      description: 'Contact us, book a call, or get help with your workspace.',
      href: `/websites/${websiteId}/settings/support`,
      icon: LifeBuoy,
    },
  ];

  return (
    <div className="space-y-8 p-4 sm:p-8 animate-in fade-in duration-500">
      <DashboardPageHeader
        title="Settings"
        description="Manage this site below. Open Websites to manage all properties and tracking snippets."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {pages.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full border border-border/60 bg-card shadow-sm transition-colors hover:bg-accent/40">
              <CardContent className="p-5">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
