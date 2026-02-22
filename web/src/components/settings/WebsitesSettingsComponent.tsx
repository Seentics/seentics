'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWebsites, deleteWebsite, Website } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { AddWebsiteModal } from '@/components/websites/AddWebsiteModal';
import { EditWebsiteModal } from '@/components/websites/EditWebsiteModal';
import { TrackingSettingsComponent } from './TrackingSettingsComponent';
import { cn } from '@/lib/utils';
import { Loader2, Trash2, Edit, ExternalLink, Globe, Plus, Code } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function WebsitesSettingsComponent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingWebsite, setEditingWebsite] = useState<Website | null>(null);
  const [trackingWebsite, setTrackingWebsite] = useState<Website | null>(null);

  const { data: websites = [], isLoading } = useQuery({
    queryKey: ['websites', user?.id],
    queryFn: getWebsites,
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (websiteId: string) => {
        if (!user?.id) throw new Error("User ID required");
        await deleteWebsite(websiteId, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['websites'] });
      toast.success('Website deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete website');
    },
  });

  const handleDelete = (websiteId: string) => {
    if (confirm('Are you sure you want to delete this website? This action cannot be undone.')) {
      deleteMutation.mutate(websiteId);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">Manage Websites</h3>
          <p className="text-xs text-muted-foreground mt-0.5">View and manage all your tracked properties.</p>
        </div>
        <Button
          onClick={() => setIsAddModalOpen(true)}
          size="sm"
          className="gap-1.5 text-xs font-medium"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Property
        </Button>
      </div>

      <AddWebsiteModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['websites'] })}
      />

      <EditWebsiteModal
        open={!!editingWebsite}
        onOpenChange={(open) => !open && setEditingWebsite(null)}
        website={editingWebsite}
      />

      <Dialog open={!!trackingWebsite} onOpenChange={(open) => !open && setTrackingWebsite(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {trackingWebsite && <TrackingSettingsComponent websiteId={trackingWebsite.id} />}
        </DialogContent>
      </Dialog>

      <div className="border border-border/60 rounded-lg overflow-hidden bg-card shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
          </div>
        ) : websites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 bg-muted/40 rounded-2xl flex items-center justify-center mb-3">
              <Globe className="h-5 w-5 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">No websites found. Add your first property to get started.</p>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_140px_100px_80px_100px] items-center px-5 py-2.5 border-b border-border/30 bg-muted/10 text-xs font-medium text-muted-foreground">
              <div className="pl-1">Property</div>
              <div>URL</div>
              <div>Connected</div>
              <div className="text-center">Status</div>
              <div />
            </div>

            {/* Rows */}
            <div className="divide-y divide-border/20">
              {websites.map((website: Website) => (
                <div key={website.id} className="group grid grid-cols-[1fr_140px_100px_80px_100px] items-center px-5 py-3 transition-colors hover:bg-muted/20">
                  {/* Property */}
                  <div className="flex items-center gap-3 min-w-0 pl-1">
                    <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center flex-shrink-0">
                      <Globe className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium truncate">{website.name}</span>
                  </div>

                  {/* URL */}
                  <div className="min-w-0">
                    <a href={website.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors truncate group/link">
                      {website.url.replace(/^https?:\/\//, '')}
                      <ExternalLink className="h-2.5 w-2.5 flex-shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                    </a>
                  </div>

                  {/* Connected */}
                  <div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(website.createdAt), 'MMM d, yyyy')}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-center gap-1.5">
                    <span className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      website.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                    )} />
                    <span className={cn(
                      'text-xs font-medium',
                      website.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                    )}>
                      {website.isActive ? 'Active' : 'Halted'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground/50 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
                      onClick={() => setEditingWebsite(website)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-blue-500/60 hover:text-blue-600 hover:bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-all"
                      onClick={() => setTrackingWebsite(website)}
                      title="Get Tracking Code"
                    >
                      <Code className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground/50 hover:text-rose-500 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                      onClick={() => handleDelete(website.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
