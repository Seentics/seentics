'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { GitCompareArrows } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComparisonToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function ComparisonToggle({ enabled, onToggle }: ComparisonToggleProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onToggle(!enabled)}
      className={cn(
        'h-7 px-3 gap-1.5 text-xs font-medium rounded text-muted-foreground bg-muted/50 hover:bg-muted/70 hover:text-foreground border-0',
        enabled && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
      )}
    >
      <GitCompareArrows className="h-3.5 w-3.5" />
      Compare
    </Button>
  );
}
