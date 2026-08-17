'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { motion } from 'framer-motion';
import {
  Globe, MousePointer, TrendingDown, Clock, LogOut, Coffee, Zap,
  AlertTriangle, EyeOff, Eye, UserCheck, MessageSquare, Bell, Layout,
  Highlighter, FileText, ExternalLink, Tag, Webhook, Plus, Trash2,
  Settings, ZoomIn, ZoomOut, Maximize2, X, Save, Filter, Layers,
  GripVertical, ChevronDown, ChevronRight, ListChecks, Braces, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Exported Types ──────────────────────────────────────────────────────────

export interface TriggerConfig { type: string; [k: string]: unknown }

export interface AutomationDefinition {
  /** Legacy single trigger — kept for backward compatibility on load/save. */
  trigger?: TriggerConfig;
  /** One or more triggers; the automation fires when ANY of them matches. */
  triggers?: TriggerConfig[];
  conditions?: ConditionGroup | null;
  actions: Array<{ type: string; [k: string]: unknown }>;
  frequency?: { maxPerSession?: number; maxPerUser?: number; cooldownDays?: number };
  abTest?: { enabled: boolean; variants: Array<{ id: string; weight: number }> };
  priority?: number;
}

/** Normalise a definition (legacy `trigger` or new `triggers[]`) into an array. */
export function normalizeTriggers(def: AutomationDefinition): TriggerConfig[] {
  if (def.triggers?.length) return def.triggers;
  if (def.trigger?.type) return [def.trigger];
  return [];
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

type SelectedNode =
  | { kind: 'trigger'; index: number }
  | { kind: 'condition' }
  | { kind: 'action'; index: number }
  | { kind: 'settings' };

// ─── Constants ───────────────────────────────────────────────────────────────

type TriggerType = { value: string; label: string; icon: React.ElementType; description: string; hasConfig: boolean };

const TRIGGER_TYPES: TriggerType[] = [
  { value: 'page_view',    label: 'Page View',       icon: Globe,         description: 'Triggers when a user visits a specific page', hasConfig: true },
  { value: 'click',        label: 'Click',            icon: MousePointer,  description: 'Triggers when a user clicks an element',      hasConfig: true },
  { value: 'scroll_depth', label: 'Scroll Depth',     icon: TrendingDown,  description: 'Triggers when a user scrolls to a depth',     hasConfig: true },
  { value: 'time_on_page', label: 'Time on Page',     icon: Clock,         description: 'Triggers after a user spends time on page',   hasConfig: true },
  { value: 'exit_intent',  label: 'Exit Intent',      icon: LogOut,        description: 'Triggers when a user is about to leave',      hasConfig: false },
  { value: 'inactivity',   label: 'Inactivity',       icon: Coffee,        description: 'Triggers after a user is inactive',           hasConfig: true },
  { value: 'rage_click',   label: 'Rage Click',       icon: Zap,           description: 'Triggers on repeated rapid clicks',           hasConfig: false },
  { value: 'form_abandon', label: 'Form Abandonment', icon: AlertTriangle, description: 'Triggers when a form is abandoned',           hasConfig: false },
  { value: 'js_error',     label: 'JS Error',         icon: AlertTriangle, description: 'Triggers on a JavaScript error',              hasConfig: false },
  { value: 'tab_hidden',   label: 'Tab Hidden',       icon: EyeOff,        description: 'Triggers when the tab is hidden',             hasConfig: false },
  { value: 'tab_visible',  label: 'Tab Visible',      icon: Eye,           description: 'Triggers when the tab becomes visible again', hasConfig: false },
  { value: 'custom_event', label: 'Custom Event',     icon: Zap,           description: 'Triggers on a named custom event',            hasConfig: true },
  { value: 'identify',     label: 'Identify',         icon: UserCheck,     description: 'Triggers when a user is identified',          hasConfig: false },
];

type ActionType = {
  value: string; label: string; icon: React.ElementType;
  strip: string; iconBg: string; iconColor: string; description: string;
};

const ACTION_TYPES: ActionType[] = [
  { value: 'show_modal',          label: 'Show Modal',          icon: MessageSquare, strip: 'bg-blue-500',    iconBg: 'bg-blue-500/15',    iconColor: 'text-blue-400',    description: 'Display a popup modal to the visitor' },
  { value: 'show_toast',          label: 'Show Toast',          icon: Bell,          strip: 'bg-emerald-500', iconBg: 'bg-emerald-500/15', iconColor: 'text-emerald-400', description: 'Show a small notification toast' },
  { value: 'show_banner',         label: 'Show Banner',         icon: Layout,        strip: 'bg-violet-500',  iconBg: 'bg-violet-500/15',  iconColor: 'text-violet-400',  description: 'Display a full-width page banner' },
  { value: 'highlight_element',   label: 'Highlight Element',   icon: Highlighter,   strip: 'bg-yellow-500',  iconBg: 'bg-yellow-500/15',  iconColor: 'text-yellow-400',  description: 'Draw attention to a page element' },
  { value: 'show_tooltip',        label: 'Show Tooltip',        icon: FileText,      strip: 'bg-indigo-500',  iconBg: 'bg-indigo-500/15',  iconColor: 'text-indigo-400',  description: 'Attach a tooltip to any element' },
  { value: 'personalize_content', label: 'Personalize Content', icon: FileText,      strip: 'bg-teal-500',    iconBg: 'bg-teal-500/15',    iconColor: 'text-teal-400',    description: 'Swap text or HTML on the page' },
  { value: 'redirect',            label: 'Redirect',            icon: ExternalLink,  strip: 'bg-orange-500',  iconBg: 'bg-orange-500/15',  iconColor: 'text-orange-400',  description: 'Send the visitor to another URL' },
  { value: 'tag_session',         label: 'Tag Session',         icon: Tag,           strip: 'bg-pink-500',    iconBg: 'bg-pink-500/15',    iconColor: 'text-pink-400',    description: 'Label the session for filtering' },
  { value: 'webhook',             label: 'Webhook',             icon: Webhook,       strip: 'bg-slate-400',   iconBg: 'bg-slate-400/15',   iconColor: 'text-slate-300',   description: 'POST data to an external endpoint' },
];

const CONDITION_OPERATORS = [
  'equals', 'notEquals', 'greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual',
  'contains', 'notContains', 'startsWith', 'endsWith', 'matches', 'isSet', 'isNotSet',
  'isTrue', 'isFalse', 'in', 'notIn',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTriggerType(type: string): TriggerType {
  return TRIGGER_TYPES.find(t => t.value === type) ?? TRIGGER_TYPES[0]!;
}

function getActionType(type: string): ActionType {
  return ACTION_TYPES.find(a => a.value === type) ?? ACTION_TYPES[0]!;
}

function actionSummary(action: { type: string; [k: string]: unknown }): string {
  const t = action.type;
  if (t === 'show_modal')          return String(action.title || 'Untitled modal');
  if (t === 'show_toast')          return String(action.message || 'Toast notification');
  if (t === 'show_banner')         return String(action.message || 'Banner');
  if (t === 'highlight_element')   return `Highlight: ${String(action.selector || '?')}`;
  if (t === 'show_tooltip')        return String(action.message || 'Tooltip');
  if (t === 'personalize_content') return `Set content on ${String(action.selector || '?')}`;
  if (t === 'redirect')            return `→ ${String(action.url || '?')}`;
  if (t === 'tag_session')         return `Tag: ${String(action.tag || '?')}`;
  if (t === 'webhook')             return String(action.url || 'Webhook URL');
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

// ─── Form Primitives ─────────────────────────────────────────────────────────

function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Trigger Config Form ──────────────────────────────────────────────────────

function TriggerConfigForm({
  type, config, onChange,
}: { type: string; config: Record<string, unknown>; onChange: (cfg: Record<string, unknown>) => void }) {
  const set = (key: string, val: unknown) => onChange({ ...config, [key]: val });

  if (type === 'page_view') {
    return (
      <div className="space-y-3">
        <FieldGroup label="Page Path" hint="Leave empty to match all pages">
          <Input placeholder="/pricing" value={String(config.path ?? '')} onChange={e => set('path', e.target.value)} className="bg-muted border-border text-foreground placeholder:text-muted-foreground" />
        </FieldGroup>
        <FieldGroup label="Match Type">
          <Select value={String(config.match_type ?? 'contains')} onValueChange={v => set('match_type', v)}>
            <SelectTrigger className="bg-muted border-border text-foreground"><SelectValue /></SelectTrigger>
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
        <Input placeholder="#submit-button" value={String(config.selector ?? '')} onChange={e => set('selector', e.target.value)} className="bg-muted border-border text-foreground placeholder:text-muted-foreground" />
      </FieldGroup>
    );
  }
  if (type === 'scroll_depth') {
    return (
      <FieldGroup label="Scroll Depth">
        <Select value={String(config.depth ?? '50')} onValueChange={v => set('depth', Number(v))}>
          <SelectTrigger className="bg-muted border-border text-foreground"><SelectValue /></SelectTrigger>
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
        <Input type="number" min={1} placeholder="30" value={String(config.seconds ?? '')} onChange={e => set('seconds', Number(e.target.value))} className="bg-muted border-border text-foreground placeholder:text-muted-foreground" />
      </FieldGroup>
    );
  }
  if (type === 'inactivity') {
    return (
      <FieldGroup label="Inactivity Duration">
        <Select value={String(config.seconds ?? '60')} onValueChange={v => set('seconds', Number(v))}>
          <SelectTrigger className="bg-muted border-border text-foreground"><SelectValue /></SelectTrigger>
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
      <FieldGroup label="Event Name" hint="Exact name used in snc('track', ...)">
        <Input placeholder="checkout_started" value={String(config.name ?? '')} onChange={e => set('name', e.target.value)} className="bg-muted border-border text-foreground placeholder:text-muted-foreground" />
      </FieldGroup>
    );
  }
  return <p className="text-xs text-muted-foreground italic">No configuration needed for this trigger.</p>;
}

// ─── Action Config Form ───────────────────────────────────────────────────────

function ActionConfigForm({
  action, onChange,
}: { action: { type: string; [k: string]: unknown }; onChange: (a: { type: string; [k: string]: unknown }) => void }) {
  const set = (key: string, val: unknown) => onChange({ ...action, [key]: val });
  const tplHint = 'Supports {{user.firstName | default:there}}, {{user.plan}}, {{page}}';
  const t = action.type;
  const inp = 'bg-muted border-border text-foreground placeholder:text-muted-foreground';
  const ta = 'bg-muted border-border text-foreground placeholder:text-muted-foreground font-mono text-xs';

  if (t === 'show_modal') {
    return (
      <div className="space-y-3">
        <FieldGroup label="Title" hint={tplHint}>
          <Input value={String(action.title ?? '')} onChange={e => set('title', e.target.value)} placeholder="Headline" className={inp} />
        </FieldGroup>
        <FieldGroup label="Body" hint={tplHint}>
          <Textarea value={String(action.body ?? '')} onChange={e => set('body', e.target.value)} placeholder="Modal body text…" rows={3} className={ta} />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Button Text">
            <Input value={String(action.button_text ?? '')} onChange={e => set('button_text', e.target.value)} placeholder="Get started" className={inp} />
          </FieldGroup>
          <FieldGroup label="Button URL">
            <Input value={String(action.button_url ?? '')} onChange={e => set('button_url', e.target.value)} placeholder="/signup" className={inp} />
          </FieldGroup>
        </div>
        <FieldGroup label="Image URL (optional)">
          <Input value={String(action.image_url ?? '')} onChange={e => set('image_url', e.target.value)} placeholder="https://…" className={inp} />
        </FieldGroup>
        <div className="grid grid-cols-3 gap-2">
          <FieldGroup label="BG Color"><Input value={String(action.background_color ?? '')} onChange={e => set('background_color', e.target.value)} placeholder="#fff" className={inp} /></FieldGroup>
          <FieldGroup label="Text Color"><Input value={String(action.text_color ?? '')} onChange={e => set('text_color', e.target.value)} placeholder="#000" className={inp} /></FieldGroup>
          <FieldGroup label="Btn Color"><Input value={String(action.button_color ?? '')} onChange={e => set('button_color', e.target.value)} placeholder="#06f" className={inp} /></FieldGroup>
        </div>
      </div>
    );
  }

  if (t === 'show_toast') {
    return (
      <div className="space-y-3">
        <FieldGroup label="Message" hint={tplHint}>
          <Input value={String(action.message ?? '')} onChange={e => set('message', e.target.value)} placeholder="Notification text" className={inp} />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Position">
            <Select value={String(action.position ?? 'bottom-right')} onValueChange={v => set('position', v)}>
              <SelectTrigger className={inp}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="top-left">Top Left</SelectItem>
                <SelectItem value="top-right">Top Right</SelectItem>
                <SelectItem value="bottom-left">Bottom Left</SelectItem>
                <SelectItem value="bottom-right">Bottom Right</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="Duration (ms)">
            <Input type="number" min={0} value={String(action.duration_ms ?? 4000)} onChange={e => set('duration_ms', Number(e.target.value))} className={inp} />
          </FieldGroup>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="BG Color"><Input value={String(action.background_color ?? '')} onChange={e => set('background_color', e.target.value)} placeholder="#1a1a1a" className={inp} /></FieldGroup>
          <FieldGroup label="Text Color"><Input value={String(action.text_color ?? '')} onChange={e => set('text_color', e.target.value)} placeholder="#fff" className={inp} /></FieldGroup>
        </div>
      </div>
    );
  }

  if (t === 'show_banner') {
    return (
      <div className="space-y-3">
        <FieldGroup label="Message" hint={tplHint}>
          <Input value={String(action.message ?? '')} onChange={e => set('message', e.target.value)} placeholder="Banner message" className={inp} />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Position">
            <Select value={String(action.position ?? 'top')} onValueChange={v => set('position', v)}>
              <SelectTrigger className={inp}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="top">Top</SelectItem>
                <SelectItem value="bottom">Bottom</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="Duration (ms, 0=sticky)">
            <Input type="number" min={0} value={String(action.duration_ms ?? 0)} onChange={e => set('duration_ms', Number(e.target.value))} className={inp} />
          </FieldGroup>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Button Text"><Input value={String(action.button_text ?? '')} onChange={e => set('button_text', e.target.value)} placeholder="Learn more" className={inp} /></FieldGroup>
          <FieldGroup label="Button URL"><Input value={String(action.button_url ?? '')} onChange={e => set('button_url', e.target.value)} placeholder="/features" className={inp} /></FieldGroup>
        </div>
      </div>
    );
  }

  if (t === 'highlight_element') {
    return (
      <div className="space-y-3">
        <FieldGroup label="CSS Selector">
          <Input value={String(action.selector ?? '')} onChange={e => set('selector', e.target.value)} placeholder=".feature-section" className={inp} />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Duration (ms)">
            <Input type="number" min={0} value={String(action.duration_ms ?? 3000)} onChange={e => set('duration_ms', Number(e.target.value))} className={inp} />
          </FieldGroup>
          <FieldGroup label="Scroll Into View">
            <div className="flex items-center gap-2 pt-2">
              <Switch checked={Boolean(action.scroll_into_view ?? true)} onCheckedChange={v => set('scroll_into_view', v)} />
              <span className="text-xs text-muted-foreground">{Boolean(action.scroll_into_view ?? true) ? 'Yes' : 'No'}</span>
            </div>
          </FieldGroup>
        </div>
      </div>
    );
  }

  if (t === 'show_tooltip') {
    return (
      <div className="space-y-3">
        <FieldGroup label="CSS Selector">
          <Input value={String(action.selector ?? '')} onChange={e => set('selector', e.target.value)} placeholder="#pricing-btn" className={inp} />
        </FieldGroup>
        <FieldGroup label="Message" hint={tplHint}>
          <Textarea value={String(action.message ?? '')} onChange={e => set('message', e.target.value)} rows={2} placeholder="Tooltip text…" className={ta} />
        </FieldGroup>
        <FieldGroup label="Duration (ms)">
          <Input type="number" min={0} value={String(action.duration_ms ?? 5000)} onChange={e => set('duration_ms', Number(e.target.value))} className={inp} />
        </FieldGroup>
      </div>
    );
  }

  if (t === 'personalize_content') {
    return (
      <div className="space-y-3">
        <FieldGroup label="CSS Selector">
          <Input value={String(action.selector ?? '')} onChange={e => set('selector', e.target.value)} placeholder=".hero-title" className={inp} />
        </FieldGroup>
        <FieldGroup label="Text Content" hint={tplHint}>
          <Input value={String(action.text ?? '')} onChange={e => set('text', e.target.value)} placeholder="Hello {{user.firstName | default:there}}!" className={inp} />
        </FieldGroup>
        <FieldGroup label="HTML Content (overrides text)">
          <Textarea value={String(action.html ?? '')} onChange={e => set('html', e.target.value)} rows={2} placeholder="<strong>Hello!</strong>" className={ta} />
        </FieldGroup>
      </div>
    );
  }

  if (t === 'redirect') {
    return (
      <div className="space-y-3">
        <FieldGroup label="Redirect URL">
          <Input value={String(action.url ?? '')} onChange={e => set('url', e.target.value)} placeholder="https://example.com/page" className={inp} />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Delay (ms)">
            <Input type="number" min={0} value={String(action.delay_ms ?? 0)} onChange={e => set('delay_ms', Number(e.target.value))} className={inp} />
          </FieldGroup>
          <FieldGroup label="New Tab">
            <div className="flex items-center gap-2 pt-2">
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
        <Input value={String(action.tag ?? '')} onChange={e => set('tag', e.target.value)} placeholder="e.g. high-intent" className={inp} />
      </FieldGroup>
    );
  }

  if (t === 'webhook') {
    const headersStr = typeof action.headers === 'string' ? action.headers : JSON.stringify(action.headers ?? {}, null, 2);
    const bodyStr = typeof action.body === 'string' ? action.body : JSON.stringify(action.body ?? {}, null, 2);
    return (
      <div className="space-y-3">
        <FieldGroup label="Webhook URL">
          <Input value={String(action.url ?? '')} onChange={e => set('url', e.target.value)} placeholder="https://hooks.slack.com/…" className={inp} />
        </FieldGroup>
        <FieldGroup label="HTTP Method">
          <Select value={String(action.method ?? 'POST')} onValueChange={v => set('method', v)}>
            <SelectTrigger className={inp}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="Headers (JSON)">
          <Textarea value={headersStr} onChange={e => { try { set('headers', JSON.parse(e.target.value)); } catch { set('headers', e.target.value); } }} rows={3} className={ta} placeholder={'{\n  "Content-Type": "application/json"\n}'} />
        </FieldGroup>
        <FieldGroup label="Body (JSON)">
          <Textarea value={bodyStr} onChange={e => { try { set('body', JSON.parse(e.target.value)); } catch { set('body', e.target.value); } }} rows={4} className={ta} placeholder={'{\n  "text": "{{user.firstName}} triggered…"\n}'} />
        </FieldGroup>
      </div>
    );
  }

  return <p className="text-xs text-muted-foreground italic">No configuration for this action type.</p>;
}

// ─── Node Connector ───────────────────────────────────────────────────────────

function NodeConnector({ onAdd }: { onAdd: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="relative flex h-14 w-full items-center justify-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Animated flowing connection */}
      <svg
        className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2"
        width="12"
        height="100%"
        viewBox="0 0 12 56"
        preserveAspectRatio="none"
        fill="none"
      >
        <line x1="6" y1="0" x2="6" y2="56" className="stroke-primary/20" strokeWidth="2" />
        <line
          x1="6"
          y1="0"
          x2="6"
          y2="56"
          className="stroke-primary"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="1 9"
          style={{ animation: 'seenticsFlowDown 0.9s linear infinite' }}
        />
        <path d="M2.5 47 L6 52 L9.5 47" className="stroke-primary/70" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {/* Add button */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onAdd(); }}
        className={cn(
          'relative z-10 flex h-7 w-7 items-center justify-center rounded-full border shadow-sm transition-all duration-150',
          hovered ? 'scale-110 border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground',
        )}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Canvas Node Cards ────────────────────────────────────────────────────────

function NodeCard({
  strip, iconBg, iconColor, icon: Icon, label, title, subtitle,
  selected, onClick, onDelete, draggable,
  onDragStart, onDragOver, onDrop, dragIndicator,
}: {
  strip: string;
  iconBg: string;
  iconColor: string;
  icon: React.ElementType;
  label: string;
  title: string;
  subtitle: string;
  selected: boolean;
  onClick: () => void;
  onDelete?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  dragIndicator?: boolean;
}) {
  return (
    <div
      data-node="true"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        'group relative w-72 cursor-pointer select-none rounded-lg border bg-card p-4 shadow-sm transition-all duration-150',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border/70 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md',
        dragIndicator && 'border-emerald-500/60 ring-2 ring-emerald-500/20',
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', iconBg)}>
          <Icon className={cn('h-5 w-5', iconColor)} style={{ width: 20, height: 20 }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <span className={cn('h-1.5 w-1.5 rounded-full', strip)} />
              {label}
            </span>
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {draggable && <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60" />}
              {onDelete && (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onDelete(); }}
                  className="flex h-5 w-5 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          <p className="mt-0.5 truncate text-sm font-semibold leading-tight text-foreground">{title}</p>
          <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Right Sidebar Panels ─────────────────────────────────────────────────────

function TriggerPanel({
  trigger, onChange, onDelete, frequency, onFrequencyChange,
}: {
  trigger: { type: string; [k: string]: unknown };
  onChange: (t: { type: string; [k: string]: unknown }) => void;
  onDelete?: () => void;
  frequency?: AutomationDefinition['frequency'];
  onFrequencyChange?: (f: AutomationDefinition['frequency']) => void;
}) {
  const td = getTriggerType(trigger.type);
  const { type, ...config } = trigger;
  const inp = 'bg-muted border-border text-foreground placeholder:text-muted-foreground';
  const setFreq = (key: string, val: number | undefined) => onFrequencyChange?.({ ...frequency, [key]: val });
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Trigger Type</p>
        <Select value={type} onValueChange={v => onChange({ type: v })}>
          <SelectTrigger className="bg-muted border-border text-foreground"><SelectValue /></SelectTrigger>
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
        <p className="text-[11px] text-muted-foreground mt-2">{td.description}</p>
      </div>
      {td.hasConfig && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Configuration</p>
          <TriggerConfigForm type={type} config={config as Record<string, unknown>} onChange={cfg => onChange({ type, ...cfg })} />
        </div>
      )}

      {onFrequencyChange && (
        <div className="border-t border-border pt-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Frequency</p>
          <p className="mb-3 text-[11px] text-muted-foreground">How often this automation can fire per visitor. Leave blank for no limit.</p>
          <div className="space-y-3">
            <FieldGroup label="Max per session" hint="e.g. 1">
              <Input type="number" min={0} value={String(frequency?.maxPerSession ?? '')} onChange={e => setFreq('maxPerSession', e.target.value ? Number(e.target.value) : undefined)} placeholder="Unlimited" className={inp} />
            </FieldGroup>
            <FieldGroup label="Max per user">
              <Input type="number" min={0} value={String(frequency?.maxPerUser ?? '')} onChange={e => setFreq('maxPerUser', e.target.value ? Number(e.target.value) : undefined)} placeholder="Unlimited" className={inp} />
            </FieldGroup>
            <FieldGroup label="Cooldown (days)">
              <Input type="number" min={0} value={String(frequency?.cooldownDays ?? '')} onChange={e => setFreq('cooldownDays', e.target.value ? Number(e.target.value) : undefined)} placeholder="None" className={inp} />
            </FieldGroup>
          </div>
        </div>
      )}

      {onDelete && (
        <div className="pt-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-full gap-1.5 text-xs text-red-400/70 hover:bg-red-500/10 hover:text-red-400"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Trigger
          </Button>
        </div>
      )}
    </div>
  );
}

function ConditionPanel({
  conditions, onChange,
}: { conditions: ConditionGroup | null | undefined; onChange: (c: ConditionGroup | null) => void }) {
  const rules = conditions?.rules ?? [];
  const operator = conditions?.operator ?? 'AND';
  const inp = 'bg-muted border-border text-foreground placeholder:text-muted-foreground h-8 text-xs';

  const addRule = () => onChange({ operator: operator as 'AND' | 'OR' | 'NOT', rules: [...rules, { fact: '', operator: 'equals', value: '' }] });
  const removeRule = (i: number) => { const r = rules.filter((_, idx) => idx !== i); onChange(r.length ? { operator: operator as 'AND' | 'OR' | 'NOT', rules: r } : null); };
  const updateRule = (i: number, rule: ConditionRule) => onChange({ operator: operator as 'AND' | 'OR' | 'NOT', rules: rules.map((r, idx) => idx === i ? rule : r) });

  return (
    <div className="space-y-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Conditions</p>
      {rules.length > 1 && (
        <div className="flex gap-2">
          {(['AND', 'OR'] as const).map(op => (
            <button
              key={op}
              type="button"
              onClick={() => onChange({ operator: op, rules })}
              className={cn('px-3 py-1 rounded-lg text-xs font-semibold transition-colors', operator === op ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-muted text-muted-foreground border border-border hover:bg-muted')}
            >
              {op}
            </button>
          ))}
          <span className="text-[10px] text-muted-foreground self-center">{operator === 'AND' ? 'all must match' : 'any can match'}</span>
        </div>
      )}
      <div className="space-y-2">
        {rules.map((rule, i) => (
          <div key={i} className="rounded-lg border border-border bg-muted p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Rule {i + 1}</span>
              <button type="button" onClick={() => removeRule(i)} className="text-muted-foreground hover:text-red-400 transition-colors"><X className="h-3 w-3" /></button>
            </div>
            <Input placeholder="fact (e.g. user.plan)" value={rule.fact} onChange={e => updateRule(i, { ...rule, fact: e.target.value })} className={inp} />
            <Select value={rule.operator} onValueChange={v => updateRule(i, { ...rule, operator: v })}>
              <SelectTrigger className={inp}><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-40">
                {CONDITION_OPERATORS.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              placeholder="value"
              value={String(rule.value ?? '')}
              onChange={e => updateRule(i, { ...rule, value: e.target.value })}
              disabled={['isSet', 'isNotSet', 'isTrue', 'isFalse'].includes(rule.operator)}
              className={inp}
            />
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs border-border bg-muted text-muted-foreground hover:bg-muted hover:text-foreground" onClick={addRule}>
        <Plus className="h-3 w-3" />
        Add Rule
      </Button>
      {rules.length === 0 && <p className="text-[11px] text-muted-foreground italic">No rules — automation fires for all users.</p>}
    </div>
  );
}

function ActionPanel({
  action, onChange, onDelete,
}: { action: { type: string; [k: string]: unknown }; onChange: (a: { type: string; [k: string]: unknown }) => void; onDelete: () => void }) {
  const at = getActionType(action.type);
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Action Type</p>
        <Select value={action.type} onValueChange={v => onChange(defaultAction(v))}>
          <SelectTrigger className="bg-muted border-border text-foreground"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ACTION_TYPES.map(a => (
              <SelectItem key={a.value} value={a.value}>
                <div className="flex items-center gap-2">
                  <a.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{a.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Configuration</p>
        <ActionConfigForm action={action} onChange={onChange} />
      </div>
      <div className="pt-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10 w-full"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete Action
        </Button>
      </div>
    </div>
  );
}

function SettingsPanel({
  definition, onAbTestChange, onPriorityChange,
}: {
  definition: AutomationDefinition;
  onAbTestChange: (ab: AutomationDefinition['abTest']) => void;
  onPriorityChange: (p: number) => void;
}) {
  const { abTest, priority = 50 } = definition;
  const inp = 'bg-muted border-border text-foreground placeholder:text-muted-foreground';

  const addVariant = () => {
    const variants = abTest?.variants ?? [];
    onAbTestChange({ enabled: true, variants: [...variants, { id: `v${variants.length + 1}`, weight: 50 }] });
  };
  const removeVariant = (i: number) => onAbTestChange({ enabled: abTest?.enabled ?? true, variants: (abTest?.variants ?? []).filter((_, idx) => idx !== i) });
  const updateVariant = (i: number, field: 'id' | 'weight', val: string | number) => {
    const variants = (abTest?.variants ?? []).map((v, idx) => idx === i ? { ...v, [field]: field === 'weight' ? Number(val) : val } : v);
    onAbTestChange({ enabled: abTest?.enabled ?? true, variants });
  };

  return (
    <div className="space-y-6">

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Priority</p>
          <Badge variant="outline" className="text-[10px] tabular-nums border-border text-muted-foreground">{priority}</Badge>
        </div>
        <Slider min={1} max={100} step={1} value={[priority]} onValueChange={([v]) => onPriorityChange(v!)} className="w-full" />
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>1 (lowest)</span><span>100 (highest)</span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">A/B Testing</p>
          <Switch checked={abTest?.enabled ?? false} onCheckedChange={v => onAbTestChange({ enabled: v, variants: abTest?.variants ?? [] })} />
        </div>
        {abTest?.enabled && (
          <div className="space-y-2">
            {(abTest.variants ?? []).map((variant, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={variant.id} onChange={e => updateVariant(i, 'id', e.target.value)} placeholder="variant-a" className={cn(inp, 'flex-1 h-8 text-xs')} />
                <Input type="number" min={0} max={100} value={String(variant.weight)} onChange={e => updateVariant(i, 'weight', e.target.value)} className={cn(inp, 'w-16 h-8 text-xs text-right')} />
                <span className="text-xs text-muted-foreground">%</span>
                <button type="button" onClick={() => removeVariant(i)} className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs border-border bg-muted text-muted-foreground hover:bg-muted hover:text-foreground" onClick={addVariant}>
              <Plus className="h-3 w-3" />
              Add Variant
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add Node Modal ───────────────────────────────────────────────────────────

type AddNodeChoice =
  | { nodeKind: 'condition' }
  | { nodeKind: 'action'; actionType: string };

function AddNodeModal({
  hasCondition, onAdd, onClose,
}: { hasCondition: boolean; onAdd: (choice: AddNodeChoice) => void; onClose: () => void }) {
  const [tab, setTab] = useState<'condition' | 'action'>('action');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        className="relative flex max-h-[86dvh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border/60 bg-card shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border/60 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-foreground">Add a node</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">Choose what happens next in your automation.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-6 pt-4">
          {!hasCondition && (
            <button
              type="button"
              onClick={() => setTab('condition')}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                tab === 'condition' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              Condition
            </button>
          )}
          <button
            type="button"
            onClick={() => setTab('action')}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              tab === 'action' ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            Action
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6 pt-4">
          {tab === 'condition' && !hasCondition && (
            <button
              type="button"
              className="group flex w-full items-center gap-4 rounded-lg border border-border/60 bg-background p-5 text-left transition-all hover:-translate-y-0.5 hover:border-amber-500/40 hover:shadow-md"
              onClick={() => onAdd({ nodeKind: 'condition' })}
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
                <Filter className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">Conditions</p>
                <p className="mt-0.5 text-sm text-muted-foreground">Add rules to control exactly when this automation fires.</p>
              </div>
            </button>
          )}
          {tab === 'action' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ACTION_TYPES.map(at => {
                const Icon = at.icon;
                return (
                  <button
                    key={at.value}
                    type="button"
                    className="group flex items-center gap-3.5 rounded-lg border border-border/60 bg-background p-4 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                    onClick={() => onAdd({ nodeKind: 'action', actionType: at.value })}
                  >
                    <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105', at.iconBg)}>
                      <Icon className={cn('h-6 w-6', at.iconColor)} style={{ width: 24, height: 24 }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight text-foreground">{at.label}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{at.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── JSON Editor Modal ────────────────────────────────────────────────────────

function JsonEditorModal({
  definition,
  onApply,
  onClose,
}: {
  definition: AutomationDefinition;
  onApply: (def: AutomationDefinition) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(definition, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const handleApply = () => {
    try {
      const parsed = JSON.parse(text) as AutomationDefinition;
      if (!parsed.trigger || !Array.isArray(parsed.actions)) {
        setError('JSON must have "trigger" and "actions" fields.');
        return;
      }
      onApply(parsed);
      setError(null);
      setApplied(true);
      setTimeout(() => setApplied(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  const handleFormat = () => {
    try {
      setText(JSON.stringify(JSON.parse(text), null, 2));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl rounded-lg border border-border bg-card shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '85dvh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <Braces className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-semibold text-foreground">JSON Config</span>
            <span className="text-[10px] text-muted-foreground bg-muted border border-border rounded-lg px-1.5 py-0.5">AutomationDefinition</span>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden p-4">
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setError(null); setApplied(false); }}
            spellCheck={false}
            className="w-full h-full min-h-[340px] rounded-lg border border-border bg-muted/40 text-[13px] font-mono text-foreground p-4 resize-none focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 leading-relaxed placeholder:text-muted-foreground"
            placeholder="Paste or edit your automation JSON here…"
          />
        </div>

        {/* Status bar */}
        <div className="px-4 pb-2 shrink-0">
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono">{error}</span>
            </div>
          )}
          {applied && !error && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/8 border border-emerald-500/15 rounded-lg px-3 py-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>Applied — canvas updated.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border shrink-0">
          <button
            type="button"
            onClick={handleFormat}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            Format JSON
          </button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-foreground border-0 px-4"
              onClick={handleApply}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Apply
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Node Palette (right sidebar default) ─────────────────────────────────────

function PaletteRow({
  icon: Icon, iconBg, iconColor, label, hint, onDragStart, onClick,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
  hint?: string;
  onDragStart: (e: React.DragEvent) => void;
  onClick: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="group flex cursor-grab select-none items-center gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:cursor-grabbing"
    >
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{label}</p>
        {hint ? <p className="truncate text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground/70" />
    </div>
  );
}

function NodePalette({
  tab, onTab, onAddTrigger, onAddAction, onDragStart, onClose, onAddCondition,
}: {
  tab: 'triggers' | 'actions';
  onTab: (t: 'triggers' | 'actions') => void;
  onAddTrigger: (type: string) => void;
  onAddAction: (type: string) => void;
  onDragStart: (e: React.DragEvent, kind: 'trigger' | 'action', type: string) => void;
  onClose?: () => void;
  onAddCondition?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border/60 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Add a node</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Drag onto the canvas, or click to add.</p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(['triggers', 'actions'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => onTab(t)}
              className={cn(
                'rounded-lg py-1.5 text-xs font-semibold capitalize transition-colors',
                tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {tab === 'triggers'
          ? TRIGGER_TYPES.map(t => (
              <PaletteRow
                key={t.value}
                icon={t.icon}
                iconBg="bg-emerald-500/10"
                iconColor="text-emerald-500"
                label={t.label}
                hint={t.description}
                onDragStart={e => onDragStart(e, 'trigger', t.value)}
                onClick={() => onAddTrigger(t.value)}
              />
            ))
          : ACTION_TYPES.map(a => (
              <PaletteRow
                key={a.value}
                icon={a.icon}
                iconBg={a.iconBg}
                iconColor={a.iconColor}
                label={a.label}
                hint={a.description}
                onDragStart={e => onDragStart(e, 'action', a.value)}
                onClick={() => onAddAction(a.value)}
              />
            ))}

        {tab === 'actions' && onAddCondition && (
          <button
            type="button"
            onClick={onAddCondition}
            className="mt-2 flex w-full items-center gap-3 rounded-lg border border-dashed border-border/70 bg-transparent px-3 py-2.5 text-left transition-colors hover:border-amber-500/50 hover:bg-amber-500/[0.04]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
              <Filter className="h-4 w-4 text-amber-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">Add condition</p>
              <p className="truncate text-[11px] text-muted-foreground">Gate the flow with rules (optional)</p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const DEFAULT_DEFINITION: AutomationDefinition = {
  triggers: [], // empty = no trigger yet; canvas prompts to add one
  conditions: null,
  actions: [],
  frequency: {},
  abTest: { enabled: false, variants: [] },
  priority: 50,
};

export function AutomationBuilder({ initialDefinition, onSave, isSaving, className }: AutomationBuilderProps) {
  const [definition, setDefinition] = useState<AutomationDefinition>(() => {
    const base = initialDefinition ?? DEFAULT_DEFINITION;
    return { ...base, triggers: normalizeTriggers(base), trigger: undefined };
  });
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [paletteTab, setPaletteTab] = useState<'triggers' | 'actions'>('triggers');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragSrc, setDragSrc] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [showJson, setShowJson] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({ active: false, startX: 0, startY: 0, fromX: 0, fromY: 0 });

  // non-passive wheel for zoom
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom(z => Math.min(2, Math.max(0.3, z - e.deltaY * 0.002)));
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    panRef.current = { active: true, startX: e.clientX, startY: e.clientY, fromX: pan.x, fromY: pan.y };
    setSelected(null);
  };
  const onCanvasMouseMove = (e: React.MouseEvent) => {
    if (!panRef.current.active) return;
    setPan({ x: panRef.current.fromX + e.clientX - panRef.current.startX, y: panRef.current.fromY + e.clientY - panRef.current.startY });
  };
  const onCanvasMouseUp = () => { panRef.current.active = false; };

  const hasCondition = !!definition.conditions?.rules?.length;
  const triggers = definition.triggers ?? [];
  const hasTrigger = triggers.length > 0;

  const updateTrigger = (index: number, t: TriggerConfig) =>
    setDefinition(d => ({ ...d, triggers: (d.triggers ?? []).map((x, i) => (i === index ? t : x)) }));
  const deleteTrigger = (index: number) => {
    setDefinition(d => ({ ...d, triggers: (d.triggers ?? []).filter((_, i) => i !== index) }));
    if (selected?.kind === 'trigger' && selected.index === index) setSelected(null);
  };
  const updateConditions = (c: ConditionGroup | null) => setDefinition(d => ({ ...d, conditions: c }));
  const updateAction = (i: number, a: { type: string; [k: string]: unknown }) => setDefinition(d => ({ ...d, actions: d.actions.map((x, idx) => idx === i ? a : x) }));
  const deleteAction = (i: number) => {
    setDefinition(d => ({ ...d, actions: d.actions.filter((_, idx) => idx !== i) }));
    if (selected?.kind === 'action' && selected.index === i) setSelected(null);
  };
  const deleteCondition = () => {
    setDefinition(d => ({ ...d, conditions: null }));
    if (selected?.kind === 'condition') setSelected(null);
  };

  // Add nodes from the palette (click or drop).
  const addTriggerType = (type: string) => {
    setDefinition(d => {
      const next = { ...d, triggers: [...(d.triggers ?? []), { type } as TriggerConfig] };
      setSelected({ kind: 'trigger', index: next.triggers.length - 1 });
      return next;
    });
  };
  const addActionType = (type: string) => {
    setDefinition(d => {
      const next = { ...d, actions: [...d.actions, defaultAction(type)] };
      setSelected({ kind: 'action', index: next.actions.length - 1 });
      return next;
    });
  };

  /** Emit both `triggers[]` and legacy `trigger` (first) so the backend stays compatible. */
  const handleSave = () => onSave({ ...definition, trigger: (definition.triggers ?? [])[0] });

  // Switch the always-visible palette tab (and close any open node modal).
  const openPalette = (tab: 'triggers' | 'actions') => {
    setSelected(null);
    setPaletteTab(tab);
  };
  const addCondition = () => {
    setDefinition(d => ({ ...d, conditions: { operator: 'AND', rules: [] } }));
    setSelected({ kind: 'condition' });
  };

  // Palette → canvas drag & drop.
  const PALETTE_MIME = 'application/x-seentics-node';
  const onPaletteDragStart = (e: React.DragEvent, kind: 'trigger' | 'action', type: string) => {
    e.dataTransfer.setData(PALETTE_MIME, JSON.stringify({ kind, type }));
    e.dataTransfer.effectAllowed = 'copy';
  };
  const onCanvasDragOver = (e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes(PALETTE_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };
  const onCanvasDrop = (e: React.DragEvent) => {
    const raw = e.dataTransfer.getData(PALETTE_MIME);
    if (!raw) return;
    e.preventDefault();
    try {
      const { kind, type } = JSON.parse(raw) as { kind: 'trigger' | 'action'; type: string };
      if (kind === 'trigger') addTriggerType(type);
      else addActionType(type);
    } catch { /* ignore */ }
  };


  const handleDragStart = (i: number) => setDragSrc(i);
  const handleDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOver(i); };
  const handleDrop = (i: number) => {
    if (dragSrc === null || dragSrc === i) { setDragSrc(null); setDragOver(null); return; }
    const actions = [...definition.actions];
    const [moved] = actions.splice(dragSrc, 1);
    actions.splice(i, 0, moved!);
    setDefinition(d => ({ ...d, actions }));
    if (selected?.kind === 'action') {
      if (selected.index === dragSrc) setSelected({ kind: 'action', index: i });
      else if (selected.index === i) setSelected({ kind: 'action', index: dragSrc });
    }
    setDragSrc(null);
    setDragOver(null);
  };

  return (
    <div className={cn('flex h-full min-h-0 overflow-hidden', className)}>
      <style>{`@keyframes seenticsFlowDown { to { stroke-dashoffset: -20; } }`}</style>
      {/* Canvas */}
      <div
        ref={canvasRef}
        className="relative flex-1 cursor-grab overflow-hidden bg-muted/20 active:cursor-grabbing"
        style={{
          backgroundImage: 'radial-gradient(circle, hsl(var(--muted-foreground) / 0.15) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
        onMouseDown={onCanvasMouseDown}
        onMouseMove={onCanvasMouseMove}
        onMouseUp={onCanvasMouseUp}
        onMouseLeave={onCanvasMouseUp}
        onDragOver={onCanvasDragOver}
        onDrop={onCanvasDrop}
      >
        {/* Toolbar — stop mousedown propagation so canvas pan/select-null don't fire on toolbar clicks */}
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 rounded-lg border border-border bg-card/95 backdrop-blur px-2 py-1.5 shadow-2xl"
          onMouseDown={e => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setZoom(z => Math.min(2, z + 0.1))}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Zoom in (Ctrl+scroll)"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <span className="text-[11px] text-muted-foreground tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <div className="h-4 w-px bg-muted mx-1" />
          <button
            type="button"
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Fit to center"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <div className="h-4 w-px bg-muted mx-1" />
          <button
            type="button"
            onClick={() => setSelected({ kind: 'settings' })}
            className={cn('h-8 w-8 rounded-lg flex items-center justify-center transition-colors', selected?.kind === 'settings' ? 'text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}
            title="Workflow settings"
          >
            <Settings className="h-4 w-4" />
          </button>
          <div className="h-4 w-px bg-muted mx-1" />
          <button
            type="button"
            onClick={() => setShowJson(v => !v)}
            className={cn('h-8 w-8 rounded-lg flex items-center justify-center transition-colors', showJson ? 'text-violet-400 bg-violet-500/15' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}
            title="View / edit JSON config"
          >
            <Braces className="h-4 w-4" />
          </button>
          <div className="h-4 w-px bg-muted mx-1" />
          <Button
            size="sm"
            className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-foreground border-0 text-xs px-3"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>

        {/* Canvas content */}
        <div
          className="absolute inset-0 flex items-start justify-center pt-20 pb-12 overflow-auto"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center top',
          }}
        >
          <div className="flex flex-col items-center py-8" style={{ minHeight: '100%' }}>

            {!hasTrigger ? (
              <button
                type="button"
                data-node="true"
                onClick={() => openPalette('triggers')}
                className="group flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-border bg-card/60 px-10 py-9 text-center transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/[0.04]"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 transition-transform group-hover:scale-105">
                  <Zap className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Start with a trigger</p>
                  <p className="mt-1 max-w-[16rem] text-xs text-muted-foreground">
                    Every automation begins with a trigger. Drag one from the panel, or click below.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors group-hover:bg-emerald-500">
                  <Plus className="h-4 w-4" /> Add trigger
                </span>
              </button>
            ) : (
            <>
            {/* Trigger Nodes (any of them fires the automation) */}
            {triggers.map((trg, ti) => {
              const tdef = getTriggerType(trg.type);
              return (
                <React.Fragment key={ti}>
                  {ti > 0 && (
                    <div className="my-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      <span className="h-px w-6 bg-border" /> or <span className="h-px w-6 bg-border" />
                    </div>
                  )}
                  <NodeCard
                    strip="bg-emerald-500"
                    iconBg="bg-emerald-500/15"
                    iconColor="text-emerald-400"
                    icon={tdef.icon}
                    label={triggers.length > 1 ? `Trigger ${ti + 1}` : 'Trigger'}
                    title={tdef.label}
                    subtitle={trg.type === 'page_view' && trg.path ? String(trg.path) : tdef.description}
                    selected={selected?.kind === 'trigger' && selected.index === ti}
                    onClick={() => setSelected({ kind: 'trigger', index: ti })}
                    onDelete={triggers.length > 1 ? () => deleteTrigger(ti) : undefined}
                  />
                </React.Fragment>
              );
            })}

            {/* Add another trigger */}
            <button
              type="button"
              onClick={() => openPalette('triggers')}
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-dashed border-border bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-emerald-500/50 hover:text-emerald-600"
            >
              <Plus className="h-3 w-3" /> Add trigger
            </button>

            <NodeConnector onAdd={() => openPalette('actions')} />

            {/* Condition node */}
            {hasCondition && (
              <>
                <NodeCard
                  strip="bg-amber-500"
                  iconBg="bg-amber-500/15"
                  iconColor="text-amber-400"
                  icon={Filter}
                  label="Condition"
                  title="Filter Rules"
                  subtitle={`${definition.conditions!.rules.length} rule${definition.conditions!.rules.length !== 1 ? 's' : ''} · ${definition.conditions!.operator}`}
                  selected={selected?.kind === 'condition'}
                  onClick={() => setSelected({ kind: 'condition' })}
                  onDelete={deleteCondition}
                />
                <NodeConnector onAdd={() => openPalette('actions')} />
              </>
            )}

            {/* Action nodes */}
            {definition.actions.map((action, i) => {
              const at = getActionType(action.type);
              return (
                <React.Fragment key={i}>
                  <NodeCard
                    strip={at.strip}
                    iconBg={at.iconBg}
                    iconColor={at.iconColor}
                    icon={at.icon}
                    label={`Action ${definition.actions.length > 1 ? i + 1 : ''}`}
                    title={at.label}
                    subtitle={actionSummary(action)}
                    selected={selected?.kind === 'action' && selected.index === i}
                    onClick={() => setSelected({ kind: 'action', index: i })}
                    onDelete={() => deleteAction(i)}
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={e => handleDragOver(e, i)}
                    onDrop={() => handleDrop(i)}
                    dragIndicator={dragOver === i && dragSrc !== i}
                  />
                  <NodeConnector onAdd={() => openPalette('actions')} />
                </React.Fragment>
              );
            })}

            {/* Empty actions state */}
            {definition.actions.length === 0 && (
              <div
                data-node="true"
                className="w-64 rounded-lg border-2 border-dashed border-border bg-transparent flex flex-col items-center justify-center py-7 gap-2 cursor-pointer hover:border-violet-500/40 hover:bg-violet-500/5 transition-colors"
                onClick={() => openPalette('actions')}
              >
                <Layers className="h-6 w-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Click + to add an action</p>
              </div>
            )}

            </>
            )}

          </div>
        </div>

        {/* Node count badge */}
        <div className="absolute bottom-4 left-4 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{triggers.length + (hasCondition ? 1 : 0) + definition.actions.length} nodes</span>
          <span>·</span>
          <span>Drag canvas to pan · Ctrl+scroll to zoom</span>
        </div>
      </div>

      {/* Right sidebar — node palette (triggers & actions) */}
      <aside className="flex w-[280px] shrink-0 flex-col overflow-hidden border-l border-border/60 bg-card lg:w-[320px]">
        <NodePalette
          tab={paletteTab}
          onTab={setPaletteTab}
          onAddTrigger={addTriggerType}
          onAddAction={addActionType}
          onDragStart={onPaletteDragStart}
          onAddCondition={hasCondition ? undefined : addCondition}
        />
      </aside>

      {/* Node config modal — opens when a node is clicked */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="relative flex max-h-[86dvh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border/60 bg-card shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
              {(() => {
                const at = selected.kind === 'action' ? getActionType(definition.actions[selected.index]?.type ?? '') : null;
                const tdSel = selected.kind === 'trigger' ? getTriggerType(triggers[selected.index]?.type ?? '') : null;
                const meta =
                  selected.kind === 'trigger'
                    ? { icon: tdSel!.icon, color: 'text-emerald-500', bg: 'bg-emerald-500/10', title: tdSel!.label, sub: 'When this event happens…' }
                    : selected.kind === 'condition'
                      ? { icon: Filter, color: 'text-amber-500', bg: 'bg-amber-500/10', title: 'Conditions', sub: 'Rules that gate the automation' }
                      : selected.kind === 'action'
                        ? { icon: at!.icon, color: at!.iconColor, bg: at!.iconBg, title: at!.label, sub: 'What happens when it fires' }
                        : { icon: Settings, color: 'text-slate-500', bg: 'bg-slate-500/10', title: 'Workflow settings', sub: 'Priority & A/B testing' };
                const Icon = meta.icon;
                return (
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', meta.bg)}>
                      <Icon className={cn('h-5 w-5', meta.color)} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-foreground">{meta.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{meta.sub}</p>
                    </div>
                  </div>
                );
              })()}
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {selected.kind === 'trigger' && triggers[selected.index] && (
                <TriggerPanel
                  trigger={triggers[selected.index]!}
                  onChange={t => updateTrigger(selected.index, t)}
                  onDelete={triggers.length > 1 ? () => { deleteTrigger(selected.index); setSelected(null); } : undefined}
                  frequency={definition.frequency}
                  onFrequencyChange={f => setDefinition(d => ({ ...d, frequency: f }))}
                />
              )}
              {selected.kind === 'condition' && (
                <ConditionPanel conditions={definition.conditions} onChange={updateConditions} />
              )}
              {selected.kind === 'action' && definition.actions[selected.index] && (
                <ActionPanel
                  action={definition.actions[selected.index]!}
                  onChange={a => updateAction(selected.index, a)}
                  onDelete={() => { deleteAction(selected.index); setSelected(null); }}
                />
              )}
              {selected.kind === 'settings' && (
                <SettingsPanel
                  definition={definition}
                  onAbTestChange={ab => setDefinition(d => ({ ...d, abTest: ab }))}
                  onPriorityChange={p => setDefinition(d => ({ ...d, priority: p }))}
                />
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-border/60 bg-muted/20 p-3">
              <Button className="h-10 w-full font-semibold" onClick={() => setSelected(null)}>Done</Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* JSON editor modal */}
      {showJson && (
        <JsonEditorModal
          definition={definition}
          onApply={def => setDefinition(def)}
          onClose={() => setShowJson(false)}
        />
      )}
    </div>
  );
}
