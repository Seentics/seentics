'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layout, Plus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DashboardWidget {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: 'overview' | 'behavior' | 'acquisition' | 'performance';
}

interface CustomDashboardProps {
  widgets: DashboardWidget[];
  onUpdateWidgets: (widgets: DashboardWidget[]) => void;
}

export function CustomDashboard({ widgets, onUpdateWidgets }: CustomDashboardProps) {
  const [open, setOpen] = useState(false);

  const toggleWidget = (id: string) => {
    const updated = widgets.map(w => 
      w.id === id ? { ...w, enabled: !w.enabled } : w
    );
    onUpdateWidgets(updated);
  };

  const categories = [
    { id: 'overview', name: 'Overview', color: 'text-blue-500' },
    { id: 'behavior', name: 'Behavior', color: 'text-purple-500' },
    { id: 'acquisition', name: 'Acquisition', color: 'text-green-500' },
    { id: 'performance', name: 'Performance', color: 'text-orange-500' },
  ];

  const enabledCount = widgets.filter(w => w.enabled).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-10 font-bold text-xs uppercase tracking-wider">
          <Layout className="h-4 w-4" />
          Customize
          {enabledCount > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
              {enabledCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customize Dashboard</DialogTitle>
          <DialogDescription>
            Choose which widgets to display on your analytics dashboard
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {categories.map((category) => {
            const categoryWidgets = widgets.filter(w => w.category === category.id);
            
            return (
              <div key={category.id}>
                <h3 className={cn("text-sm font-bold uppercase tracking-wider mb-3", category.color)}>
                  {category.name}
                </h3>
                <div className="grid gap-3">
                  {categoryWidgets.map((widget) => (
                    <Card
                      key={widget.id}
                      className={cn(
                        "p-4 cursor-pointer transition-all duration-200 hover:shadow-md",
                        widget.enabled 
                          ? "border-primary/50 bg-primary/5" 
                          : "border-border/50 hover:border-border"
                      )}
                      onClick={() => toggleWidget(widget.id)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-sm">{widget.name}</h4>
                            {widget.enabled && (
                              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary">
                                <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{widget.description}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {enabledCount} of {widgets.length} widgets enabled
          </p>
          <Button onClick={() => setOpen(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
