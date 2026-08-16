'use client';

import React, { useState } from 'react';
import { useThemeCustomization } from '@/contexts/ThemeCustomizationContext';
import { useLayoutStore, LayoutMode } from '@/stores/useLayoutStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  PanelLeft,
  Monitor,
  ArrowUpFromLine,
  Loader2,
  Save,
  RotateCcw,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface LayoutOption {
  id: LayoutMode;
  label: string;
  description: string;
  icon: React.ElementType;
}

const LAYOUT_OPTIONS: LayoutOption[] = [
  {
    id: 'sidebar',
    label: 'Default Sidebar',
    description: 'Navigation panel on the left side',
    icon: PanelLeft,
  },
  {
    id: 'dock',
    label: 'Floating Dock',
    description: 'macOS-style dock at the bottom',
    icon: Monitor,
  },
  {
    id: 'header',
    label: 'Top Header',
    description: 'Navigation bar across the top',
    icon: ArrowUpFromLine,
  },
  {
    id: 'floating-header',
    label: 'Floating Header',
    description: 'rounded-lg floating bar at the top',
    icon: ArrowUpFromLine,
  },
];

function LayoutPreview({ mode }: { mode: LayoutMode }) {
  return (
    <div className="w-full h-24 rounded-lg bg-muted/30 border border-border/40 relative overflow-hidden">
      {/* Content area placeholder */}
      <div className="absolute inset-2 flex gap-1">
        {mode === 'sidebar' && (
          <>
            <div className="w-5 h-full rounded-lg-sm bg-primary/20 border border-primary/30" />
            <div className="flex-1 space-y-1 pt-1">
              <div className="h-1.5 w-3/4 rounded-lg-full bg-muted-foreground/10" />
              <div className="h-1.5 w-1/2 rounded-lg-full bg-muted-foreground/10" />
              <div className="grid grid-cols-2 gap-1 mt-2">
                <div className="h-6 rounded-lg-sm bg-muted-foreground/5 border border-border/30" />
                <div className="h-6 rounded-lg-sm bg-muted-foreground/5 border border-border/30" />
              </div>
            </div>
          </>
        )}
        {mode === 'dock' && (
          <div className="flex-1 relative">
            <div className="space-y-1 pt-1">
              <div className="h-1.5 w-3/4 rounded-lg-full bg-muted-foreground/10" />
              <div className="h-1.5 w-1/2 rounded-lg-full bg-muted-foreground/10" />
              <div className="grid grid-cols-2 gap-1 mt-2">
                <div className="h-6 rounded-lg-sm bg-muted-foreground/5 border border-border/30" />
                <div className="h-6 rounded-lg-sm bg-muted-foreground/5 border border-border/30" />
              </div>
            </div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-3 rounded-lg-full bg-primary/20 border border-primary/30" />
          </div>
        )}
        {mode === 'header' && (
          <div className="flex-1 flex flex-col">
            <div className="w-full h-3 rounded-lg-sm bg-primary/20 border border-primary/30 mb-1.5" />
            <div className="space-y-1">
              <div className="h-1.5 w-3/4 rounded-lg-full bg-muted-foreground/10" />
              <div className="h-1.5 w-1/2 rounded-lg-full bg-muted-foreground/10" />
              <div className="grid grid-cols-2 gap-1 mt-1">
                <div className="h-5 rounded-lg-sm bg-muted-foreground/5 border border-border/30" />
                <div className="h-5 rounded-lg-sm bg-muted-foreground/5 border border-border/30" />
              </div>
            </div>
          </div>
        )}
        {mode === 'floating-header' && (
          <div className="flex-1 flex flex-col items-center">
            <div className="w-3/4 h-3 rounded-lg-full bg-primary/20 border border-primary/30 mt-0.5 mb-1.5" />
            <div className="w-full space-y-1">
              <div className="h-1.5 w-3/4 rounded-lg-full bg-muted-foreground/10" />
              <div className="h-1.5 w-1/2 rounded-lg-full bg-muted-foreground/10" />
              <div className="grid grid-cols-2 gap-1 mt-1">
                <div className="h-5 rounded-lg-sm bg-muted-foreground/5 border border-border/30" />
                <div className="h-5 rounded-lg-sm bg-muted-foreground/5 border border-border/30" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function LayoutSettingsComponent() {
  const { preferences, savePreferences } = useThemeCustomization();
  const { layoutMode, setLayoutMode } = useLayoutStore();
  const [selectedMode, setSelectedMode] = useState<LayoutMode>(layoutMode);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await savePreferences({ layoutMode: selectedMode });
      setLayoutMode(selectedMode);
      toast.success('Layout preference saved.');
    } catch {
      toast.error('Failed to save layout preference.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setSelectedMode('sidebar');
    setIsSaving(true);
    try {
      await savePreferences({ layoutMode: 'sidebar' });
      setLayoutMode('sidebar');
      toast.success('Layout reset to default.');
    } catch {
      toast.error('Failed to reset layout.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <PanelLeft className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Navigation Layout</h3>
              <p className="text-xs text-muted-foreground">Choose how the navigation is displayed in your dashboard.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {LAYOUT_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setSelectedMode(option.id)}
                className={cn(
                  'relative flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all text-left',
                  selectedMode === option.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:border-primary/40'
                )}
              >
                <LayoutPreview mode={option.id} />
                <div className="w-full">
                  <p className="text-sm font-medium">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
                {selectedMode === option.id && (
                  <div className="absolute top-2 right-2 h-5 w-5 rounded-lg-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={isSaving}
              className="text-muted-foreground hover:text-foreground text-xs h-8 px-2"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset to default
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
