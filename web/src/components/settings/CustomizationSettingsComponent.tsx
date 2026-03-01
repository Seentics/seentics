'use client';

import React, { useState, useEffect } from 'react';
import { useThemeCustomization } from '@/contexts/ThemeCustomizationContext';
import { UserPreferences } from '@/lib/preferences-api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Palette,
  Type,
  LayoutGrid,
  Brush,
  RotateCcw,
  Save,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Color conversion helpers ─────────────────────────────────────────────

function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '';
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function hslToHex(hsl: string): string {
  if (!hsl) return '#000000';
  const parts = hsl.replace(/%/g, '').split(' ').map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return '#000000';
  const h = parts[0] / 360;
  const s = parts[1] / 100;
  const l = parts[2] / 100;
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ─── Preset themes ─────────────────────────────────────────────────────────

interface Preset {
  name: string;
  color: string;
  background: string;
  card: string;
  primary: string;
}

const PRESETS: Preset[] = [
  { name: 'Default Blue',  color: '#3b82f6', background: '222 47% 6%',   card: '222 30% 12%', primary: '217.2 91.2% 59.8%' },
  { name: 'Purple',        color: '#a855f7', background: '260 40% 6%',   card: '260 25% 12%', primary: '262.1 83.3% 57.8%' },
  { name: 'Emerald',       color: '#10b981', background: '150 30% 6%',   card: '150 20% 12%', primary: '142.1 70.6% 45.3%' },
  { name: 'Rose',          color: '#f43f5e', background: '350 35% 6%',   card: '350 20% 12%', primary: '346.8 77.2% 49.8%' },
  { name: 'Amber',         color: '#f59e0b', background: '35 35% 6%',    card: '35 20% 12%',  primary: '38 92% 50%'        },
  { name: 'Teal',          color: '#14b8a6', background: '180 35% 6%',   card: '180 20% 12%', primary: '175 84% 32%'       },
];

// ─── Section wrapper ────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  description,
  children,
  onSave,
  onReset,
  isSaving,
  isResetting,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  onSave: () => void;
  onReset: () => void;
  isSaving: boolean;
  isResetting: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="space-y-4">{children}</div>
        <div className="mt-5 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={isResetting || isSaving}
            className="text-muted-foreground hover:text-foreground text-xs h-8 px-2"
          >
            {isResetting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5" />}
            Reset section
          </Button>
          <Button size="sm" onClick={onSave} disabled={isSaving || isResetting}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function CustomizationSettingsComponent() {
  const { preferences, isLoading, savePreferences, resetToDefaults } = useThemeCustomization();
  const { toast } = useToast();

  // Local state mirrors preferences so edits are live before saving
  const [colors, setColors] = useState({ background: '', card: '', primary: '' });
  const [typography, setTypography] = useState({ fontFamily: '', fontSize: 'medium' });
  const [layout, setLayout] = useState({ radius: '0.5', density: 'comfortable' });
  const [branding, setBranding] = useState({ dashboardTitle: '', logoUrl: '' });

  const [saving, setSaving] = useState({ colors: false, typography: false, layout: false, branding: false, reset: false });
  const [resetting, setResetting] = useState({ colors: false, typography: false, layout: false, branding: false });

  // Sync from loaded preferences
  useEffect(() => {
    setColors({
      background: preferences.background,
      card: preferences.card,
      primary: preferences.primary,
    });
    setTypography({
      fontFamily: preferences.fontFamily,
      fontSize: preferences.fontSize || 'medium',
    });
    setLayout({
      radius: preferences.radius || '0.5',
      density: preferences.density || 'comfortable',
    });
    setBranding({
      dashboardTitle: preferences.dashboardTitle,
      logoUrl: preferences.logoUrl,
    });
  }, [preferences]);

  const handleSave = async (section: keyof typeof saving, data: Partial<UserPreferences>) => {
    setSaving(s => ({ ...s, [section]: true }));
    try {
      await savePreferences(data);
      toast({ title: 'Saved', description: 'Your preferences have been updated.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save preferences.' });
    } finally {
      setSaving(s => ({ ...s, [section]: false }));
    }
  };

  const handleSectionReset = async (
    section: keyof typeof resetting,
    defaults: Partial<UserPreferences>,
    apply: () => void,
  ) => {
    setResetting(r => ({ ...r, [section]: true }));
    try {
      apply();
      await savePreferences(defaults);
      toast({ title: 'Reset', description: 'Section restored to defaults.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to reset section.' });
    } finally {
      setResetting(r => ({ ...r, [section]: false }));
    }
  };

  const handleReset = async () => {
    setSaving(s => ({ ...s, reset: true }));
    try {
      await resetToDefaults();
      toast({ title: 'Reset', description: 'All preferences restored to defaults.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to reset preferences.' });
    } finally {
      setSaving(s => ({ ...s, reset: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* ── Colors ─────────────────────────────────────────────────── */}
      <Section
        icon={Palette}
        title="Colors"
        description="Choose a preset theme or pick custom colors for your dashboard."
        onSave={() => handleSave('colors', colors)}
        onReset={() => handleSectionReset(
          'colors',
          { background: '', card: '', primary: '' },
          () => setColors({ background: '', card: '', primary: '' }),
        )}
        isSaving={saving.colors}
        isResetting={resetting.colors}
      >
        {/* Preset swatches */}
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">Theme Presets</Label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(preset => (
              <button
                key={preset.name}
                title={preset.name}
                onClick={() => setColors({ background: preset.background, card: preset.card, primary: preset.primary })}
                className={cn(
                  'h-8 w-8 rounded-full border-2 transition-all hover:scale-110',
                  colors.primary === preset.primary ? 'border-foreground scale-110' : 'border-transparent'
                )}
                style={{ backgroundColor: preset.color }}
              />
            ))}
          </div>
        </div>

        {/* Custom pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {([
            { label: 'Background', key: 'background' as const },
            { label: 'Card',       key: 'card'       as const },
            { label: 'Primary',    key: 'primary'    as const },
          ] as {label: string; key: keyof typeof colors}[]).map(({ label, key }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs">{label}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={hslToHex(colors[key])}
                  onChange={e => setColors(c => ({ ...c, [key]: hexToHsl(e.target.value) }))}
                  className="h-9 w-10 cursor-pointer rounded border border-border bg-transparent p-0.5"
                />
                <Input
                  value={colors[key]}
                  onChange={e => setColors(c => ({ ...c, [key]: e.target.value }))}
                  placeholder="222 47% 6%"
                  className="text-xs font-mono h-9"
                />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Typography ──────────────────────────────────────────────── */}
      <Section
        icon={Type}
        title="Typography"
        description="Adjust the font family and size used throughout the dashboard."
        onSave={() => handleSave('typography', typography)}
        onReset={() => handleSectionReset(
          'typography',
          { fontFamily: '', fontSize: 'medium' },
          () => setTypography({ fontFamily: '', fontSize: 'medium' }),
        )}
        isSaving={saving.typography}
        isResetting={resetting.typography}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Font Family</Label>
            <Select
              value={typography.fontFamily || 'default'}
              onValueChange={v => setTypography(t => ({ ...t, fontFamily: v === 'default' ? '' : v }))}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default (System)</SelectItem>
                <SelectItem value="Inter, sans-serif">Inter</SelectItem>
                <SelectItem value="'Geist', sans-serif">Geist</SelectItem>
                <SelectItem value="'Space Grotesk', sans-serif">Space Grotesk</SelectItem>
                <SelectItem value="Georgia, serif">Georgia (Serif)</SelectItem>
                <SelectItem value="'Courier New', monospace">Courier New (Mono)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Font Size</Label>
            <Select
              value={typography.fontSize}
              onValueChange={v => setTypography(t => ({ ...t, fontSize: v }))}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small (14px)</SelectItem>
                <SelectItem value="medium">Medium (16px)</SelectItem>
                <SelectItem value="large">Large (18px)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      {/* ── Layout & Spacing ─────────────────────────────────────────── */}
      <Section
        icon={LayoutGrid}
        title="Layout & Spacing"
        description="Control corner roundness and content density."
        onSave={() => handleSave('layout', layout)}
        onReset={() => handleSectionReset(
          'layout',
          { radius: '0.5', density: 'comfortable' },
          () => setLayout({ radius: '0.5', density: 'comfortable' }),
        )}
        isSaving={saving.layout}
        isResetting={resetting.layout}
      >
        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Border Radius</Label>
              <span className="text-xs text-muted-foreground font-mono">{layout.radius}rem</span>
            </div>
            <Slider
              min={0}
              max={1.5}
              step={0.125}
              value={[parseFloat(layout.radius)]}
              onValueChange={([v]) => setLayout(l => ({ ...l, radius: v.toString() }))}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Sharp</span>
              <span>Rounded</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Content Density</Label>
            <div className="flex gap-2">
              {(['compact', 'comfortable', 'spacious'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setLayout(l => ({ ...l, density: d }))}
                  className={cn(
                    'flex-1 rounded-md border px-3 py-2 text-xs font-medium capitalize transition-colors',
                    layout.density === d
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:border-foreground/30'
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Branding ──────────────────────────────────────────────────── */}
      <Section
        icon={Brush}
        title="Branding"
        description="Customize the dashboard title and your logo."
        onSave={() => handleSave('branding', branding)}
        onReset={() => handleSectionReset(
          'branding',
          { dashboardTitle: '', logoUrl: '' },
          () => setBranding({ dashboardTitle: '', logoUrl: '' }),
        )}
        isSaving={saving.branding}
        isResetting={resetting.branding}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="dashboardTitle">Dashboard Title</Label>
            <Input
              id="dashboardTitle"
              value={branding.dashboardTitle}
              onChange={e => setBranding(b => ({ ...b, dashboardTitle: e.target.value }))}
              placeholder="Seentics"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="logoUrl">Logo URL</Label>
            <Input
              id="logoUrl"
              value={branding.logoUrl}
              onChange={e => setBranding(b => ({ ...b, logoUrl: e.target.value }))}
              placeholder="https://example.com/logo.png"
              className="h-9 text-sm"
            />
          </div>
        </div>
        {branding.logoUrl && (
          <div className="mt-3">
            <Label className="text-xs text-muted-foreground mb-1.5 block">Preview</Label>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={branding.logoUrl}
              alt="Logo preview"
              className="h-10 rounded border border-border object-contain bg-muted p-1"
            />
          </div>
        )}
      </Section>

      {/* ── Reset All ─────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Reset everything</p>
          <p className="text-xs text-muted-foreground mt-0.5">Remove all customizations and restore the default dashboard appearance.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={saving.reset}
          className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0 ml-4"
        >
          {saving.reset ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
          Reset All to Defaults
        </Button>
      </div>
    </div>
  );
}
