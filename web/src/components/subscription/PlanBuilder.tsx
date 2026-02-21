'use client';

import React, { useState, useMemo } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3, Workflow, Filter, MousePointer2, Video, Globe,
  ArrowRight, Loader2, Sparkles, Zap, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Per-feature pricing tiers
const FEATURE_CONFIGS = [
  {
    id: 'events' as const,
    label: 'Monthly Events',
    icon: BarChart3,
    steps:  [10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 5_000_000, 10_000_000],
    prices: [0,      5,      9,       15,      25,      39,        79,        149],
    labels: ['10K',  '50K',  '100K',  '250K',  '500K',  '1M',     '5M',      '10M'],
    description: 'Pageviews, clicks, form submissions',
  },
  {
    id: 'automations' as const,
    label: 'Automations',
    icon: Workflow,
    steps:  [0, 5,  10, 20, 50, -1],
    prices: [0, 3,  5,  8,  15, 25],
    labels: ['0', '5', '10', '20', '50', 'Unlimited'],
    description: 'Modals, banners, triggers',
  },
  {
    id: 'funnels' as const,
    label: 'Funnels',
    icon: Filter,
    steps:  [0, 5,  10, 20, 50, -1],
    prices: [0, 3,  5,  8,  15, 25],
    labels: ['0', '5', '10', '20', '50', 'Unlimited'],
    description: 'Conversion path tracking',
  },
  {
    id: 'heatmaps' as const,
    label: 'Heatmaps',
    icon: MousePointer2,
    steps:  [0, 2,  5,  10, 20, -1],
    prices: [0, 2,  4,  7,  12, 20],
    labels: ['0', '2', '5', '10', '20', 'Unlimited'],
    description: 'Click & scroll visualization',
  },
  {
    id: 'recordings' as const,
    label: 'Session Recordings',
    icon: Video,
    steps:  [0,   500, 1_000, 2_000, 5_000, -1],
    prices: [0,   5,   9,     15,    29,    49],
    labels: ['0', '500', '1K', '2K', '5K', 'Unlimited'],
    description: 'Watch real user sessions',
  },
  {
    id: 'websites' as const,
    label: 'Websites',
    icon: Globe,
    steps:  [1, 3,  5,  10, 25, -1],
    prices: [0, 3,  5,  8,  15, 25],
    labels: ['1', '3', '5', '10', '25', 'Unlimited'],
    description: 'Connected domains',
  },
];

type FeatureId = typeof FEATURE_CONFIGS[number]['id'];
type Selections = Record<FeatureId, number>;

// Helper to calculate total from selections
function calcTotal(sel: Selections) {
  return FEATURE_CONFIGS.reduce((sum, f) => sum + f.prices[sel[f.id]], 0);
}

// Preset configurations (slider indices)
const PRESETS: { name: string; selections: Selections }[] = [
  {
    name: 'Starter',
    selections: { events: 0, automations: 1, funnels: 1, heatmaps: 1, recordings: 0, websites: 0 },
  },
  {
    name: 'Growth',
    selections: { events: 2, automations: 2, funnels: 2, heatmaps: 2, recordings: 1, websites: 2 },
  },
  {
    name: 'Scale',
    selections: { events: 5, automations: 3, funnels: 3, heatmaps: 3, recordings: 3, websites: 3 },
  },
  {
    name: 'Pro+',
    selections: { events: 7, automations: 5, funnels: 5, heatmaps: 5, recordings: 5, websites: 5 },
  },
];

export interface PlanBuilderSelection {
  events: number;
  automations: number;
  funnels: number;
  heatmaps: number;
  recordings: number;
  websites: number;
  totalPrice: number;
}

interface PlanBuilderProps {
  onSubscribe?: (selection: PlanBuilderSelection) => void;
  loading?: boolean;
}

