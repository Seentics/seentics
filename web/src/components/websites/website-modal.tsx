'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Globe, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

interface WebsiteModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (website: { name: string; url: string }) => Promise<any>;
  title?: string;
  description?: string;
  submitText?: string;
  loadingText?: string;
}

export function WebsiteModal({
  isOpen,
  onOpenChange,
  onSubmit,
  title = "Add a new website",
  description = "Enter your site's name and domain to get started.",
  submitText = "Add website",
  loadingText = "Adding..."
}: WebsiteModalProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !url.trim()) {
      toast.error('All fields are required');
      return;
    }

    if (!isValidUrl(url)) {
      toast.error('Please enter a valid URL (e.g., https://example.com)');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onSubmit({ name: name.trim(), url: url.trim() });
      if (result) {
        setName('');
        setUrl('');
        onOpenChange(false);
        toast.success(`Successfully added "${name}"!`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to Add website');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setName('');
      setUrl('');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Website Name</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., My Awesome Project"
                className="pl-10"
                disabled={isSubmitting}
              />
            </div>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="url">Website URL</Label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="pl-10"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim() || !url.trim()}
            className="w-full"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? loadingText : submitText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
