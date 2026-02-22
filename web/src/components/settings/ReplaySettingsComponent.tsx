'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  getWebsiteBySiteId,
  updateWebsite,
  Website
} from '@/lib/websites-api';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface ReplaySettingsComponentProps {
  websiteId: string;
}

export function ReplaySettingsComponent({ websiteId }: ReplaySettingsComponentProps) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(true);
  const [samplingRate, setSamplingRate] = useState(100);
  const [includePatterns, setIncludePatterns] = useState('');
  const [excludePatterns, setExcludePatterns] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const { data: website, isLoading } = useQuery<Website | null>({
    queryKey: ['website', websiteId],
    queryFn: () => getWebsiteBySiteId(websiteId),
  });

  useEffect(() => {
    if (website) {
      setEnabled(website.replayEnabled);
      setSamplingRate(Math.round((website.replaySamplingRate || 1.0) * 100));
      setIncludePatterns(website.replayIncludePatterns || '');
      setExcludePatterns(website.replayExcludePatterns || '');
    }
  }, [website]);

  const updateMutation = useMutation({
    mutationFn: async (vars: { enabled: boolean; rate: number; include: string; exclude: string }) => {
      if (!website) return;
      return updateWebsite(website.id, {
        replayEnabled: vars.enabled,
        replaySamplingRate: vars.rate / 100,
        replayIncludePatterns: vars.include || undefined,
        replayExcludePatterns: vars.exclude || undefined,
      }, website.userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website', websiteId] });
      toast.success('Replay settings updated successfully');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update replay settings');
    },
    onSettled: () => {
      setIsSaving(false);
    }
  });

  const handleSave = () => {
    setIsSaving(true);
    updateMutation.mutate({
      enabled,
      rate: samplingRate,
      include: includePatterns,
      exclude: excludePatterns
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card className="border border-border/60 bg-card shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold">Session Replay Configuration</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Control how user sessions are recorded and reconstructed.</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="replay-toggle"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
              <Label htmlFor="replay-toggle" className="text-xs font-medium text-muted-foreground">
                {enabled ? 'Enabled' : 'Disabled'}
              </Label>
            </div>
          </div>

          {!enabled && (
            <Alert className="bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 mb-5">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-700 dark:text-amber-400 font-medium text-sm">Recordings Paused</AlertTitle>
              <AlertDescription className="text-amber-600/80 dark:text-muted-foreground/80 text-xs">
                Session recording is currently disabled. No new interaction data will be collected until enabled.
              </AlertDescription>
            </Alert>
          )}

          <div className={cn("space-y-5 transition-opacity duration-300", !enabled && "opacity-50 pointer-events-none")}>
            {/* Sampling Rate */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Sampling Rate</Label>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">Percentage of sessions to record.</p>
                </div>
                <span className="text-lg font-semibold tabular-nums text-primary">
                  {samplingRate}<span className="text-xs text-muted-foreground ml-0.5">%</span>
                </span>
              </div>

              <div className="px-1">
                <Slider
                  value={[samplingRate]}
                  onValueChange={(vals) => setSamplingRate(vals[0])}
                  max={100}
                  step={1}
                />
                <div className="flex justify-between mt-2 text-[10px] text-muted-foreground/50">
                  <span>Conservative</span>
                  <span>Moderate</span>
                  <span>Full Capture</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
              High sampling rates provide more data but may consume your plan's session recording limits faster.
            </p>

            {/* URL Patterns */}
            <div className="space-y-4 pt-4 border-t border-border/40">
              <div className="space-y-1.5">
                <Label htmlFor="include-patterns" className="text-xs font-medium text-muted-foreground">
                  Include Patterns
                </Label>
                <Textarea
                  id="include-patterns"
                  placeholder="e.g. /products/*, /pricing"
                  className="min-h-[80px] text-sm bg-muted/20 border-border/50"
                  value={includePatterns}
                  onChange={(e) => setIncludePatterns(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Enter URL patterns to specifically record. Leave empty to track all pages. One pattern per line.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="exclude-patterns" className="text-xs font-medium text-muted-foreground">
                  Exclude Patterns
                </Label>
                <Textarea
                  id="exclude-patterns"
                  placeholder="e.g. /admin/*, /checkout/success"
                  className="min-h-[80px] text-sm bg-muted/20 border-border/50"
                  value={excludePatterns}
                  onChange={(e) => setExcludePatterns(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Enter URL patterns to exclude from recording. Useful for sensitive pages.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 mt-4 border-t border-border/40">
            <Button
              onClick={handleSave}
              size="sm"
              disabled={isSaving || !website}
              className="gap-1.5 text-xs font-medium"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
