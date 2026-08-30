'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
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
  Settings, ZoomIn, ZoomOut, Maximize2, X, Save, Filter,
  GripVertical, ChevronDown, ChevronRight, ListChecks, Braces, CheckCircle2, AlertCircle,
  GitBranch,
  Hourglass,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AutomationCanvas } from './canvas/AutomationCanvas';
import {
  MAX_DELAY_SECONDS,
  MAX_SWITCH_CASES,
  NODE_HEIGHT,
  NODE_WIDTH,
  connectNode,
  edgeFor,
  indexGraph,
  isBranchNode,
  layoutGraph,
  newNodeId,
  outletLabel,
  outletsFor,
  removeNode,
  validateGraph,
  type AutomationAction,
  type AutomationGraph,
  type ConditionGroup,
  type ConditionRule,
  type GraphNode,
  type NodeId,
  type SwitchCase,
} from '@/lib/automation-graph';

// ─── Exported Types ──────────────────────────────────────────────────────────

export interface TriggerConfig { type: string; [k: string]: unknown }

/**
 * The graph model lives in `@/lib/automation-graph` and is re-exported here.
 *
 * The builder is not its only consumer — the detail page reads a stored definition and
 * the templates page writes them — and a model that lives inside a component forces
 * everyone to import the component to touch it.
 */
export type {
  AutomationAction,
  AutomationGraph,
  ConditionGroup,
  ConditionRule,
  GraphEdge,
  GraphNode,
  GraphNodeKind,
  NodeId,
  SwitchCase,
} from '@/lib/automation-graph';

export {
  MAX_DELAY_SECONDS,
  MAX_SWITCH_CASES,
  layoutGraph,
  outletLabel,
  outletsFor,
  validateGraph,
} from '@/lib/automation-graph';

export interface AutomationDefinition {
  /** One or more triggers; the automation fires when ANY of them matches. */
  triggers: TriggerConfig[];
  /** The body, as a directed acyclic graph. */
  graph: AutomationGraph;
  frequency?: { maxPerSession?: number; maxPerUser?: number; cooldownDays?: number };
  abTest?: { enabled: boolean; variants: Array<{ id: string; weight: number }> };
  priority?: number;
}

/**
 * How often an automation may fire for one visitor, as a single choice.
 *
 * The server takes three independent caps — per session, per visitor, and a cooldown —
 * but the combinations anyone actually wants are these three, and exposing the raw
 * fields invited settings that contradict each other. Each mode maps to exactly one
 * cap shape, so the choice round-trips cleanly.
 */
export type FrequencyMode = 'every_trigger' | 'once_per_session' | 'once_every';

export const FREQUENCY_MODES: Array<{ value: FrequencyMode; label: string; hint: string }> = [
  {
    value: 'every_trigger',
    label: 'Every trigger',
    hint: 'Fires as often as the trigger happens. No limit.',
  },
  {
    value: 'once_per_session',
    label: 'Once per session',
    hint: 'Fires at most once per visit, however many times the trigger happens.',
  },
  {
    value: 'once_every',
    label: 'Once every…',
    hint: 'Fires once, then stays quiet for the visitor until the cooldown elapses.',
  },
];

/** The mode a stored cap set represents. A cooldown wins, being the stricter rule. */
export function frequencyMode(frequency: AutomationDefinition['frequency']): FrequencyMode {
  if (frequency?.cooldownDays && frequency.cooldownDays > 0) return 'once_every';
  if (frequency?.maxPerSession != null) return 'once_per_session';
  return 'every_trigger';
}

/** The caps a mode maps to. Only one cap is ever set, so the modes stay round-trippable. */
export function frequencyToCaps(
  mode: FrequencyMode,
  cooldownDays = 7,
): AutomationDefinition['frequency'] {
  if (mode === 'once_per_session') return { maxPerSession: 1 };
  if (mode === 'once_every') return { cooldownDays: Math.max(1, Math.min(365, cooldownDays || 1)) };
  return {};
}

/**
 * Everything wrong with a definition, as messages the canvas can show at once.
 *
 * The graph's own rules come from the shared validator, which mirrors the server's; this
 * adds only what the graph does not know about — that an automation needs a trigger.
 */
export function validateDefinition(def: AutomationDefinition): string[] {
  const errors: string[] = [];
  if (!def.triggers?.length) errors.push('Add at least one trigger.');
  return [...errors, ...validateGraph(def.graph)];
}

interface AutomationBuilderProps {
  initialDefinition?: AutomationDefinition;
  onSave: (definition: AutomationDefinition) => void;
  isSaving?: boolean;
  className?: string;
  /**
   * Reports the definition and everything wrong with it, on every edit.
   *
   * The Save button lives in the page's own header, not over the canvas — a toolbar
   * floating on top of the thing you are arranging is in the way of it. The page needs
   * the current definition and its errors to render that button, and this is how it
   * gets them without the builder becoming a controlled component.
   */
  onChange?: (definition: AutomationDefinition, errors: string[]) => void;
}

