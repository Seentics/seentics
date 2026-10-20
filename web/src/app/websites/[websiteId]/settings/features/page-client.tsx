'use client';

import { usePathSegment } from '@/lib/path-segment';


import { DashboardPageHeader } from '@/components/dashboard-header';
import { HeatmapSettingsComponent } from '@/components/settings/HeatmapSettingsComponent';
import { ReplaySettingsComponent } from '@/components/settings/ReplaySettingsComponent';
import { ScriptSettingsComponent } from '@/components/settings/ScriptSettingsComponent';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { useT } from '@/lib/i18n';

export default function TrackingFeaturesSettingsPage() {
  const params = { websiteId: usePathSegment(1) ?? '' };
  const websiteId = params?.websiteId as string;
  const t = useT().settings.featuresPage;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <DashboardPageHeader
        title={t.title}
        description={t.description}
      />

      <Alert className="border border-border bg-blue-50 dark:bg-blue-950/30">
        <Info className="h-4 w-4" />
        <AlertTitle className="text-sm">{t.emptyTitle}</AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground leading-relaxed">
          {t.emptyBefore}<strong>{t.heatmaps}</strong>{t.emptyMiddle}<strong>{t.include}</strong>{t.emptyAfter}
        </AlertDescription>
      </Alert>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground px-1">{t.heatmaps}</h2>
        <HeatmapSettingsComponent websiteId={websiteId} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground px-1">{t.sessionReplay}</h2>
        <ReplaySettingsComponent websiteId={websiteId} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground px-1">{t.funnelsAutomations}</h2>
        <ScriptSettingsComponent websiteId={websiteId} />
      </section>
    </div>
  );
}
