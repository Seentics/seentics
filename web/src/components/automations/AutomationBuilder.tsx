'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Globe,
  MousePointer,
  TrendingDown,
  Clock,
  LogOut,
  Coffee,
  Zap,
  AlertTriangle,
  EyeOff,
  Eye,
  UserCheck,
  MessageSquare,
  Bell,
  Layout,
  Highlighter,
  FileText,
  ExternalLink,
  Tag,
  Webhook,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Pencil,
  Check,
  Settings,
  Layers,
  Filter,
  ListChecks,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AutomationDefinition {
  trigger: { type: string; [k: string]: unknown };
  conditions?: ConditionGroup | null;
  actions: Array<{ type: string; [k: string]: unknown }>;
  frequency?: { maxPerSession?: number; maxPerUser?: number; cooldownDays?: number };
  abTest?: { enabled: boolean; variants: Array<{ id: string; weight: number }> };
  priority?: number;
}

export interface ConditionGroup {
  operator: 'AND' | 'OR' | 'NOT';
  rules: ConditionRule[];
}

export interface ConditionRule {
  fact: string;
  operator: string;
  value?: unknown;
}

interface AutomationBuilderProps {
  initialDefinition?: AutomationDefinition;
  onSave: (definition: AutomationDefinition) => void;
  isSaving?: boolean;
  className?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

type TriggerType = {
  value: string;
  label: string;
  icon: React.ElementType;
  description: string;
  hasConfig: boolean;
};

const TRIGGER_TYPES: TriggerType[] = [
  { value: 'page_view',     label: 'Page View',       icon: Globe,        description: 'Triggers when a user visits a specific page', hasConfig: true },
  { value: 'click',         label: 'Click',            icon: MousePointer, description: 'Triggers when a user clicks an element',      hasConfig: true },
  { value: 'scroll_depth',  label: 'Scroll Depth',     icon: TrendingDown, description: 'Triggers when a user scrolls to a depth',     hasConfig: true },
  { value: 'time_on_page',  label: 'Time on Page',     icon: Clock,        description: 'Triggers after a user spends time on page',   hasConfig: true },
  { value: 'exit_intent',   label: 'Exit Intent',      icon: LogOut,       description: 'Triggers when a user is about to leave',      hasConfig: false },
  { value: 'inactivity',    label: 'Inactivity',       icon: Coffee,       description: 'Triggers after a user is inactive',           hasConfig: true },
  { value: 'rage_click',    label: 'Rage Click',       icon: Zap,          description: 'Triggers on repeated rapid clicks',           hasConfig: false },
  { value: 'form_abandon',  label: 'Form Abandonment', icon: AlertTriangle,description: 'Triggers when a form is abandoned',           hasConfig: false },
  { value: 'js_error',      label: 'JS Error',         icon: AlertTriangle,description: 'Triggers on a JavaScript error',              hasConfig: false },
  { value: 'tab_hidden',    label: 'Tab Hidden',       icon: EyeOff,       description: 'Triggers when the tab is hidden',             hasConfig: false },
  { value: 'tab_visible',   label: 'Tab Visible',      icon: Eye,          description: 'Triggers when the tab becomes visible again', hasConfig: false },
  { value: 'custom_event',  label: 'Custom Event',     icon: Zap,          description: 'Triggers on a named custom event',            hasConfig: true },
  { value: 'identify',      label: 'Identify',         icon: UserCheck,    description: 'Triggers when a user is identified',          hasConfig: false },
];

type ActionType = {
  value: string;
  label: string;
  icon: React.ElementType;
  color: string;
};

const ACTION_TYPES: ActionType[] = [
  { value: 'show_modal',          label: 'Show Modal',          icon: MessageSquare, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-300' },
  { value: 'show_toast',          label: 'Show Toast',          icon: Bell,          color: 'text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-300' },
  { value: 'show_banner',         label: 'Show Banner',         icon: Layout,        color: 'text-purple-600 bg-purple-50 dark:bg-purple-950 dark:text-purple-300' },
  { value: 'highlight_element',   label: 'Highlight Element',   icon: Highlighter,   color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-300' },
  { value: 'show_tooltip',        label: 'Show Tooltip',        icon: FileText,      color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950 dark:text-indigo-300' },
  { value: 'personalize_content', label: 'Personalize Content', icon: Pencil,        color: 'text-teal-600 bg-teal-50 dark:bg-teal-950 dark:text-teal-300' },
  { value: 'redirect',            label: 'Redirect',            icon: ExternalLink,  color: 'text-orange-600 bg-orange-50 dark:bg-orange-950 dark:text-orange-300' },
  { value: 'tag_session',         label: 'Tag Session',         icon: Tag,           color: 'text-pink-600 bg-pink-50 dark:bg-pink-950 dark:text-pink-300' },
  { value: 'webhook',             label: 'Webhook',             icon: Webhook,       color: 'text-gray-600 bg-gray-100 dark:bg-gray-900 dark:text-gray-300' },
];

const CONDITION_OPERATORS = [
  'equals', 'notEquals', 'greaterThan', 'lessThan',
  'greaterThanOrEqual', 'lessThanOrEqual', 'contains', 'notContains',
  'startsWith', 'endsWith', 'matches', 'isSet', 'isNotSet',
  'isTrue', 'isFalse', 'in', 'notIn',
];

type StepKey = 'trigger' | 'conditions' | 'actions' | 'settings';

const STEPS: { key: StepKey; label: string; icon: React.ElementType }[] = [
  { key: 'trigger',    label: 'Trigger',    icon: Zap },
  { key: 'conditions', label: 'Conditions', icon: Filter },
  { key: 'actions',    label: 'Actions',    icon: ListChecks },
  { key: 'settings',   label: 'Settings',   icon: Settings },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getActionType(type: string): ActionType {
  return ACTION_TYPES.find(a => a.value === type) ?? ACTION_TYPES[0];
}

function getTriggerType(type: string): TriggerType {
  return TRIGGER_TYPES.find(t => t.value === type) ?? TRIGGER_TYPES[0];
}

function actionSummary(action: { type: string; [k: string]: unknown }): string {
  const t = action.type;
  if (t === 'show_modal')          return String(action.title ?? 'Modal');
  if (t === 'show_toast')          return String(action.message ?? 'Toast notification');
  if (t === 'show_banner')         return String(action.message ?? 'Banner');
  if (t === 'highlight_element')   return `Highlight: ${String(action.selector ?? '')}`;
  if (t === 'show_tooltip')        return String(action.message ?? 'Tooltip');
  if (t === 'personalize_content') return `Set content on ${String(action.selector ?? '')}`;
  if (t === 'redirect')            return `→ ${String(action.url ?? '')}`;
  if (t === 'tag_session')         return `Tag: ${String(action.tag ?? '')}`;
  if (t === 'webhook')             return String(action.url ?? 'Webhook URL');
  return t;
}

function defaultAction(type: string): { type: string; [k: string]: unknown } {
  switch (type) {
    case 'show_modal':          return { type, title: '', body: '', button_text: 'Get started', button_url: '' };
    case 'show_toast':          return { type, message: '', position: 'bottom-right', duration_ms: 4000 };
    case 'show_banner':         return { type, message: '', position: 'top', button_text: '', button_url: '', duration_ms: 0 };
    case 'highlight_element':   return { type, selector: '', duration_ms: 3000, scroll_into_view: true };
    case 'show_tooltip':        return { type, selector: '', message: '', duration_ms: 5000 };
    case 'personalize_content': return { type, selector: '', text: '' };
    case 'redirect':            return { type, url: '', delay_ms: 0, new_tab: false };
    case 'tag_session':         return { type, tag: '' };
    case 'webhook':             return { type, url: '', method: 'POST', headers: {}, body: {} };
    default:                    return { type };
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Trigger Config Forms ─────────────────────────────────────────────────────

function TriggerConfigForm({
  type,
  config,
  onChange,
}: {
  type: string;
  config: Record<string, unknown>;
  onChange: (cfg: Record<string, unknown>) => void;
}) {
  const set = (key: string, val: unknown) => onChange({ ...config, [key]: val });

  if (type === 'page_view') {
    return (
      <div className="space-y-4">
        <FieldGroup label="Page Path" hint="Leave empty to match all pages">
          <Input
            placeholder="e.g. /pricing"
            value={String(config.path ?? '')}
            onChange={e => set('path', e.target.value)}
          />
        </FieldGroup>
        <FieldGroup label="Match Type">
          <Select value={String(config.match_type ?? 'contains')} onValueChange={v => set('match_type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="exact">Exact</SelectItem>
              <SelectItem value="contains">Contains</SelectItem>
              <SelectItem value="starts_with">Starts with</SelectItem>
              <SelectItem value="regex">Regex</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
      </div>
    );
  }
  if (type === 'click') {
    return (
      <FieldGroup label="CSS Selector" hint="e.g. #cta-button or .btn-primary">
        <Input
          placeholder="#submit-button"
          value={String(config.selector ?? '')}
          onChange={e => set('selector', e.target.value)}
        />
      </FieldGroup>
    );
  }
  if (type === 'scroll_depth') {
    return (
      <FieldGroup label="Scroll Depth">
        <Select value={String(config.depth ?? '50')} onValueChange={v => set('depth', Number(v))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25%</SelectItem>
            <SelectItem value="50">50%</SelectItem>
            <SelectItem value="75">75%</SelectItem>
            <SelectItem value="90">90%</SelectItem>
          </SelectContent>
        </Select>
      </FieldGroup>
    );
  }
  if (type === 'time_on_page') {
    return (
      <FieldGroup label="Seconds on Page">
        <Input
          type="number"
          min={1}
          placeholder="30"
          value={String(config.seconds ?? '')}
          onChange={e => set('seconds', Number(e.target.value))}
        />
      </FieldGroup>
    );
  }
  if (type === 'inactivity') {
    return (
      <FieldGroup label="Inactivity Duration">
        <Select value={String(config.seconds ?? '60')} onValueChange={v => set('seconds', Number(v))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 seconds</SelectItem>
            <SelectItem value="60">1 minute</SelectItem>
            <SelectItem value="120">2 minutes</SelectItem>
            <SelectItem value="300">5 minutes</SelectItem>
          </SelectContent>
        </Select>
      </FieldGroup>
    );
  }
  if (type === 'custom_event') {
    return (
      <FieldGroup label="Event Name" hint="The exact name used in snc('track', ...)">
        <Input
          placeholder="e.g. checkout_started"
          value={String(config.name ?? '')}
          onChange={e => set('name', e.target.value)}
        />
      </FieldGroup>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">No configuration needed for this trigger type.</p>
  );
}

// ─── Action Config Form ───────────────────────────────────────────────────────

function ActionConfigForm({
  action,
  onChange,
}: {
  action: { type: string; [k: string]: unknown };
  onChange: (updated: { type: string; [k: string]: unknown }) => void;
}) {
  const set = (key: string, val: unknown) => onChange({ ...action, [key]: val });
  const tplHint = 'Supports template vars: {{user.firstName | default:there}}, {{user.plan}}, {{page}}, etc.';
  const t = action.type;

  if (t === 'show_modal') {
    return (
      <div className="space-y-4">
        <FieldGroup label="Title" hint={tplHint}>
          <Input value={String(action.title ?? '')} onChange={e => set('title', e.target.value)} placeholder="Headline" />
        </FieldGroup>
        <FieldGroup label="Body" hint={tplHint}>
          <Textarea value={String(action.body ?? '')} onChange={e => set('body', e.target.value)} placeholder="Modal body text…" rows={3} />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-4">
          <FieldGroup label="Button Text">
            <Input value={String(action.button_text ?? '')} onChange={e => set('button_text', e.target.value)} placeholder="Get started" />
          </FieldGroup>
          <FieldGroup label="Button URL">
            <Input value={String(action.button_url ?? '')} onChange={e => set('button_url', e.target.value)} placeholder="/signup" />
          </FieldGroup>
        </div>
        <FieldGroup label="Image URL (optional)">
          <Input value={String(action.image_url ?? '')} onChange={e => set('image_url', e.target.value)} placeholder="https://…" />
        </FieldGroup>
        <div className="grid grid-cols-3 gap-4">
          <FieldGroup label="Background Color">
            <Input value={String(action.background_color ?? '')} onChange={e => set('background_color', e.target.value)} placeholder="#ffffff" />
          </FieldGroup>
          <FieldGroup label="Text Color">
            <Input value={String(action.text_color ?? '')} onChange={e => set('text_color', e.target.value)} placeholder="#000000" />
          </FieldGroup>
          <FieldGroup label="Button Color">
            <Input value={String(action.button_color ?? '')} onChange={e => set('button_color', e.target.value)} placeholder="#0066ff" />
          </FieldGroup>
        </div>
      </div>
    );
  }

  if (t === 'show_toast') {
    return (
      <div className="space-y-4">
        <FieldGroup label="Message" hint={tplHint}>
          <Input value={String(action.message ?? '')} onChange={e => set('message', e.target.value)} placeholder="Notification message" />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-4">
          <FieldGroup label="Position">
            <Select value={String(action.position ?? 'bottom-right')} onValueChange={v => set('position', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="top-left">Top Left</SelectItem>
                <SelectItem value="top-right">Top Right</SelectItem>
                <SelectItem value="bottom-left">Bottom Left</SelectItem>
                <SelectItem value="bottom-right">Bottom Right</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="Duration (ms)">
            <Input type="number" min={0} value={String(action.duration_ms ?? 4000)} onChange={e => set('duration_ms', Number(e.target.value))} />
          </FieldGroup>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FieldGroup label="Background Color">
            <Input value={String(action.background_color ?? '')} onChange={e => set('background_color', e.target.value)} placeholder="#1a1a1a" />
          </FieldGroup>
          <FieldGroup label="Text Color">
            <Input value={String(action.text_color ?? '')} onChange={e => set('text_color', e.target.value)} placeholder="#ffffff" />
          </FieldGroup>
        </div>
      </div>
    );
  }

  if (t === 'show_banner') {
    return (
      <div className="space-y-4">
        <FieldGroup label="Message" hint={tplHint}>
          <Input value={String(action.message ?? '')} onChange={e => set('message', e.target.value)} placeholder="Banner message" />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-4">
          <FieldGroup label="Position">
            <Select value={String(action.position ?? 'top')} onValueChange={v => set('position', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="top">Top</SelectItem>
                <SelectItem value="bottom">Bottom</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="Duration (ms, 0 = sticky)">
            <Input type="number" min={0} value={String(action.duration_ms ?? 0)} onChange={e => set('duration_ms', Number(e.target.value))} />
          </FieldGroup>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FieldGroup label="Button Text (optional)">
            <Input value={String(action.button_text ?? '')} onChange={e => set('button_text', e.target.value)} placeholder="Learn more" />
          </FieldGroup>
          <FieldGroup label="Button URL">
            <Input value={String(action.button_url ?? '')} onChange={e => set('button_url', e.target.value)} placeholder="/features" />
          </FieldGroup>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FieldGroup label="Background Color">
            <Input value={String(action.background_color ?? '')} onChange={e => set('background_color', e.target.value)} placeholder="#0066ff" />
          </FieldGroup>
          <FieldGroup label="Text Color">
            <Input value={String(action.text_color ?? '')} onChange={e => set('text_color', e.target.value)} placeholder="#ffffff" />
          </FieldGroup>
        </div>
      </div>
    );
  }

  if (t === 'highlight_element') {
    return (
      <div className="space-y-4">
        <FieldGroup label="CSS Selector">
          <Input value={String(action.selector ?? '')} onChange={e => set('selector', e.target.value)} placeholder=".feature-section" />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-4">
          <FieldGroup label="Duration (ms)">
            <Input type="number" min={0} value={String(action.duration_ms ?? 3000)} onChange={e => set('duration_ms', Number(e.target.value))} />
          </FieldGroup>
          <FieldGroup label="Scroll Into View">
            <div className="flex items-center gap-2 pt-1.5">
              <Switch
                checked={Boolean(action.scroll_into_view ?? true)}
                onCheckedChange={v => set('scroll_into_view', v)}
              />
              <span className="text-xs text-muted-foreground">{Boolean(action.scroll_into_view ?? true) ? 'Enabled' : 'Disabled'}</span>
            </div>
          </FieldGroup>
        </div>
      </div>
    );
  }

  if (t === 'show_tooltip') {
    return (
      <div className="space-y-4">
        <FieldGroup label="CSS Selector">
          <Input value={String(action.selector ?? '')} onChange={e => set('selector', e.target.value)} placeholder="#pricing-button" />
        </FieldGroup>
        <FieldGroup label="Message" hint={tplHint}>
          <Textarea value={String(action.message ?? '')} onChange={e => set('message', e.target.value)} rows={2} placeholder="Tooltip text…" />
        </FieldGroup>
        <FieldGroup label="Duration (ms)">
          <Input type="number" min={0} value={String(action.duration_ms ?? 5000)} onChange={e => set('duration_ms', Number(e.target.value))} />
        </FieldGroup>
      </div>
    );
  }

  if (t === 'personalize_content') {
    return (
      <div className="space-y-4">
        <FieldGroup label="CSS Selector">
          <Input value={String(action.selector ?? '')} onChange={e => set('selector', e.target.value)} placeholder=".hero-title" />
        </FieldGroup>
        <FieldGroup label="Text Content" hint={tplHint}>
          <Input value={String(action.text ?? '')} onChange={e => set('text', e.target.value)} placeholder="Hello {{user.firstName | default:there}}!" />
        </FieldGroup>
        <FieldGroup label="HTML Content (overrides text if set)" hint="Rendered as innerHTML">
          <Textarea value={String(action.html ?? '')} onChange={e => set('html', e.target.value)} rows={3} placeholder="<strong>Hello!</strong>" />
        </FieldGroup>
      </div>
    );
  }

  if (t === 'redirect') {
    return (
      <div className="space-y-4">
        <FieldGroup label="Redirect URL">
          <Input value={String(action.url ?? '')} onChange={e => set('url', e.target.value)} placeholder="https://example.com/page" />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-4">
          <FieldGroup label="Delay (ms)">
            <Input type="number" min={0} value={String(action.delay_ms ?? 0)} onChange={e => set('delay_ms', Number(e.target.value))} />
          </FieldGroup>
          <FieldGroup label="Open in New Tab">
            <div className="flex items-center gap-2 pt-1.5">
              <Switch checked={Boolean(action.new_tab)} onCheckedChange={v => set('new_tab', v)} />
              <span className="text-xs text-muted-foreground">{Boolean(action.new_tab) ? 'Yes' : 'No'}</span>
            </div>
          </FieldGroup>
        </div>
      </div>
    );
  }

  if (t === 'tag_session') {
    return (
      <FieldGroup label="Tag" hint="A string label applied to the session">
        <Input value={String(action.tag ?? '')} onChange={e => set('tag', e.target.value)} placeholder="e.g. high-intent" />
      </FieldGroup>
    );
  }

  if (t === 'webhook') {
    const headersStr = typeof action.headers === 'string'
      ? action.headers
      : JSON.stringify(action.headers ?? {}, null, 2);
    const bodyStr = typeof action.body === 'string'
      ? action.body
      : JSON.stringify(action.body ?? {}, null, 2);
    return (
      <div className="space-y-4">
        <FieldGroup label="Webhook URL">
          <Input value={String(action.url ?? '')} onChange={e => set('url', e.target.value)} placeholder="https://hooks.slack.com/…" />
        </FieldGroup>
        <FieldGroup label="HTTP Method">
          <Select value={String(action.method ?? 'POST')} onValueChange={v => set('method', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="Headers (JSON)" hint={tplHint}>
          <Textarea
            value={headersStr}
            onChange={e => {
              try { set('headers', JSON.parse(e.target.value)); }
              catch { set('headers', e.target.value); }
            }}
            rows={3}
            className="font-mono text-xs"
            placeholder={'{\n  "Content-Type": "application/json"\n}'}
          />
        </FieldGroup>
        <FieldGroup label="Body (JSON)" hint={tplHint}>
          <Textarea
            value={bodyStr}
            onChange={e => {
              try { set('body', JSON.parse(e.target.value)); }
              catch { set('body', e.target.value); }
            }}
            rows={4}
            className="font-mono text-xs"
            placeholder={'{\n  "text": "{{user.firstName}} triggered…"\n}'}
          />
        </FieldGroup>
      </div>
    );
  }

  return <p className="text-sm text-muted-foreground">No configuration for this action type.</p>;
}

// ─── Step Components ──────────────────────────────────────────────────────────

function TriggerStep({
  trigger,
  onChange,
}: {
  trigger: { type: string; [k: string]: unknown };
  onChange: (t: { type: string; [k: string]: unknown }) => void;
}) {
  const triggerDef = getTriggerType(trigger.type);
  const TriggerIcon = triggerDef.icon;
  const { type, ...config } = trigger;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1">Choose a Trigger</h2>
        <p className="text-sm text-muted-foreground">Select what event should start this automation.</p>
      </div>
      <FieldGroup label="Trigger Type">
        <Select value={type} onValueChange={v => onChange({ type: v })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRIGGER_TYPES.map(tt => (
              <SelectItem key={tt.value} value={tt.value}>
                <div className="flex items-center gap-2">
                  <tt.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{tt.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldGroup>

      <Card className="border border-border/60 bg-muted/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3 mb-4">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <TriggerIcon className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">{triggerDef.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{triggerDef.description}</p>
            </div>
          </div>
          {triggerDef.hasConfig && (
            <TriggerConfigForm
              type={type}
              config={config as Record<string, unknown>}
              onChange={cfg => onChange({ type, ...cfg })}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConditionsStep({
  conditions,
  onChange,
}: {
  conditions: ConditionGroup | null | undefined;
  onChange: (c: ConditionGroup | null) => void;
}) {
  const rules = conditions?.rules ?? [];
  const operator = conditions?.operator ?? 'AND';

  const addRule = () => {
    const newGroup: ConditionGroup = {
      operator: operator as 'AND' | 'OR' | 'NOT',
      rules: [...rules, { fact: '', operator: 'equals', value: '' }],
    };
    onChange(newGroup);
  };

  const removeRule = (i: number) => {
    const newRules = rules.filter((_, idx) => idx !== i);
    onChange(newRules.length ? { operator: operator as 'AND' | 'OR' | 'NOT', rules: newRules } : null);
  };

  const updateRule = (i: number, rule: ConditionRule) => {
    const newRules = rules.map((r, idx) => idx === i ? rule : r);
    onChange({ operator: operator as 'AND' | 'OR' | 'NOT', rules: newRules });
  };

  const setOperator = (op: 'AND' | 'OR' | 'NOT') => {
    if (rules.length) onChange({ operator: op, rules });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1">Conditions (optional)</h2>
        <p className="text-sm text-muted-foreground">Add rules to control when this automation fires. No conditions = always trigger.</p>
      </div>

      {rules.length > 1 && (
        <FieldGroup label="Match Logic">
          <div className="flex gap-2">
            {(['AND', 'OR'] as const).map(op => (
              <Button
                key={op}
                size="sm"
                variant={operator === op ? 'default' : 'outline'}
                className="h-8 px-4 text-xs"
                onClick={() => setOperator(op)}
              >
                {op}
              </Button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {operator === 'AND' ? 'All conditions must match' : 'Any condition can match'}
          </p>
        </FieldGroup>
      )}

      <div className="space-y-3">
        {rules.map((rule, i) => (
          <Card key={i} className="border border-border/60 bg-muted/10">
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <FieldGroup label="Fact">
                    <Input
                      placeholder="e.g. user.plan"
                      value={rule.fact}
                      onChange={e => updateRule(i, { ...rule, fact: e.target.value })}
                    />
                  </FieldGroup>
                  <FieldGroup label="Operator">
                    <Select
                      value={rule.operator}
                      onValueChange={v => updateRule(i, { ...rule, operator: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONDITION_OPERATORS.map(op => (
                          <SelectItem key={op} value={op}>{op}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldGroup>
                  <FieldGroup label="Value">
                    <Input
                      placeholder="e.g. pro"
                      value={String(rule.value ?? '')}
                      onChange={e => updateRule(i, { ...rule, value: e.target.value })}
                      disabled={rule.operator === 'isSet' || rule.operator === 'isNotSet' || rule.operator === 'isTrue' || rule.operator === 'isFalse'}
                    />
                  </FieldGroup>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 mt-6"
                  onClick={() => removeRule(i)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={addRule}>
        <Plus className="h-3.5 w-3.5" />
        Add Condition
      </Button>

      {rules.length === 0 && (
        <p className="text-xs text-muted-foreground italic">No conditions — this automation will trigger for all users.</p>
      )}
    </div>
  );
}

function ActionsStep({
  actions,
  onChange,
}: {
  actions: Array<{ type: string; [k: string]: unknown }>;
  onChange: (a: Array<{ type: string; [k: string]: unknown }>) => void;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const addAction = (type: string) => {
    onChange([...actions, defaultAction(type)]);
    setExpandedIdx(actions.length);
    setAddOpen(false);
  };

  const removeAction = (i: number) => {
    onChange(actions.filter((_, idx) => idx !== i));
    setExpandedIdx(prev => prev === i ? null : prev !== null && prev > i ? prev - 1 : prev);
  };

  const updateAction = useCallback((i: number, updated: { type: string; [k: string]: unknown }) => {
    onChange(actions.map((a, idx) => idx === i ? updated : a));
  }, [actions, onChange]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1">Actions</h2>
        <p className="text-sm text-muted-foreground">Define what happens when the trigger fires.</p>
      </div>

      {actions.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <Layers className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-muted-foreground">No actions yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add at least one action below.</p>
        </div>
      )}

      <div className="space-y-3">
        {actions.map((action, i) => {
          const at = getActionType(action.type);
          const Icon = at.icon;
          const expanded = expandedIdx === i;
          return (
            <Card key={i} className="border border-border/60 overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedIdx(expanded ? null : i)}
              >
                <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-xs', at.color)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{at.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{actionSummary(action)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={e => { e.stopPropagation(); removeAction(i); }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                  {expanded
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  }
                </div>
              </button>
              {expanded && (
                <div className="border-t border-border/40 p-4 bg-muted/10">
                  <ActionConfigForm
                    action={action}
                    onChange={updated => updateAction(i, updated)}
                  />
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => setAddOpen(o => !o)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Action
        </Button>
        {addOpen && (
          <div className="absolute top-9 left-0 z-20 w-64 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
            <div className="p-1">
              {ACTION_TYPES.map(at => {
                const Icon = at.icon;
                return (
                  <button
                    key={at.value}
                    type="button"
                    className="flex items-center gap-2.5 w-full rounded-md px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-left"
                    onClick={() => addAction(at.value)}
                  >
                    <div className={cn('h-6 w-6 rounded flex items-center justify-center shrink-0', at.color)}>
                      <Icon className="h-3 w-3" />
                    </div>
                    {at.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsStep({
  frequency,
  abTest,
  priority,
  onFrequencyChange,
  onAbTestChange,
  onPriorityChange,
}: {
  frequency: AutomationDefinition['frequency'];
  abTest: AutomationDefinition['abTest'];
  priority: number;
  onFrequencyChange: (f: AutomationDefinition['frequency']) => void;
  onAbTestChange: (ab: AutomationDefinition['abTest']) => void;
  onPriorityChange: (p: number) => void;
}) {
  const setFreq = (key: string, val: number | undefined) =>
    onFrequencyChange({ ...frequency, [key]: val });

  const addVariant = () => {
    const variants = abTest?.variants ?? [];
    onAbTestChange({ enabled: true, variants: [...variants, { id: `v${variants.length + 1}`, weight: 50 }] });
  };

  const removeVariant = (i: number) => {
    const variants = (abTest?.variants ?? []).filter((_, idx) => idx !== i);
    onAbTestChange({ enabled: abTest?.enabled ?? true, variants });
  };

  const updateVariant = (i: number, field: 'id' | 'weight', val: string | number) => {
    const variants = (abTest?.variants ?? []).map((v, idx) =>
      idx === i ? { ...v, [field]: field === 'weight' ? Number(val) : val } : v
    );
    onAbTestChange({ enabled: abTest?.enabled ?? true, variants });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-base font-semibold mb-1">Settings</h2>
        <p className="text-sm text-muted-foreground">Fine-tune frequency, priority, and testing options.</p>
      </div>

      {/* Frequency Caps */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Frequency Caps</h3>
        <div className="grid grid-cols-3 gap-4">
          <FieldGroup label="Max Per Session" hint="0 = unlimited">
            <Input
              type="number"
              min={0}
              value={String(frequency?.maxPerSession ?? '')}
              onChange={e => setFreq('maxPerSession', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="1"
            />
          </FieldGroup>
          <FieldGroup label="Max Per User" hint="0 = unlimited">
            <Input
              type="number"
              min={0}
              value={String(frequency?.maxPerUser ?? '')}
              onChange={e => setFreq('maxPerUser', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="3"
            />
          </FieldGroup>
          <FieldGroup label="Cooldown (days)">
            <Input
              type="number"
              min={0}
              value={String(frequency?.cooldownDays ?? '')}
              onChange={e => setFreq('cooldownDays', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="7"
            />
          </FieldGroup>
        </div>
      </div>

      {/* Priority */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Priority</h3>
          <Badge variant="outline" className="text-xs tabular-nums">{priority}</Badge>
        </div>
        <Slider
          min={1}
          max={100}
          step={1}
          value={[priority]}
          onValueChange={([v]) => onPriorityChange(v)}
          className="w-full"
        />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>1 (lowest)</span>
          <span>100 (highest)</span>
        </div>
      </div>

      {/* A/B Test */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">A/B Testing</h3>
            <p className="text-xs text-muted-foreground">Split traffic between variants</p>
          </div>
          <Switch
            checked={abTest?.enabled ?? false}
            onCheckedChange={v => onAbTestChange({ enabled: v, variants: abTest?.variants ?? [] })}
          />
        </div>
        {abTest?.enabled && (
          <div className="space-y-3 pl-1">
            {(abTest.variants ?? []).map((variant, i) => (
              <div key={i} className="flex items-center gap-3">
                <Input
                  value={variant.id}
                  onChange={e => updateVariant(i, 'id', e.target.value)}
                  placeholder="variant-a"
                  className="flex-1"
                />
                <div className="flex items-center gap-2 shrink-0 w-32">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={String(variant.weight)}
                    onChange={e => updateVariant(i, 'weight', e.target.value)}
                    className="w-20 text-right"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => removeVariant(i)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={addVariant}>
              <Plus className="h-3.5 w-3.5" />
              Add Variant
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryStep({
  definition,
}: {
  definition: AutomationDefinition;
}) {
  const triggerDef = getTriggerType(definition.trigger.type);
  const TriggerIcon = triggerDef.icon;
  const rules = definition.conditions?.rules ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1">Summary</h2>
        <p className="text-sm text-muted-foreground">Review your automation before saving.</p>
      </div>

      <div className="space-y-4">
        <Card className="border border-border/60">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trigger</p>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <TriggerIcon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{triggerDef.label}</p>
                {definition.trigger.type === 'page_view' && !!definition.trigger.path && (
                  <p className="text-xs text-muted-foreground">{String(definition.trigger.path)}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {rules.length > 0 && (
          <Card className="border border-border/60">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Conditions ({definition.conditions?.operator})
              </p>
              {rules.map((r, i) => (
                <div key={i} className="text-sm text-foreground">
                  <span className="text-muted-foreground">{r.fact}</span>{' '}
                  <Badge variant="outline" className="text-[10px] px-1.5 h-4">{r.operator}</Badge>{' '}
                  {String(r.value ?? '')}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="border border-border/60">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Actions ({definition.actions.length})
            </p>
            {definition.actions.map((action, i) => {
              const at = getActionType(action.type);
              const Icon = at.icon;
              return (
                <div key={i} className="flex items-center gap-2">
                  <div className={cn('h-6 w-6 rounded flex items-center justify-center shrink-0', at.color)}>
                    <Icon className="h-3 w-3" />
                  </div>
                  <p className="text-sm text-foreground">{at.label}</p>
                  <p className="text-xs text-muted-foreground truncate">— {actionSummary(action)}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border border-border/60">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Settings</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <span className="text-muted-foreground">Priority</span>
              <span className="font-medium">{definition.priority ?? 50}</span>
              <span className="text-muted-foreground">Max per session</span>
              <span className="font-medium">{definition.frequency?.maxPerSession ?? '—'}</span>
              <span className="text-muted-foreground">Max per user</span>
              <span className="font-medium">{definition.frequency?.maxPerUser ?? '—'}</span>
              <span className="text-muted-foreground">Cooldown (days)</span>
              <span className="font-medium">{definition.frequency?.cooldownDays ?? '—'}</span>
              <span className="text-muted-foreground">A/B test</span>
              <span className="font-medium">{definition.abTest?.enabled ? `${definition.abTest.variants.length} variants` : 'Off'}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const DEFAULT_DEFINITION: AutomationDefinition = {
  trigger: { type: 'page_view' },
  conditions: null,
  actions: [],
  frequency: {},
  abTest: { enabled: false, variants: [] },
  priority: 50,
};

export function AutomationBuilder({
  initialDefinition,
  onSave,
  isSaving,
  className,
}: AutomationBuilderProps) {
  const [activeStep, setActiveStep] = useState<StepKey>('trigger');
  const [definition, setDefinition] = useState<AutomationDefinition>(
    initialDefinition ?? DEFAULT_DEFINITION
  );

  const stepIndex = STEPS.findIndex(s => s.key === activeStep);

  const goNext = () => {
    if (stepIndex < STEPS.length - 1) setActiveStep(STEPS[stepIndex + 1].key);
  };
  const goBack = () => {
    if (stepIndex > 0) setActiveStep(STEPS[stepIndex - 1].key);
  };

  const isLastStep = stepIndex === STEPS.length - 1;

  return (
    <div className={cn('flex h-full min-h-0 bg-background', className)}>
      {/* Sidebar Stepper */}
      <aside className="w-52 shrink-0 border-r border-border/60 bg-muted/20 flex flex-col p-4 gap-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 mb-3">Builder</p>
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = step.key === activeStep;
          const isDone = i < stepIndex;
          return (
            <button
              key={step.key}
              type="button"
              onClick={() => setActiveStep(step.key)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors text-left w-full',
                isActive
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <div className={cn(
                'h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold border',
                isActive ? 'bg-primary text-primary-foreground border-primary' : isDone ? 'bg-green-500 text-white border-green-500' : 'border-border',
              )}>
                {isDone ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
              </div>
              {step.label}
            </button>
          );
        })}
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-2xl mx-auto">
            {activeStep === 'trigger' && (
              <TriggerStep
                trigger={definition.trigger}
                onChange={t => setDefinition(d => ({ ...d, trigger: t }))}
              />
            )}
            {activeStep === 'conditions' && (
              <ConditionsStep
                conditions={definition.conditions}
                onChange={c => setDefinition(d => ({ ...d, conditions: c }))}
              />
            )}
            {activeStep === 'actions' && (
              <ActionsStep
                actions={definition.actions}
                onChange={a => setDefinition(d => ({ ...d, actions: a }))}
              />
            )}
            {activeStep === 'settings' && (
              <SettingsStep
                frequency={definition.frequency}
                abTest={definition.abTest}
                priority={definition.priority ?? 50}
                onFrequencyChange={f => setDefinition(d => ({ ...d, frequency: f }))}
                onAbTestChange={ab => setDefinition(d => ({ ...d, abTest: ab }))}
                onPriorityChange={p => setDefinition(d => ({ ...d, priority: p }))}
              />
            )}
          </div>
        </div>

        {/* Footer nav */}
        <div className="border-t border-border/60 bg-background/95 px-6 md:px-8 py-4 flex items-center justify-between shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5"
            onClick={goBack}
            disabled={stepIndex === 0}
          >
            Back
          </Button>
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div
                key={s.key}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === stepIndex ? 'w-6 bg-primary' : i < stepIndex ? 'w-3 bg-primary/50' : 'w-3 bg-muted',
                )}
              />
            ))}
          </div>
          {isLastStep ? (
            <Button
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => onSave(definition)}
              disabled={isSaving}
            >
              {isSaving ? 'Saving…' : 'Save Automation'}
            </Button>
          ) : (
            <Button size="sm" className="h-9 gap-1.5" onClick={goNext}>
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Summary on last step above footer */}
        {isLastStep && (
          <></>
        )}
      </div>

      {/* Show summary preview alongside the last settings step */}
    </div>
  );
}
