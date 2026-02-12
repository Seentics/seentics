'use client';

import { Button } from '@/components/ui/button';
import { Globe, PlusCircle, BarChart3, Workflow } from 'lucide-react';

interface EmptyStateProps {
  onCreateWebsite: () => void;
}

export function EmptyState({ onCreateWebsite }: EmptyStateProps) {
  return (
    <div className="text-center py-16 px-4">
      <div className="mx-auto max-w-md">
        <div className="mx-auto h-24 w-24 rounded-full bg-muted/50 flex items-center justify-center mb-6">
          <Globe className="h-12 w-12 text-blue-600 dark:text-blue-400" />
        </div>
        
        <h3 className="text-xl font-semibold text-foreground mb-2">
          No websites yet
        </h3>
        
        <p className="text-muted-foreground mb-8 leading-relaxed">
          Get started by adding your first website. Once you add a website, you'll be able to:
        </p>
        
        <div className="space-y-3 mb-8 text-left">
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded">
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm text-muted-foreground">
              Track visitor behavior and analyze performance
            </span>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded">
            <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <Workflow className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-sm text-muted-foreground">
              Create automated workflows to convert visitors
            </span>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded">
            <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
              <Globe className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-sm text-muted-foreground">
              Optimize your website based on real data
            </span>
          </div>
        </div>
        
        <Button onClick={onCreateWebsite} size="lg" className="px-8">
          <PlusCircle className="mr-2 h-5 w-5" />
          Add Your First Website
        </Button>
        
        <p className="text-xs text-muted-foreground mt-4">
          It only takes a few seconds to get started
        </p>
      </div>
    </div>
  );
}
