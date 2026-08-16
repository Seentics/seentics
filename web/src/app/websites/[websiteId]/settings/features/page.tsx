'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { HeatmapSettingsComponent } from '@/components/settings/HeatmapSettingsComponent';
import { ReplaySettingsComponent } from '@/components/settings/ReplaySettingsComponent';
import { ScriptSettingsComponent } from '@/components/settings/ScriptSettingsComponent';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export default function TrackingFeaturesSettingsPage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <DashboardPageHeader
        title="Tracking features"
        description="Turn heatmaps, session replay, funnels, and automations on or off. URL patterns here apply the next time visitors load your site with the tracker."
      />

      <Alert className="border border-border/50 bg-blue-50 dark:bg-blue-950/30">
        <Info className="h-4 w-4" />
        <AlertTitle className="text-sm">Heatmaps look empty?</AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground leading-relaxed">
          Confirm <strong>Heatmaps</strong> is enabled below, clear restrictive <strong>include</strong> patterns while testing on{' '}
          <code className="rounded-lg bg-muted px-1">localhost</code>, then rebuild the tracker bundle{' '}
          <code className="rounded-lg bg-muted px-1">npm run bundle-trackers</code> in <code className="rounded-lg bg-muted px-1">seentics/web</code> so{' '}
          <Link href="/trackers/seentics.min.js" className="underline underline-offset-2">
            /trackers/seentics.min.js
          </Link>{' '}
          matches your source. Hard-refresh the page under test.
        </AlertDescription>
      </Alert>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground px-1">Heatmaps</h2>
        <HeatmapSettingsComponent websiteId={websiteId} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground px-1">Session replay</h2>
        <ReplaySettingsComponent websiteId={websiteId} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground px-1">Funnels &amp; automations</h2>
        <ScriptSettingsComponent websiteId={websiteId} />
      </section>
    </div>
  );
}
