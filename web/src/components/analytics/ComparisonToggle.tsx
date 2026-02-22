'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { GitCompare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComparisonToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function ComparisonToggle({ enabled, onToggle }: ComparisonToggleProps) {
  return (
    <Button
      variant={enabled ? 'default' : 'outline'}
      size="sm"
      onClick={() => onToggle(!enabled)}
      className={cn(
        'gap-1.5 h-8 px-3 font-medium text-[11px]',
        enabled && 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
      )}
    >
      <GitCompare className="h-3.5 w-3.5" />
      Compare
    </Button>
  );
}