/**
 * What the page can ask the builder to do.
 *
 * Settings and the JSON editor are the builder's own modals, but their buttons belong in
 * the page header with Save — a bar floating over the canvas is in the way of the thing
 * it is floating over. A ref is how a parent triggers a child's behaviour; passing the
 * openers out through a callback would have React treating each one as a state updater.
 */
export type AutomationBuilderHandle = {
  openSettings: () => void;
  openJson: () => void;
};

/**
 * What the node editor is currently open on.
 *
 * `outlet` is set when the palette was opened from a specific branch, so whatever is
 * added next gets wired to it rather than appended somewhere arbitrary.
 */
type SelectedNode =
  | { kind: 'trigger'; index: number }
  | { kind: 'node'; id: NodeId }
  | { kind: 'settings' };

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * A trigger in the palette.
 *
 * `iconBg`/`iconColor` are per type, like the actions': thirteen rows in one green were
 * a wall to scan, and the icon is what people actually recognise. The *category* colour
 * still exists — a trigger node keeps its emerald edge on the canvas — so the type is
 * distinguishable without the node stopping looking like a trigger.
 */
type TriggerType = {
  value: string;
  label: string;
  icon: React.ElementType;
  description: string;
  hasConfig: boolean;
  iconBg: string;
  iconColor: string;
};

