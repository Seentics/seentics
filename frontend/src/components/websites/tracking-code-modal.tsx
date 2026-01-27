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
      // New consolidated tracking script with auto-loading
      setTrackingCode(`<!-- Seentics Analytics -->
<script async src="${window.location.origin}/trackers/seentics-core.js" data-website-id="${siteId}"></script>`);
    }
  }, [siteId]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(trackingCode);
      setCopied(true);
      toast.success('Tracking code copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          {isNewlyCreated && (
            <div className="mb-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-900 dark:text-green-100">Website Created Successfully! 🎉</p>
                  <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                    Now let's install the tracking code to start collecting analytics data.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Code className="h-6 w-6 text-primary" />
            Install Tracking Code
          </DialogTitle>
          <DialogDescription className="text-base">
            Copy and paste this snippet into the {'<head>'} section of your website to start tracking visitors.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Tracking Code Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Tracking Script</span>
              <Button
                size="sm"
                variant="outline"
                onClick={copyToClipboard}
                className="h-8 px-3"
              >
                {copied ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Code
                  </>
                )}
              </Button>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-lg border">
              <pre className="p-3 rounded-md bg-background border text-sm overflow-x-auto">
                <code className="whitespace-pre-wrap text-xs font-mono">{trackingCode}</code>
              </pre>
            </div>
          </div>
          
          {/* Installation Steps */}
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-950/20 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-full">
                <span className="text-slate-600 dark:text-slate-400 font-bold text-sm">1</span>
              </div>
              <div className="text-sm">
                <p className="font-semibold text-slate-900 dark:text-slate-100">Installation Steps:</p>
                <ol className="mt-2 text-slate-800 dark:text-slate-200 space-y-1">
                  <li>• Copy the tracking code above</li>
                  <li>• Paste it into your website's {'<head>'} section</li>
                  <li>• Save and publish your website</li>
                  <li>• View real-time stats in your dashboard!</li>
                </ol>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <Bot className="h-6 w-6 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-amber-900 dark:text-amber-100">What happens next?</p>
                <p className="mt-2 text-amber-800 dark:text-amber-200">
                  Once installed, Seentics will automatically track visitor behavior, run automations (modals, banners, notifications), and monitor conversion funnels. You'll see real-time data in your dashboard within minutes.
                </p>
              </div>
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="flex gap-3 pt-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Got it, thanks!
            </Button>
            <Button 
              className="flex-1"
              onClick={() => {
                onOpenChange(false);
                window.location.href = `/websites/${siteId}`;
              }}
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
