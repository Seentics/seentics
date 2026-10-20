'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

/**
 * Copy-to-clipboard button with a two-second confirmation.
 */
export function CopyButton({ text, className }: { text: string; className?: string }) {
  const actions = useT().actions;
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
      aria-label={copied ? actions.copied : actions.copy}
      title={actions.copy}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}