const TRIGGER_TYPES: TriggerType[] = [
  { value: 'page_view',    label: 'Page View',       icon: Globe,         description: 'Triggers when a user visits a specific page', hasConfig: true, iconBg: 'bg-sky-500/10', iconColor: 'text-sky-500' },
  { value: 'click',        label: 'Click',            icon: MousePointer,  description: 'Triggers when a user clicks an element',      hasConfig: true, iconBg: 'bg-indigo-500/10', iconColor: 'text-indigo-500' },
  { value: 'scroll_depth', label: 'Scroll Depth',     icon: TrendingDown,  description: 'Triggers when a user scrolls to a depth',     hasConfig: true, iconBg: 'bg-teal-500/10', iconColor: 'text-teal-500' },
  { value: 'time_on_page', label: 'Time on Page',     icon: Clock,         description: 'Triggers after a user spends time on page',   hasConfig: true, iconBg: 'bg-amber-500/10', iconColor: 'text-amber-500' },
  { value: 'exit_intent',  label: 'Exit Intent',      icon: LogOut,        description: 'Triggers when a user is about to leave',      hasConfig: false, iconBg: 'bg-rose-500/10', iconColor: 'text-rose-500' },
  { value: 'inactivity',   label: 'Inactivity',       icon: Coffee,        description: 'Triggers after a user is inactive',           hasConfig: true, iconBg: 'bg-orange-500/10', iconColor: 'text-orange-500' },
  { value: 'rage_click',   label: 'Rage Click',       icon: Zap,           description: 'Triggers on repeated rapid clicks',           hasConfig: false, iconBg: 'bg-red-500/10', iconColor: 'text-red-500' },
  { value: 'form_abandon', label: 'Form Abandonment', icon: AlertTriangle, description: 'Triggers when a form is abandoned',           hasConfig: false, iconBg: 'bg-yellow-500/10', iconColor: 'text-yellow-600' },
  { value: 'js_error',     label: 'JS Error',         icon: AlertTriangle, description: 'Triggers on a JavaScript error',              hasConfig: false, iconBg: 'bg-rose-600/10', iconColor: 'text-rose-600' },
  { value: 'tab_hidden',   label: 'Tab Hidden',       icon: EyeOff,        description: 'Triggers when the tab is hidden',             hasConfig: false, iconBg: 'bg-slate-500/10', iconColor: 'text-slate-500' },
  { value: 'tab_visible',  label: 'Tab Visible',      icon: Eye,           description: 'Triggers when the tab becomes visible again', hasConfig: false, iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500' },
  { value: 'custom_event', label: 'Custom Event',     icon: Zap,           description: 'Triggers on a named custom event',            hasConfig: true, iconBg: 'bg-violet-500/10', iconColor: 'text-violet-500' },
  { value: 'identify',     label: 'Identify',         icon: UserCheck,     description: 'Triggers when a user is identified',          hasConfig: false, iconBg: 'bg-fuchsia-500/10', iconColor: 'text-fuchsia-500' },
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

/** Card styling and title for a step, so the canvas can draw all three kinds uniformly. */
function nodeVisual(node: GraphNode): {
  strip: string; iconBg: string; iconColor: string; icon: React.ElementType; title: string;
} {
  if (node.kind === 'if') {
    return {
      strip: 'bg-amber-500', iconBg: 'bg-amber-500/15', iconColor: 'text-amber-400',
      icon: Filter, title: 'If / else',
    };
  }
  if (node.kind === 'switch') {
    return {
      strip: 'bg-fuchsia-500', iconBg: 'bg-fuchsia-500/15', iconColor: 'text-fuchsia-400',
      icon: GitBranch, title: 'Switch',
    };
  }
  if (node.kind === 'wait_until') {
    return {
      strip: 'bg-cyan-500', iconBg: 'bg-cyan-500/15', iconColor: 'text-cyan-400',
      icon: Hourglass, title: 'Wait until',
    };
  }
  if (node.kind === 'delay') {
    return {
      strip: 'bg-sky-500', iconBg: 'bg-sky-500/15', iconColor: 'text-sky-400',
      icon: Clock, title: 'Delay',
    };
  }
  const at = getActionType(node.action.type);
  return { strip: at.strip, iconBg: at.iconBg, iconColor: at.iconColor, icon: at.icon, title: at.label };
}

/** A one-line description of a node, for its canvas card. */
function nodeSummary(node: GraphNode): string {
  if (node.kind === 'delay') {
    return node.seconds === 1 ? 'Wait 1 second' : `Wait ${node.seconds} seconds`;
  }
  if (node.kind === 'wait_until') {
    const n = node.group.rules.length;
    return n === 0
      ? `No rules — waits the full ${node.timeoutSeconds}s`
      : `${n} rule${n === 1 ? '' : 's'} · up to ${node.timeoutSeconds}s`;
  }
  if (node.kind === 'if') {
    const n = node.group.rules.length;
    return n === 0
      ? 'No rules — always takes Yes'
      : `${n} rule${n === 1 ? '' : 's'} · ${node.group.operator}`;
  }
  if (node.kind === 'switch') {
    const n = node.cases.length;
    return `${n} case${n === 1 ? '' : 's'} + otherwise`;
  }
  return actionSummary(node.action);
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
  /** The day count to show while "once every" is selected; the default when switching to it. */
  const cooldownDays = frequency?.cooldownDays && frequency.cooldownDays > 0 ? frequency.cooldownDays : 7;
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
          <p className="mb-3 text-[11px] text-muted-foreground">
            How often this automation may fire for the same visitor.
          </p>

          {/*
            One choice, not three number fields.

            The three caps the server understands are not independent in practice — the
            combinations people actually want are "every time", "once a session" and
            "once every N days", and exposing the raw fields invited contradictory
            settings (a per-session cap of 3 alongside a 7-day cooldown) that are
            impossible to reason about. The select names the intent; the mapping to caps
            is {@link frequencyToCaps}.
          */}
          <Select value={frequencyMode(frequency)} onValueChange={v => onFrequencyChange(frequencyToCaps(v as FrequencyMode, cooldownDays))}>
            <SelectTrigger className={inp}><SelectValue /></SelectTrigger>
            <SelectContent>
              {FREQUENCY_MODES.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className="mt-2 text-[11px] text-muted-foreground">
            {FREQUENCY_MODES.find(m => m.value === frequencyMode(frequency))?.hint}
          </p>

          {frequencyMode(frequency) === 'once_every' && (
            <div className="mt-3 flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={365}
                value={String(cooldownDays)}
                onChange={e => onFrequencyChange(frequencyToCaps('once_every', Number(e.target.value)))}
                className={cn(inp, 'w-24')}
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          )}
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

/** A leaf rule, as opposed to a nested group. */
function isRule(node: ConditionRule | ConditionGroup): node is ConditionRule {
  return 'fact' in node;
}

function ConditionPanel({
  group, onChange, onDelete, deleteLabel = 'Delete node',
}: {
  group: ConditionGroup;
  onChange: (c: ConditionGroup) => void;
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  const rules = group.rules;
  const operator = group.operator;
  const inp = 'bg-muted border-border text-foreground placeholder:text-muted-foreground h-8 text-xs';

  // A condition is its own step now, so emptying its rules no longer deletes it — the
  // node stays on the canvas until it is deleted deliberately.
  const addRule = () => onChange({ operator, rules: [...rules, { fact: '', operator: 'equals', value: '' }] });
  const removeRule = (i: number) => onChange({ operator, rules: rules.filter((_, idx) => idx !== i) });
  const updateRule = (i: number, rule: ConditionRule) => onChange({ operator, rules: rules.map((r, idx) => idx === i ? rule : r) });

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
        {rules.map((rule, i) => !isRule(rule) ? (
          // Nested groups are preserved but not edited here — the inline editor is a
          // flat list, and silently dropping a group the JSON editor created would lose
          // configuration the engine happily evaluates.
          <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-muted/50 p-2.5">
            <span className="text-[11px] text-muted-foreground">
              Nested {rule.operator} group ({rule.rules.length} rules) — edit via JSON
            </span>
            <button type="button" onClick={() => removeRule(i)} className="text-muted-foreground hover:text-red-400">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
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
      {rules.length === 0 && (
        <p className="text-[11px] italic text-amber-600 dark:text-amber-400">
          No rules — this checkpoint passes for everyone and gates nothing.
        </p>
      )}

      {onDelete && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-8 gap-1.5 text-xs text-red-500 hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {deleteLabel}
        </Button>
      )}
    </div>
  );
}

function DelayPanel({
  seconds, onChange, onDelete,
}: { seconds: number; onChange: (s: number) => void; onDelete: () => void }) {
  const invalid = !Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_DELAY_SECONDS;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Wait for</p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={MAX_DELAY_SECONDS}
            value={String(seconds)}
            onChange={e => onChange(Number(e.target.value))}
            className="h-9 w-32 bg-muted border-border text-foreground"
          />
          <span className="text-sm text-muted-foreground">seconds</span>
        </div>
        {invalid && (
          <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
            Enter between 1 and {MAX_DELAY_SECONDS} seconds.
          </p>
        )}
      </div>

      {/*
        Stated plainly because it is the one surprising thing about a delay: evaluation
        happens in one request, so a delay schedules the visitor's browser, not the
        server. A webhook or condition placed after it still runs immediately.
      */}
      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          The visitor&apos;s browser waits this long before performing the next on-page
          action. Webhooks and conditions after this step still run immediately — the
          delay schedules what people see, not server-side work.
        </p>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="h-8 gap-1.5 text-xs text-red-500 hover:bg-red-500/10 hover:text-red-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete node
      </Button>
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

/**
 * The `if` editor: one condition group, two branches.
 *
 * The branches themselves are wired on the canvas, not here — a panel that also listed
 * "what happens next" would duplicate the graph in a worse form.
 */
function IfPanel({
  node, onChange, onDelete,
}: { node: Extract<GraphNode, { kind: 'if' }>; onChange: (n: GraphNode) => void; onDelete: () => void }) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Everything wired to <strong className="text-foreground">Yes</strong> runs when these
          rules pass; everything on <strong className="text-foreground">No</strong> runs when they
          do not. Both branches can rejoin later.
        </p>
      </div>
      <ConditionPanel
        group={node.group}
        onChange={g => onChange({ ...node, group: g })}
        onDelete={onDelete}
        deleteLabel="Delete node"
      />
    </div>
  );
}

/**
 * The `switch` editor: several named cases plus a fallback.
 *
 * Cases are matched in order, which the panel states outright — a set of guards whose
 * precedence you have to work out from the canvas is exactly what a switch is meant to
 * avoid.
 */
function SwitchPanel({
  node, onChange, onDelete,
}: { node: Extract<GraphNode, { kind: 'switch' }>; onChange: (n: GraphNode) => void; onDelete: () => void }) {
  const setCase = (i: number, patch: Partial<SwitchCase>) =>
    onChange({ ...node, cases: node.cases.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });

  const addCase = () =>
    onChange({
      ...node,
      cases: [
        ...node.cases,
        {
          id: `case_${Date.now().toString(36)}_${node.cases.length}`,
          label: `Case ${node.cases.length + 1}`,
          group: { operator: 'AND', rules: [] },
        },
      ],
    });

  const removeCase = (i: number) =>
    onChange({ ...node, cases: node.cases.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Cases are checked <strong className="text-foreground">in order</strong>. The first that
          matches wins, so put the most specific one first. If none match, the
          <strong className="text-foreground"> Otherwise</strong> branch runs.
        </p>
      </div>

      {node.cases.map((c, i) => (
        <div key={c.id} className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <Input
              value={c.label ?? ''}
              placeholder={`Case ${i + 1}`}
              onChange={e => setCase(i, { label: e.target.value })}
              className="h-8 flex-1 bg-muted text-xs"
            />
            {node.cases.length > 1 && (
              <button
                type="button"
                onClick={() => removeCase(i)}
                className="shrink-0 text-muted-foreground transition-colors hover:text-red-400"
                aria-label={`Remove case ${i + 1}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <ConditionPanel group={c.group} onChange={g => setCase(i, { group: g })} />
        </div>
      ))}

      {node.cases.length < MAX_SWITCH_CASES && (
        <Button
          variant="outline"
          size="sm"
          onClick={addCase}
          className="h-7 gap-1.5 border-border bg-muted text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          Add case
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="h-8 gap-1.5 text-xs text-red-500 hover:bg-red-500/10 hover:text-red-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete node
      </Button>
    </div>
  );
}

/**
 * The `wait_until` editor.
 *
 * The constraint it has to state plainly: the server has already answered the tracker by
 * the time this resolves, so the branches run in the browser and a webhook cannot go
 * after one. Saying it here is the difference between a considered design and a
 * surprising validation error.
 */
function WaitPanel({
  node, onChange, onDelete,
}: { node: Extract<GraphNode, { kind: 'wait_until' }>; onChange: (n: GraphNode) => void; onDelete: () => void }) {
  const invalid =
    !Number.isFinite(node.timeoutSeconds) || node.timeoutSeconds <= 0 || node.timeoutSeconds > MAX_DELAY_SECONDS;

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Give up after
        </p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={MAX_DELAY_SECONDS}
            value={String(node.timeoutSeconds)}
            onChange={e => onChange({ ...node, timeoutSeconds: Number(e.target.value) })}
            className="h-9 w-32 border-border bg-muted text-foreground"
          />
          <span className="text-sm text-muted-foreground">seconds</span>
        </div>
        {invalid && (
          <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
            Enter between 1 and {MAX_DELAY_SECONDS} seconds.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          The page watches these rules and takes <strong className="text-foreground">When true</strong> as
          soon as they pass, or <strong className="text-foreground">On timeout</strong> if they never do.
          Because the wait happens in the browser, a webhook cannot come after it — put
          any webhook before the wait.
        </p>
      </div>

      <ConditionPanel
        group={node.group}
        onChange={g => onChange({ ...node, group: g })}
        onDelete={onDelete}
        deleteLabel="Delete node"
      />
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
        // rounded-xl, not lg: these are full-height panels, and 8px reads square at
        // that size — the same rule the plan cards follow.
        className="relative flex max-h-[86dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
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
              className="group flex w-full items-center gap-4 rounded-lg border border-border bg-background p-5 text-left transition-all hover:-translate-y-0.5 hover:border-amber-500/40 hover:shadow-md"
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
                    className="group flex items-center gap-3.5 rounded-lg border border-border bg-background p-4 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
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
      if (!Array.isArray(parsed.triggers) || !parsed.graph) {
        setError('JSON must have a "triggers" array and a "graph" object.');
        return;
      }
      // Run the same checks the canvas does, so hand-edited JSON cannot smuggle in a
      // chain the save button would have refused.
      const problems = validateDefinition(parsed);
      if (problems.length) {
        setError(problems.join(' '));
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
      className="group flex cursor-grab select-none items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:cursor-grabbing"
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

/** The sidebar's tabs. Conditions is its own tab, not a footnote under Actions. */
export type PaletteTab = 'triggers' | 'conditions' | 'actions';

function NodePalette({
  tab, onTab, onAddTrigger, onAddAction, onDragStart, onClose,
  onAddCondition, onAddSwitch, onAddWait, onAddDelay,
}: {
  tab: PaletteTab;
  onTab: (t: PaletteTab) => void;
  onAddTrigger: (type: string) => void;
  onAddAction: (type: string) => void;
  onDragStart: (
    e: React.DragEvent,
    kind: 'trigger' | 'action' | 'condition' | 'delay' | 'switch' | 'wait',
    type: string,
  ) => void;
  onClose?: () => void;
  onAddCondition?: () => void;
  onAddSwitch?: () => void;
  onAddWait?: () => void;
  onAddDelay?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Add a node</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Drag onto the canvas to place it, then drag between handles to connect.
            </p>
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
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          {(['triggers', 'conditions', 'actions'] as const).map(t => (
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
        {tab === 'triggers' &&
          TRIGGER_TYPES.map(t => (
              <PaletteRow
                key={t.value}
                icon={t.icon}
                iconBg={t.iconBg}
                iconColor={t.iconColor}
                label={t.label}
                hint={t.description}
                onDragStart={e => onDragStart(e, 'trigger', t.value)}
                onClick={() => onAddTrigger(t.value)}
              />
            ))}

        {tab === 'actions' &&
          ACTION_TYPES.map(a => (
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

        {/*
          Conditions get their own tab rather than a footnote under Actions.

          They are first-class steps in the chain — an automation can have several,
          anywhere — so burying them under the action list understated them and made a
          second one hard to find. Delay sits here too: it is flow control, not
          something the visitor sees.
        */}
        {/*
          Conditions get their own tab rather than a footnote under Actions.

          They are first-class nodes — an automation can have several, anywhere, and each
          one splits the flow — so burying them under the action list understated them.
          Delay sits here too: it is flow control, not something the visitor sees.
        */}
        {tab === 'conditions' && (
          <>
            {onAddCondition && (
              <PaletteRow
                icon={Filter}
                iconBg="bg-amber-500/10"
                iconColor="text-amber-500"
                label="If / else"
                hint="Split the flow on a set of rules"
                onDragStart={e => onDragStart(e, 'condition', 'if')}
                onClick={onAddCondition}
              />
            )}

            {onAddSwitch && (
              <PaletteRow
                icon={GitBranch}
                iconBg="bg-fuchsia-500/10"
                iconColor="text-fuchsia-500"
                label="Switch"
                hint="Several cases, first match wins"
                onDragStart={e => onDragStart(e, 'switch', 'switch')}
                onClick={onAddSwitch}
              />
            )}

            {onAddWait && (
              <PaletteRow
                icon={Hourglass}
                iconBg="bg-cyan-500/10"
                iconColor="text-cyan-500"
                label="Wait until"
                hint="Hold until rules pass, or time out"
                onDragStart={e => onDragStart(e, 'wait', 'wait_until')}
                onClick={onAddWait}
              />
            )}

            {onAddDelay && (
              <PaletteRow
                icon={Clock}
                iconBg="bg-sky-500/10"
                iconColor="text-sky-500"
                label="Delay"
                hint="Pause before the next on-page action"
                onDragStart={e => onDragStart(e, 'delay', 'delay')}
                onClick={onAddDelay}
              />
            )}

            <p className="px-1 pt-2 text-[11px] leading-relaxed text-muted-foreground">
              Branches can rejoin: point two of them at the same node and it runs once,
              whichever way the visitor got there.
            </p>
          </>
        )}

      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const DEFAULT_DEFINITION: AutomationDefinition = {
  triggers: [],
  graph: { entry: '', nodes: [], edges: [] },
  frequency: {},
  abTest: { enabled: false, variants: [] },
  priority: 50,
};

/** A fresh node of each kind, as the palette adds them. */
function newNode(kind: GraphNode['kind'], actionType?: string): GraphNode {
  const id = newNodeId(kind);
  switch (kind) {
    case 'if':
      return { id, kind: 'if', group: { operator: 'AND', rules: [] } };
    case 'switch':
      return {
        id,
        kind: 'switch',
        cases: [{ id: `case_${Date.now().toString(36)}`, label: 'Case 1', group: { operator: 'AND', rules: [] } }],
      };
    case 'wait_until':
      return { id, kind: 'wait_until', group: { operator: 'AND', rules: [] }, timeoutSeconds: 30 };
    case 'delay':
      return { id, kind: 'delay', seconds: 5 };
    default:
      return { id, kind: 'action', action: defaultAction(actionType ?? 'show_modal') };
  }
}

export const AutomationBuilder = forwardRef<AutomationBuilderHandle, AutomationBuilderProps>(
  function AutomationBuilder({ initialDefinition, onSave, isSaving, className, onChange }, ref) {
  const [definition, setDefinition] = useState<AutomationDefinition>(() => {
    const base = initialDefinition ?? DEFAULT_DEFINITION;
    return {
      ...base,
      triggers: base.triggers ?? [],
      graph: base.graph ?? { entry: '', nodes: [], edges: [] },
    };
  });
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [paletteTab, setPaletteTab] = useState<PaletteTab>('triggers');

  const [showJson, setShowJson] = useState(false);
  /** Where the next node from the palette attaches. Set by an outlet's "+". */

  const graph = definition.graph;
  const triggers = definition.triggers ?? [];
  const hasTrigger = triggers.length > 0;
  const errors = validateDefinition(definition);

  // Recomputed only when the graph changes: layout walks every node and edge twice, and
  // the canvas re-renders on pan, zoom and selection as well.
  const layout = useMemo(() => layoutGraph(graph), [graph]);
  const { outgoing } = useMemo(() => indexGraph(graph), [graph]);

  /** Nodes the validator complained about, so the canvas can mark them. */
  const invalidNodes = useMemo(() => {
    const ids = new Set<NodeId>();
    for (const node of graph.nodes) {
      const outlets = outletsFor(node);
      if (outlets && outlets.some(o => !edgeFor(outgoing, node.id, o))) ids.add(node.id);
    }
    return ids;
  }, [graph, outgoing]);

  const setGraph = useCallback(
    (g: AutomationGraph) => setDefinition(d => ({ ...d, graph: g })),
    [],
  );

  const triggerMeta = useCallback((type: string) => {
    const td = getTriggerType(type);
    return {
      label: td.label,
      description: td.description,
      icon: td.icon,
      iconBg: td.iconBg,
      iconColor: td.iconColor,
    };
  }, []);

  const selectTrigger = useCallback((index: number) => setSelected({ kind: 'trigger', index }), []);
  const selectNode = useCallback((id: NodeId) => setSelected({ kind: 'node', id }), []);

  // ── Triggers ──────────────────────────────────────────────────────────────

  const updateTrigger = (index: number, t: TriggerConfig) =>
    setDefinition(d => ({ ...d, triggers: d.triggers.map((x, i) => (i === index ? t : x)) }));

  const deleteTrigger = useCallback((index: number) => {
    setDefinition(d => ({ ...d, triggers: d.triggers.filter((_, i) => i !== index) }));
    setSelected(sel => (sel?.kind === 'trigger' && sel.index === index ? null : sel));
  }, []);

  // Adding never opens the editor: placing a node and configuring it are separate
  // intents, and a modal per drop would interrupt building the shape of the graph.
  const addTriggerType = (type: string) =>
    setDefinition(d => ({ ...d, triggers: [...d.triggers, { type } as TriggerConfig] }));

  // ── Graph editing ─────────────────────────────────────────────────────────

  const updateNode = (node: GraphNode) =>
    setDefinition(d => {
      const nodes = d.graph.nodes.map(n => (n.id === node.id ? node : n));

      // Editing can remove an outlet — dropping a switch case is the case that matters.
      // The edge on that outlet would then name a branch the node no longer has, and
      // fail validation with a complaint about a branch the user just deleted.
      const outlets = outletsFor(node);
      const edges = d.graph.edges.filter(e => {
        if (e.from !== node.id) return true;
        if (outlets === null) return e.branch === undefined;
        return e.branch !== undefined && outlets.includes(e.branch);
      });

      return { ...d, graph: { ...d.graph, nodes, edges } };
    });

  const deleteNode = useCallback((id: NodeId) => {
    setDefinition(d => ({ ...d, graph: removeNode(d.graph, id) }));
    setSelected(sel => (sel?.kind === 'node' && sel.id === id ? null : sel));
  }, []);

  /**
   * Add a node.
   *
   * Unwired on purpose. Connections are made by dragging from the outlet you mean to the
   * node you mean, so guessing an attachment point here would produce an edge the user
   * did not ask for and then have to find and delete. An unconnected node is visibly
   * unfinished, which is the honest state of a node nobody has wired yet.
   */
  const addNode = (kind: GraphNode['kind'], actionType?: string, position?: { x: number; y: number }) => {
    setDefinition(d => {
      const node = { ...newNode(kind, actionType), ...(position ? { position } : {}) };
      const nodes = [...d.graph.nodes, node];
      // The first node is also the entry; there is nothing else it could be.
      const entry = d.graph.entry || node.id;
      return { ...d, graph: { ...d.graph, nodes, entry } };
    });
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = () => {
    if (errors.length) return;
    onSave(definition);
  };

  /**
   * Report the definition to the page, which renders Save from it.
   *
   * The callback is held in a ref and deliberately kept out of the effect's
   * dependencies. Every caller passes an inline arrow — `onChange={(d, e) => …}` is the
   * obvious way to write it — which is a new function identity on every render. With
   * `onChange` as a dependency, the page setting state from it re-rendered the page,
   * produced a new identity, re-ran the effect, and the loop only stopped when React
   * gave up with "Maximum update depth exceeded".
   *
   * Keeping the latest callback in a ref makes the component immune to that, rather
   * than making every caller remember to `useCallback`.
   */
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    onChangeRef.current?.(definition, validateDefinition(definition));
  }, [definition]);

  useImperativeHandle(
    ref,
    () => ({
      openSettings: () => setSelected({ kind: 'settings' }),
      openJson: () => setShowJson(true),
    }),
    [],
  );

  const openPalette = (tab: PaletteTab) => {
    setSelected(null);
    setPaletteTab(tab);
  };

  // ── Palette drag & drop ───────────────────────────────────────────────────

  const PALETTE_MIME = 'application/x-seentics-node';
  type PaletteKind = 'trigger' | 'action' | 'condition' | 'delay' | 'switch' | 'wait';

  const onPaletteDragStart = (e: React.DragEvent, kind: PaletteKind, type: string) => {
    e.dataTransfer.setData(PALETTE_MIME, JSON.stringify({ kind, type }));
    e.dataTransfer.effectAllowed = 'copy';
  };
  const onCanvasDragOver = (e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes(PALETTE_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };
  const handlePaletteDrop = (
    payload: { kind: string; type: string },
    position: { x: number; y: number },
  ) => {
    const { kind, type } = payload;
    if (kind === 'trigger') addTriggerType(type);
    else if (kind === 'condition') addNode('if', undefined, position);
    else if (kind === 'switch') addNode('switch', undefined, position);
    else if (kind === 'wait') addNode('wait_until', undefined, position);
    else if (kind === 'delay') addNode('delay', undefined, position);
    else addNode('action', type, position);
  };

  const emptyHint = !hasTrigger
    ? 'Drag a trigger from the panel to start.'
    : graph.nodes.length === 0
      ? 'Drag an action, condition or delay from the panel.'
      : null;

  const selectedNode =
    selected?.kind === 'node' ? graph.nodes.find(n => n.id === selected.id) : undefined;

  return (
    <div className={cn('flex h-full min-h-0 overflow-hidden', className)}>
      {/* Canvas */}
      <div className="relative min-h-0 flex-1">
        <AutomationCanvas
          graph={graph}
          onGraphChange={setGraph}
          triggers={triggers}
          triggerMeta={triggerMeta}
          onDeleteTrigger={deleteTrigger}
          onSelectTrigger={selectTrigger}
          nodeVisual={nodeVisual}
          nodeSummary={nodeSummary}
          invalidNodes={invalidNodes}
          onSelectNode={selectNode}
          onDeleteNode={deleteNode}
          onPaletteDrop={handlePaletteDrop}
          paletteMime={PALETTE_MIME}
        />

        {/*
          An empty canvas looks the same as a broken one, so it gets a hint — but only a
          hint. This used to *replace* the canvas before the first trigger existed, which
          removed the very drop target the hint tells you to drag onto: the first trigger
          could only be added by clicking. Always mount the canvas; overlay the text, and
          keep it pointer-events-none so it never eats a drag.
        */}
        {emptyHint && (
          <div
            className={cn(
              'pointer-events-none absolute inset-x-0 flex justify-center',
              // Dead centre while the canvas is genuinely blank. Once a trigger is on it,
              // centring leaves the text floating in open space beside the node instead of
              // reading as guidance, so it drops to the bottom edge and behaves as a status
              // line. Bottom-*centre* specifically: ReactFlow's zoom controls own bottom-left.
              hasTrigger ? 'bottom-6' : 'inset-y-0 items-center',
            )}
          >
            <p className="rounded-lg bg-background/80 px-3 py-1.5 text-sm text-muted-foreground backdrop-blur-sm">
              {emptyHint}
            </p>
          </div>
        )}

        {/*
          Why the save is disabled, next to the canvas rather than over it. Anchored
          bottom-right so it clears ReactFlow's zoom controls at bottom-left.
        */}
        {errors.length > 0 && hasTrigger && (
          <div
            role="alert"
            className="pointer-events-none absolute bottom-4 right-4 max-w-sm rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 shadow-lg dark:text-amber-300"
          >
            <p className="font-semibold">Not ready to save</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {errors.map(e => <li key={e}>{e}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Right sidebar — node palette */}
      <aside className="flex w-[320px] shrink-0 flex-col overflow-hidden border-l border-border bg-card lg:w-[380px] xl:w-[420px]">
        <NodePalette
          tab={paletteTab}
          onTab={setPaletteTab}
          onAddTrigger={addTriggerType}
          onAddAction={type => addNode('action', type)}
          onAddCondition={() => addNode('if')}
          onAddSwitch={() => addNode('switch')}
          onAddWait={() => addNode('wait_until')}
          onAddDelay={() => addNode('delay')}
          onDragStart={onPaletteDragStart}
        />
      </aside>

      {/* Node editor */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            role="dialog"
            aria-modal="true"
            aria-label="Node settings"
            className="relative flex max-h-[86dvh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
              {(() => {
                const nv = selectedNode ? nodeVisual(selectedNode) : null;
                const tdSel = selected.kind === 'trigger' ? getTriggerType(triggers[selected.index]?.type ?? '') : null;
                const sub =
                  selectedNode?.kind === 'if' ? 'Branches on whether these rules pass'
                  : selectedNode?.kind === 'switch' ? 'Takes the first matching case'
                  : selectedNode?.kind === 'wait_until' ? 'Holds until the rules pass, or times out'
                  : selectedNode?.kind === 'delay' ? 'Holds the next on-page action back'
                  : 'What happens when it fires';
                const meta =
                  selected.kind === 'trigger'
                    ? { icon: tdSel!.icon, color: 'text-emerald-500', bg: 'bg-emerald-500/10', title: tdSel!.label, sub: 'When this event happens…' }
                    : selected.kind === 'node' && nv
                      ? { icon: nv.icon, color: nv.iconColor, bg: nv.iconBg, title: nv.title, sub }
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

              {selectedNode?.kind === 'if' && (
                <IfPanel node={selectedNode} onChange={updateNode} onDelete={() => deleteNode(selectedNode.id)} />
              )}
              {selectedNode?.kind === 'switch' && (
                <SwitchPanel node={selectedNode} onChange={updateNode} onDelete={() => deleteNode(selectedNode.id)} />
              )}
              {selectedNode?.kind === 'wait_until' && (
                <WaitPanel node={selectedNode} onChange={updateNode} onDelete={() => deleteNode(selectedNode.id)} />
              )}
              {selectedNode?.kind === 'delay' && (
                <DelayPanel
                  seconds={selectedNode.seconds}
                  onChange={sec => updateNode({ ...selectedNode, seconds: sec })}
                  onDelete={() => deleteNode(selectedNode.id)}
                />
              )}
              {selectedNode?.kind === 'action' && (
                <ActionPanel
                  action={selectedNode.action}
                  onChange={a => updateNode({ ...selectedNode, action: a })}
                  onDelete={() => deleteNode(selectedNode.id)}
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

            <div className="shrink-0 border-t border-border bg-muted/20 p-3">
              <Button className="h-10 w-full font-semibold" onClick={() => setSelected(null)}>Done</Button>
            </div>
          </motion.div>
        </div>
      )}

      {showJson && (
        <JsonEditorModal
          definition={definition}
          onApply={def => setDefinition(def)}
          onClose={() => setShowJson(false)}
        />
      )}
    </div>
  );
},
);
