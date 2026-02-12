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
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="p-6">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Loader2 className={isLoading ? "h-4 w-4 animate-spin text-primary" : "h-4 w-4 text-primary"} />
              </div>
              Add New Website
            </DialogTitle>
            <DialogDescription>
              Enter your website details to start tracking.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 ml-1">
                  Website Name
                </Label>
                <Input
                  id="name"
                  placeholder="e.g. My Awesome Site"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                  className="rounded-xl h-11 border-zinc-200 dark:border-zinc-800"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 ml-1">
                  Website URL
                </Label>
                <Input
                  id="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isLoading}
                  className="rounded-xl h-11 border-zinc-200 dark:border-zinc-800"
                />
                <p className="px-1 text-[11px] text-amber-600 font-medium flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2 duration-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Note: Tracking script must be installed on the same domain.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                className="flex-1 rounded-xl h-11"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading}
                className="flex-1 rounded-xl h-11 shadow-lg shadow-primary/20"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Create Website'
                )}
              </Button>
            </div>
          </form>
        </div>
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
