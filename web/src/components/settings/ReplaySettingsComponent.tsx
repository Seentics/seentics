'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Play, Percent, Info, Plus, X, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
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
  const [samplingRate, setSamplingRate] = useState(100); // 0-100 percentage
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
        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold">Session Replay Configuration</CardTitle>
              <CardDescription>Control how user sessions are recorded and reconstructed.</CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Switch 
                id="replay-toggle" 
                checked={enabled} 
                onCheckedChange={setEnabled}
              />
              <Label htmlFor="replay-toggle" className="font-bold text-xs uppercase tracking-wider">
                {enabled ? 'Enabled' : 'Disabled'}
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!enabled && (
            <Alert className="bg-amber-500/10 border-amber-500/20 shadow-sm">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-600 font-bold">Recordings Paused</AlertTitle>
              <AlertDescription className="text-muted-foreground/80">
                Session recording is currently disabled. No new interaction data will be collected until enabled.
              </AlertDescription>
            </Alert>
          )}

          <div className={cn("space-y-6 pt-2 transition-opacity duration-300", !enabled && "opacity-50 pointer-events-none")}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-bold">Sampling Rate</Label>
                    <div className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-black uppercase">
                      Recommended
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">Percentage of sessions to record.</p>
                </div>
                <div className="flex items-center gap-1 font-black text-xl text-primary font-mono tracking-tighter">
                  {samplingRate}<span className="text-xs opacity-50 ml-0.5">%</span>
                </div>
              </div>
              
              <div className="px-2 py-4">
                <Slider 
                  value={[samplingRate]} 
                  onValueChange={(vals) => setSamplingRate(vals[0])}
                  max={100} 
                  step={1}
                  className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:border-primary [&_[role=slider]]:bg-background"
                />
                <div className="flex justify-between mt-3 px-1 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
                  <span>Conservative</span>
                  <span>Moderate</span>
                  <span>Full Capture</span>
                </div>
              </div>
            </div>

            <Alert className="bg-blue-500/5 border-blue-500/10 py-3">
              <Info className="h-4 w-4 text-blue-500/70" />
              <AlertDescription className="text-[11px] font-medium leading-relaxed text-blue-500/70 uppercase tracking-tight">
                High sampling rates provide more data but may consume your plan's session recording limits faster.
              </AlertDescription>
            </Alert>

            <div className="space-y-6 pt-6 border-t border-border/40">
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
                  Enter URL patterns to specifically record. Leave empty to track all pages (default). One pattern per line. Use * as a wildcard.
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
                  Enter URL patterns to exclude from recording. Useful for sensitive pages. One pattern per line.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="pt-4 border-t border-border/40 flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={isSaving || !website}
            className="px-8 font-bold gap-2"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Configuration
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
