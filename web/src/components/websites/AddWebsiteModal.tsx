'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { addWebsite } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { Loader2 } from 'lucide-react';
import { TrackingCodeModal } from './tracking-code-modal';
import { useT } from '@/lib/i18n';
import { ProfilePicker } from './ProfilePicker';
import type { WebsiteProfile } from '@/features/websites/types';

interface AddWebsiteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (websiteId: string) => void;
}

export function AddWebsiteModal({ open, onOpenChange, onSuccess }: AddWebsiteModalProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [profile, setProfile] = useState<WebsiteProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [newWebsiteId, setNewWebsiteId] = useState<string | null>(null);
  const { toast } = useToast();
  const all = useT();
  const t = all.dashboard.addWebsite;
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !url.trim()) {
      toast({
        title: t.validationError,
        description: t.fillAll,
        variant: 'destructive',
      });
      return;
    }

    // Basic URL validation
    try {
      new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    } catch {
      toast({
        title: t.invalidUrl,
        description: t.invalidUrlBody,
        variant: 'destructive',
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: t.authError,
        description: t.mustLogIn,
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      const website = await addWebsite({ name: name.trim(), url: normalizedUrl, ...(profile ? { profile } : {}) }, user.id);
      
      toast({
        title: t.success,
        description: t.added(name),
      });

      // Reset form
      setName('');
      setUrl('');
      
      // Instead of just closing, show the tracking code
      setNewWebsiteId(website.id);
      setShowTrackingModal(true);
      onOpenChange(false); // Close the current "Add Website" form modal

    } catch (error: any) {
      console.error('Error adding website:', error);
      toast({
        title: t.error,
        description: error.message || t.failed,
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
              {t.title}
            </DialogTitle>
            <DialogDescription>{t.description}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 ml-1">
                  {t.name}
                </Label>
                <Input
                  id="name"
                  placeholder={t.namePlaceholder}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                  className="rounded-lg h-11 border-zinc-200 dark:border-zinc-800"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 ml-1">
                  {t.url}
                </Label>
                <Input
                  id="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isLoading}
                  className="rounded-lg h-11 border-zinc-200 dark:border-zinc-800"
                />
                <p className="px-1 text-[11px] text-amber-600 font-medium flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2 duration-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {t.sameDomain}
                </p>
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-foreground">{all.dashboard.profiles.question}</legend>
                <ProfilePicker value={profile} onChange={setProfile} disabled={isLoading} name="add-website-profile" />
              </fieldset>
            </div>

            <div className="flex gap-3 pt-2">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                className="flex-1 rounded-lg h-11"
              >
                {all.actions.cancel}
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading}
                className="flex-1 rounded-lg h-11 shadow-lg shadow-primary/20"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t.adding}
                  </>
                ) : (
                  t.create
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
