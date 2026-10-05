'use client';

import { usePathSegment } from '@/lib/path-segment';


import { DashboardPageHeader } from '@/components/dashboard-header';
import { HeatmapSettingsComponent } from '@/components/settings/HeatmapSettingsComponent';
import { ReplaySettingsComponent } from '@/components/settings/ReplaySettingsComponent';
import { ScriptSettingsComponent } from '@/components/settings/ScriptSettingsComponent';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export default function TrackingFeaturesSettingsPage() {
  const params = { websiteId: usePathSegment(1) ?? '' };
  const websiteId = params?.websiteId as string;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <DashboardPageHeader
        title="Tracking"
        description="Choose what Seentics records on your site: heatmaps, session recordings, funnels and automations. Changes apply the next time a visitor loads a page."
      />

      <Alert className="border border-border bg-blue-50 dark:bg-blue-950/30">
        <Info className="h-4 w-4" />
        <AlertTitle className="text-sm">Heatmaps look empty?</AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground leading-relaxed">
          Check that <strong>Heatmaps</strong> is turned on below, and clear any <strong>include</strong> page patterns while you
          test, since a pattern only records pages that match it. Then reload your site: changes apply the next time a visitor
          loads a page.
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
