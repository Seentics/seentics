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
        'gap-2 h-10 font-bold text-xs uppercase tracking-wider',
        enabled && 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
      )}
    >
      <GitCompare className="h-4 w-4" />
      Compare
      {enabled && ' Mode'}
    </Button>
  );
}
