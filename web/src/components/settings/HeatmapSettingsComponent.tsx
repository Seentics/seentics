'use client';

import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { updateWebsite, getWebsiteBySiteId } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Save, Info, CheckCircle2, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface HeatmapSettingsProps {
  websiteId: string;
}

export function HeatmapSettingsComponent({ websiteId }: HeatmapSettingsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: website, isLoading } = useQuery({
    queryKey: ['website', websiteId],
    queryFn: () => getWebsiteBySiteId(websiteId),
    enabled: !!websiteId,
  });

  const [heatmapEnabled, setHeatmapEnabled] = useState(true);
  const [includePatterns, setIncludePatterns] = useState('');
  const [excludePatterns, setExcludePatterns] = useState('');

  useEffect(() => {
    if (website) {
      setHeatmapEnabled(website.heatmapEnabled);
      setIncludePatterns(website.heatmapIncludePatterns || '');
      setExcludePatterns(website.heatmapExcludePatterns || '');
    }
  }, [website]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => updateWebsite(websiteId, data, user?.id || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website', websiteId] });
      toast.success('Heatmap settings updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update heatmap settings');
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      heatmapEnabled,
      heatmapIncludePatterns: includePatterns,
      heatmapExcludePatterns: excludePatterns,
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
              <h3 className="text-sm font-semibold">Heatmap Configuration</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Control how heatmaps are recorded on your website.</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="heatmap-toggle"
                checked={heatmapEnabled}
                onCheckedChange={setHeatmapEnabled}
              />
              <Label htmlFor="heatmap-toggle" className="text-xs font-medium text-muted-foreground">
                {heatmapEnabled ? 'Enabled' : 'Disabled'}
              </Label>
            </div>
          </div>

          {!heatmapEnabled && (
            <Alert className="bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 mb-5">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-700 dark:text-amber-400 font-medium text-sm">Heatmaps Paused</AlertTitle>
              <AlertDescription className="text-amber-600/80 dark:text-muted-foreground/80 text-xs">
                Heatmap recording is currently disabled. No new interaction data will be collected until enabled.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
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
                Enter URL patterns to specifically include. Leave empty to track all pages. One pattern per line.
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
                Enter URL patterns to exclude from heatmap recording. Useful for sensitive pages.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-4 mt-4 border-t border-border/40">
            <Button
              onClick={handleSave}
              size="sm"
              disabled={updateMutation.isPending}
              className="gap-1.5 text-xs font-medium"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border border-border/60 bg-card shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-semibold">Pattern Examples</span>
            </div>
            <div className="space-y-1.5 text-[11px] text-muted-foreground">
              <p><code className="bg-muted px-1 rounded text-foreground">/products/*</code> matches all product pages</p>
              <p><code className="bg-muted px-1 rounded text-foreground">/blog/post-title</code> matches an exact page</p>
              <p><code className="bg-muted px-1 rounded text-foreground">*/search?q=*</code> matches search pages</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-card shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="h-3.5 w-3.5 text-rose-500" />
              <span className="text-xs font-semibold">Exclusion Tips</span>
            </div>
            <div className="space-y-1.5 text-[11px] text-muted-foreground">
              <p>Exclude <code className="bg-muted px-1 rounded text-foreground">/admin/*</code> to avoid tracking internal tools</p>
              <p>Exclude <code className="bg-muted px-1 rounded text-foreground">/login</code> and <code className="bg-muted px-1 rounded text-foreground">/signup</code> for privacy</p>
              <p>Exclude <code className="bg-muted px-1 rounded text-foreground">/settings/*</code> for sensitive user data</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