export function PlanBuilder({ onSubscribe, loading }: PlanBuilderProps) {
  const [selections, setSelections] = useState<Selections>({
    events: 0, automations: 1, funnels: 1, heatmaps: 1, recordings: 0, websites: 0,
  });

  const totalPrice = useMemo(() => calcTotal(selections), [selections]);

  // Detect which preset matches (if any)
  const activePreset = useMemo(() => {
    return PRESETS.findIndex(p =>
      (Object.keys(p.selections) as FeatureId[]).every(k => p.selections[k] === selections[k])
    );
  }, [selections]);

  // Disabled features (limit = 0)
  const disabledFeatures = useMemo(() => {
    return FEATURE_CONFIGS
      .filter(f => f.steps[selections[f.id]] === 0)
      .map(f => f.label);
  }, [selections]);

  const handleSubscribe = () => {
    if (!onSubscribe) return;
    const result: PlanBuilderSelection = {
      events: FEATURE_CONFIGS[0].steps[selections.events],
      automations: FEATURE_CONFIGS[1].steps[selections.automations],
      funnels: FEATURE_CONFIGS[2].steps[selections.funnels],
      heatmaps: FEATURE_CONFIGS[3].steps[selections.heatmaps],
      recordings: FEATURE_CONFIGS[4].steps[selections.recordings],
      websites: FEATURE_CONFIGS[5].steps[selections.websites],
      totalPrice,
    };
    onSubscribe(result);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-10">
      {/* Preset Quick Select */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mr-2">Quick Select:</span>
        {PRESETS.map((preset, i) => {
          const presetTotal = calcTotal(preset.selections);
          return (
            <button
              key={preset.name}
              onClick={() => setSelections({ ...preset.selections })}
              className={cn(
                "px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 border",
                activePreset === i
                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                  : "bg-card border-border hover:border-primary/40 hover:bg-accent/50"
              )}
            >
              {preset.name}
              <span className="ml-2 text-xs opacity-70">
                {presetTotal === 0 ? 'Free' : `$${presetTotal}/mo`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Feature Sliders */}
      <div className="space-y-2">
        {FEATURE_CONFIGS.map((feature) => {
          const idx = selections[feature.id];
          const Icon = feature.icon;
          const isZero = feature.steps[idx] === 0;
          const price = feature.prices[idx];

          return (
            <div
              key={feature.id}
              className={cn(
                "p-5 rounded-2xl border transition-all duration-300",
                isZero
                  ? "bg-muted/30 border-border/30 opacity-60"
                  : "bg-card border-border hover:border-primary/20"
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg transition-colors",
                    isZero ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                  )}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <div className="font-bold text-sm">{feature.label}</div>
                    <div className="text-xs text-muted-foreground">{feature.description}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn(
                    "text-xl font-black tabular-nums",
                    isZero ? "text-muted-foreground" : ""
                  )}>
                    {isZero ? 'Off' : feature.labels[idx]}
                  </div>
                  {price > 0 && (
                    <div className="text-xs font-bold text-primary">+${price}/mo</div>
                  )}
                  {price === 0 && !isZero && (
                    <div className="text-xs font-bold text-emerald-500">Included</div>
                  )}
                </div>
              </div>

              <div className="px-1">
                <Slider
                  min={0}
                  max={feature.steps.length - 1}
                  step={1}
                  value={[idx]}
                  onValueChange={([v]) => setSelections(s => ({ ...s, [feature.id]: v }))}
                  className="cursor-pointer"
                />
                <div className="flex justify-between mt-2">
                  {feature.labels.map((label, i) => (
                    <span
                      key={i}
                      className={cn(
                        "text-[10px] font-bold transition-colors cursor-pointer select-none",
                        i === idx ? "text-primary" : "text-muted-foreground/50"
                      )}
                      onClick={() => setSelections(s => ({ ...s, [feature.id]: i }))}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Disabled Features Notice */}
      {disabledFeatures.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
          <div className="flex items-start gap-3">
            <Sparkles size={16} className="mt-0.5 shrink-0" />
            <div className="text-xs font-bold">
              <span className="font-black">{disabledFeatures.join(', ')}</span> will be hidden from your dashboard since you've set them to 0.
              You can enable them anytime by upgrading.
            </div>
          </div>
        </div>
      )}

      {/* Total Price & Subscribe */}
      <div className="p-8 rounded-2xl bg-gradient-to-br from-primary/5 via-card to-primary/5 border border-primary/20 shadow-xl shadow-primary/5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Your Monthly Price</div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black tracking-tight">${totalPrice}</span>
              <span className="text-lg font-bold text-muted-foreground">/mo</span>
            </div>
            {totalPrice > 0 && (
              <div className="text-sm font-bold text-muted-foreground mt-1">
                ${Math.round(totalPrice * 0.8)}/mo billed yearly
                <span className="text-emerald-500 ml-1">(-20%)</span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-3">
            <Button
              size="lg"
              onClick={handleSubscribe}
              disabled={loading}
              className="h-14 px-10 rounded-xl font-black text-base shadow-xl shadow-primary/20 gap-2"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : totalPrice === 0 ? (
                <>Start for Free <ArrowRight size={18} /></>
              ) : (
                <>Subscribe Now <ArrowRight size={18} /></>
              )}
            </Button>
            <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <span className="flex items-center gap-1"><Check size={10} /> Cancel anytime</span>
              <span className="flex items-center gap-1"><Check size={10} /> No hidden fees</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
