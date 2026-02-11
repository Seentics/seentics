'use client';

import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { updateWebsite, getWebsiteBySiteId } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold">Heatmap Configuration</CardTitle>
              <CardDescription>Control how heatmaps are recorded on your website.</CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Switch 
                id="heatmap-toggle" 
                checked={heatmapEnabled} 
                onCheckedChange={setHeatmapEnabled}
              />
              <Label htmlFor="heatmap-toggle" className="font-bold text-xs uppercase tracking-wider">
                {heatmapEnabled ? 'Enabled' : 'Disabled'}
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!heatmapEnabled && (
            <Alert className="bg-amber-500/10 border-amber-500/20">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-600 font-bold">Heatmaps Paused</AlertTitle>
              <AlertDescription className="text-muted-foreground/80">
                Heatmap recording is currently disabled. No new interaction data will be collected until enabled.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="include-patterns" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Include Patterns
              </Label>
              <Textarea
                id="include-patterns"
                placeholder="e.g. /products/*, /pricing"
                className="min-h-[100px] bg-muted/20 border-border/40 font-mono text-sm"
                value={includePatterns}
                onChange={(e) => setIncludePatterns(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground italic">
                Enter URL patterns to specifically include. Leave empty to track all pages (default). One pattern per line. Use * as a wildcard.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="exclude-patterns" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Exclude Patterns
              </Label>
              <Textarea
                id="exclude-patterns"
                placeholder="e.g. /admin/*, /checkout/success"
                className="min-h-[100px] bg-muted/20 border-border/40 font-mono text-sm"
                value={excludePatterns}
                onChange={(e) => setExcludePatterns(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground italic">
                Enter URL patterns to exclude from heatmap recording. Useful for sensitive pages. One pattern per line.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end pt-4 border-t border-border/40">
            <Button 
              onClick={handleSave} 
              disabled={updateMutation.isPending}
              className="px-8 font-bold gap-2"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border/40 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Pattern Examples
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] space-y-2 text-muted-foreground font-medium">
            <p><code className="bg-muted px-1 rounded text-primary">/products/*</code> matches all product pages</p>
            <p><code className="bg-muted px-1 rounded text-primary">/blog/post-title</code> matches an exact page</p>
            <p><code className="bg-muted px-1 rounded text-primary">*/search?q=*</code> matches search pages with any query</p>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <XCircle className="h-4 w-4 text-rose-500" />
              Exclusion Tips
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] space-y-2 text-muted-foreground font-medium">
            <p>Exclude <code className="bg-muted px-1 rounded text-primary">/admin/*</code> to avoid tracking internal tools</p>
            <p>Exclude <code className="bg-muted px-1 rounded text-primary">/login</code> and <code className="bg-muted px-1 rounded text-primary">/signup</code> for privacy</p>
            <p>Exclude <code className="bg-muted px-1 rounded text-primary">/settings/*</code> for sensitive user data</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
