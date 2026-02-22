'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Shield,
  EyeOff,
  Cookie,
  Info,
} from 'lucide-react';
import { isEnterprise } from '@/lib/features';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { cn } from '@/lib/utils';

export default function PrivacySettings() {
  const params = useParams();
  const websiteId = params?.websiteId as string;
  const router = useRouter();

  useEffect(() => {
    if (!isEnterprise) {
      router.replace(`/websites/${websiteId}/settings`);
    }
  }, [router, websiteId]);

  if (!isEnterprise) return null;

  const toggles = [
    {
      id: 'ip-anonymization',
      title: 'IP Anonymization',
      description: 'Automatically mask the last octet of visitor IP addresses before storage. Recommended for GDPR compliance.',
      icon: EyeOff,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      defaultChecked: true,
    },
    {
      id: 'cookie-less',
      title: 'Cookie-less Mode',
      description: 'Track unique visitors without using persistent cookies. Eliminates the need for cookie consent banners in most jurisdictions.',
      icon: Cookie,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
      defaultChecked: true,
    },
  ];

  return (
    <div className="p-4 sm:p-8 space-y-8 animate-in fade-in duration-500 max-w-[1440px] mx-auto">
      <DashboardPageHeader
        title="Privacy & GDPR"
        description="Configure data protection and compliance settings."
      >
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <Shield className="h-3 w-3 text-emerald-600" />
          <span className="text-[10px] font-medium text-emerald-600">GDPR Compliant</span>
        </div>
      </DashboardPageHeader>

      {/* Toggles */}
      <div className="space-y-3">
        {toggles.map((item) => (
          <Card key={item.id} className="border border-border/60 bg-card shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0", item.bgColor)}>
                  <item.icon className={cn("h-4 w-4", item.color)} />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-md">{item.description}</p>
                </div>
              </div>
              <Switch id={item.id} defaultChecked={item.defaultChecked} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Data Retention */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Data Retention</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Card className="border border-border/60 bg-card shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Retention Period</p>
              <p className="text-sm font-medium">Based on your plan</p>
            </CardContent>
          </Card>
          <Card className="border border-border/60 bg-card shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Cleanup Schedule</p>
              <p className="text-sm font-medium">Automatic (Weekly)</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Info */}
      <div className="bg-muted/30 border border-border/40 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Privacy First</span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Seentics is privacy-friendly by default. We never track personally identifiable information (PII) of your visitors without explicit configuration.
        </p>
      </div>
    </div>
  );
}
