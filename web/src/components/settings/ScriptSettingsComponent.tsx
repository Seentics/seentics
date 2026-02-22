'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWebsiteBySiteId, updateWebsite } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { toast } from 'sonner';
import { Loader2, Zap, Target, MousePointer2, Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function ScriptSettingsComponent({ websiteId }: { websiteId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: website, isLoading } = useQuery({
    queryKey: ['website', websiteId],
    queryFn: () => getWebsiteBySiteId(websiteId),
    enabled: !!websiteId,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: {
      automationEnabled?: boolean;
      funnelEnabled?: boolean;
      heatmapEnabled?: boolean;
    }) => {
      if (!user?.id) throw new Error("User ID required");
      return await updateWebsite(websiteId, data, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website', websiteId] });
      toast.success('Script settings updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update settings');
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  const toggles = [
    {
      id: 'automation',
      title: 'Automations',
      description: 'Enable automated workflows, popups, and user engagement scripts.',
      icon: Zap,
      enabled: website?.automationEnabled ?? true,
      onToggle: (val: boolean) => updateMutation.mutate({ automationEnabled: val }),
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      id: 'funnels',
      title: 'Funnels',
      description: 'Track multi-step conversion paths and drop-off points.',
      icon: Target,
      enabled: website?.funnelEnabled ?? true,
      onToggle: (val: boolean) => updateMutation.mutate({ funnelEnabled: val }),
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
    },
    {
      id: 'heatmaps',
      title: 'Heatmaps',
      description: 'Record user clicks, movements, and scroll behavior on your pages.',
      icon: MousePointer2,
      enabled: website?.heatmapEnabled ?? true,
      onToggle: (val: boolean) => updateMutation.mutate({ heatmapEnabled: val }),
      color: 'text-rose-500',
      bgColor: 'bg-rose-500/10',
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h3 className="text-sm font-semibold">Script Management</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Control which scripts are active on your website. Disabling unused features improves page load performance.</p>
      </div>

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
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                </div>
              </div>
              <Switch
                id={item.id}
                checked={item.enabled}
                onCheckedChange={item.onToggle}
                disabled={updateMutation.isPending}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-muted/30 border border-border/40 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Dynamic Loading</span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          The main Seentics core script will automatically handle loading only the parts you've enabled here.
          Changes are reflected immediately across all your traffic without requiring script re-installation.
        </p>
      </div>
    </div>
  );
}
