'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { addWebsite } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { Loader2 } from 'lucide-react';
import { TrackingCodeModal } from './tracking-code-modal';

interface AddWebsiteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (websiteId: string) => void;
}

export function AddWebsiteModal({ open, onOpenChange, onSuccess }: AddWebsiteModalProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [newWebsiteId, setNewWebsiteId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !url.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    // Basic URL validation
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid website URL',
        variant: 'destructive',
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: 'Authentication Error',
        description: 'You must be logged in to add a website',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
      const website = await addWebsite({ name: name.trim(), url: normalizedUrl }, user.id);
      
      toast({
        title: 'Success!',
        description: `${name} has been added successfully`,
      });

      // Reset form
      setName('');
      setUrl('');
      
      // Instead of just closing, show the tracking code
      const siteId = (website as any).siteId || website.id;
      setNewWebsiteId(siteId);
      setShowTrackingModal(true);
      onOpenChange(false); // Close the current "Add Website" form modal

    } catch (error: any) {
      console.error('Error adding website:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add website. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Website</DialogTitle>
          <DialogDescription>
            Add a website to start tracking analytics. You'll receive a tracking code to install on your site.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Website Name</Label>
              <Input
                id="name"
                placeholder="My Awesome Site"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="url">Website URL</Label>
              <Input
                id="url"
                type="text"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Enter your website's URL (e.g., example.com or https://example.com)
              </p>
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
              Add Website
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {newWebsiteId && (
      <TrackingCodeModal
        isOpen={showTrackingModal}
        onOpenChange={(open) => {
          setShowTrackingModal(open);
          if (!open && onSuccess && newWebsiteId) {
            onSuccess(newWebsiteId);
          }
        }}
        siteId={newWebsiteId}
        isNewlyCreated={true}
      />
    )}
    </>
  );
}
