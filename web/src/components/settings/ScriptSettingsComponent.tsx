'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWebsiteBySiteId, updateWebsite } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { toast } from 'sonner';
import { Loader2, Zap, Target, MousePointer2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Script Management</h2>
        <p className="text-muted-foreground text-sm">Control which scripts are active on your website. Disabling unused features improves page load performance.</p>
      </div>

      <div className="grid gap-4">
        {toggles.map((item) => (
          <Card key={item.id} className="border-border/50 bg-card/30 overflow-hidden group hover:border-primary/20 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-6">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${item.bgColor} flex items-center justify-center border border-white/5 dark:border-white/10 group-hover:scale-110 transition-transform duration-500`}>
                  <item.icon className={`h-6 w-6 ${item.color}`} />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold">{item.title}</CardTitle>
                  <CardDescription className="text-xs">{item.description}</CardDescription>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  id={item.id} 
                  checked={item.enabled} 
                  onCheckedChange={item.onToggle}
                  disabled={updateMutation.isPending}
                />
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="bg-primary/5 border border-primary/10 rounded-xl p-6 mt-8">
        <div className="flex items-center gap-3 mb-2">
          <Loader2 className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-bold">Dynamic Loading</h4>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The main Seentics core script will automatically handle loading only the parts you've enabled here. 
          Changes are reflected immediately across all your traffic without requiring script re-installation.
        </p>
      </div>
    </div>
  );
}
