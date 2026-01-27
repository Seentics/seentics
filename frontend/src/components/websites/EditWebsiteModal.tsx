'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { updateWebsite, Website } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface EditWebsiteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  website: Website | null;
}

export function EditWebsiteModal({ open, onOpenChange, website }: EditWebsiteModalProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (website) {
      setName(website.name);
      setUrl(website.url);
    }
  }, [website]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !url.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!user?.id || !website?.id) return;

    setIsLoading(true);

    try {
      const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
      await updateWebsite(website.id, { name: name.trim(), url: normalizedUrl }, user.id);
      
      toast.success('Website updated successfully');
      queryClient.invalidateQueries({ queryKey: ['websites'] });
      queryClient.invalidateQueries({ queryKey: ['website', website.siteId] });
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating website:', error);
      toast.error(error.message || 'Failed to update website');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Website</DialogTitle>
          <DialogDescription>
            Update your property's name and transmission URL.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Website Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="edit-url">Website URL</Label>
              <Input
                id="edit-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
