'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Copy-to-clipboard button with a two-second confirmation.
 *
 * The two agency pages each had their own copy; the detail page's had grown a
 * `className` the list page's had not. This is that one, since a component that accepts
 * caller-owned spacing is the superset.
 */
export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Button
      variant="outline" size="sm"
      className={cn('h-8 w-8 p-0 shrink-0', className)}
      onClick={handleCopy}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}
