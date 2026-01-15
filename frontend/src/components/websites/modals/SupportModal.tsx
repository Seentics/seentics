'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupportModal({ isOpen, onClose }: SupportModalProps) {
  const [isLoading, setIsLoading] = React.useState(true);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden bg-white dark:bg-gray-800">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Contact Support</DialogTitle>
          <DialogDescription>
            Need help? Our team is here to assist you.
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full h-[600px] bg-slate-50 dark:bg-slate-900/50">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10 transition-opacity">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground animate-pulse">Loading form...</p>
              </div>
            </div>
          )}
          <iframe
            src="https://tally.so/embed/wzP59R?hideTitle=1&transparentBackground=1&dynamicHeight=1"
            width="100%"
            height="100%"
            frameBorder="0"
            marginHeight={0}
            marginWidth={0}
            title="Support Form"
            onLoad={() => setIsLoading(false)}
            className="w-full h-full"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
