import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWebsiteBySiteId, updateWebsite, deleteWebsite } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { toast } from 'sonner';
import { Loader2, Globe, Trash2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function GeneralSettingsComponent({ websiteId }: { websiteId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  const { data: website, isLoading } = useQuery({
    queryKey: ['website', websiteId],
    queryFn: () => getWebsiteBySiteId(websiteId),
    enabled: !!websiteId,
  });

  useEffect(() => {
    if (website) {
      setName(website.name);
      setUrl(website.url);
    }
  }, [website]);

  const updateMutation = useMutation({
    mutationFn: async (data: { name: string; url: string }) => {
      if (!user?.id) throw new Error("User ID required");
      return await updateWebsite(websiteId, data, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website', websiteId] });
      queryClient.invalidateQueries({ queryKey: ['websites'] });
      toast.success('Website settings updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update website');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("User ID required");
      await deleteWebsite(websiteId, user.id);
    },
    onSuccess: () => {
      toast.success('Website deleted successfully');
      window.location.href = '/websites';
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete website');
    },
  });

  const handleSave = () => {
    if (!name.trim() || !url.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    updateMutation.mutate({ name, url });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this website? This action cannot be undone.')) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-xl font-bold tracking-tight">General Settings</h2>
        <p className="text-muted-foreground text-sm">Update your website information and preferences.</p>
      </div>

      <div className="grid gap-6">
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="website-name" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Website Name</Label>
            <Input 
              id="website-name" 
              placeholder="My Awesome Website" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              className="h-11 bg-muted/20 border-none shadow-none focus-visible:ring-1" 
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="website-domain" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Domain</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                id="website-domain" 
                placeholder="example.com" 
                value={url} 
                onChange={(e) => setUrl(e.target.value)}
                className="pl-10 h-11 bg-muted/20 border-none shadow-none focus-visible:ring-1" 
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-border/50">
          <Button 
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="h-10 px-8 font-bold rounded-xl shadow-lg shadow-primary/20 transition-transform active:scale-95"
          >
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="pt-12">
        <div className="p-6 rounded-3xl border border-rose-500/20 bg-rose-500/5 space-y-4">
          <div className="flex items-center gap-3 text-rose-600">
            <ShieldAlert className="h-5 w-5" />
            <h2 className="font-bold text-sm uppercase tracking-widest">Danger Zone</h2>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm font-bold">Delete Website</p>
              <p className="text-xs text-muted-foreground">This will permanently remove all analytics and historical data for this site.</p>
            </div>
            <Button 
              variant="destructive" 
              size="sm" 
              className="h-9 px-4 font-bold rounded-lg border-none"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete Permanently
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
