'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle, Copy, Code, Bot } from 'lucide-react';
import { toast } from 'sonner';

interface TrackingCodeModalProps {
  siteId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isNewlyCreated?: boolean;
}

export function TrackingCodeModal({
  siteId,
  isOpen,
  onOpenChange,
  isNewlyCreated = false
}: TrackingCodeModalProps) {
  const [trackingCode, setTrackingCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      setTrackingCode(`<!-- Seentics Analytics -->\n<script async src="${origin}/trackers/seentics-core.js" data-website-id="${siteId}"></script>`);
    }
  }, [siteId]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(trackingCode);
      setCopied(true);
      toast.success('Tracking code copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="p-6 space-y-6">
          <div className="text-center space-y-2">
            {isNewlyCreated ? (
              <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-2">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            ) : (
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                <Code className="h-6 w-6 text-primary" />
              </div>
            )}
            <DialogTitle className="text-xl font-bold">
              {isNewlyCreated ? 'Website Created!' : 'Installation Script'}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Copy and paste this snippet into the <span className="font-mono bg-muted px-1 rounded">{'<head>'}</span> of your site.
            </DialogDescription>
          </div>

          <div className="relative group">
            <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="sm"
                variant="secondary"
                onClick={copyToClipboard}
                className="h-8 shadow-sm"
              >
                {copied ? (
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                )}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div 
              className="bg-zinc-950 rounded-xl p-4 font-mono text-[11px] text-zinc-300 leading-relaxed border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors"
              onClick={copyToClipboard}
            >
              <code className="break-all">{trackingCode}</code>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              Done
            </Button>
            <Button 
              className="rounded-xl shadow-lg shadow-primary/20"
              onClick={() => {
                onOpenChange(false);
                window.location.href = `/websites/${siteId}`;
              }}
            >
              View Stats
              <CheckCircle className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
