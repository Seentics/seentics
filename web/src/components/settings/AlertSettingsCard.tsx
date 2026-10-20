'use client';

import { Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { isDemo } from '@/lib/demo';
import { sensitivityOptions } from '@/features/ai/alerts/format';
import { useAlertSettings, useUpdateAlertSettings } from '@/features/ai/alerts/queries';
import type { AlertSensitivity, AlertSettings } from '@/features/ai/alerts/types';
import { useT } from '@/lib/i18n';

/**
 * Turn a site's anomaly alerts on or off and choose how sensitive they are. Owners and
 * admins can change it; everyone else sees the setting, read-only. Saved as soon as it changes.
 */
export function AlertSettingsCard({ websiteId }: { websiteId: string }) {
  const settings = useAlertSettings(websiteId);
  const update = useUpdateAlertSettings(websiteId);
  const tAll = useT();
  const t = tAll.settings.alertCard;
  const options = sensitivityOptions(tAll.ai.alerts.sensitivity);

  if (isDemo(websiteId)) {
    return (
      <Card><CardContent className="p-5 text-sm text-muted-foreground">{t.demo}</CardContent></Card>
    );
  }
  if (settings.isPending) {
    return <Card><CardContent className="space-y-3 p-5"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-9 w-48" /></CardContent></Card>;
  }
  if (settings.isError || !settings.data) {
    return <Card><CardContent className="p-5 text-sm text-destructive">{t.loadFailed}</CardContent></Card>;
  }

  const { enabled, sensitivity, canManage } = settings.data;
  const disabled = !canManage || update.isPending;
  const save = (patch: Partial<AlertSettings>) => {
    update.mutate(patch, {
      onSuccess: () => toast.success(t.saved),
      onError: (err: unknown) => toast.error(err instanceof Error && err.message ? err.message : t.saveFailed),
    });
  };
  const hint = options.find((o) => o.value === sensitivity)?.hint;

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="alerts-enabled" className="text-sm font-medium">{t.detect}</Label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t.detectBody}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {update.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Switch id="alerts-enabled" checked={enabled} disabled={disabled} onCheckedChange={(v) => save({ enabled: v })} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">{t.sensitivity}</Label>
          <Select
            value={sensitivity}
            disabled={disabled || !enabled}
            onValueChange={(v) => save({ sensitivity: v as AlertSensitivity })}
          >
            <SelectTrigger className="w-48" aria-label={t.sensitivityAria}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>

        <div className="flex gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            {t.emails}
            {!canManage && t.ownerOnly}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
