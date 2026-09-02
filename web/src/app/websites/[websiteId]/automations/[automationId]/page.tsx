'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ArrowDown, ArrowLeft, Bot, Play, Pause, Trash2, TrendingUp, Pencil,
  CheckCircle2, XCircle, Activity, Zap, Webhook,
  MessageSquare, Bell, Megaphone, Highlighter, Info, Feather,
  ExternalLink, Tag, Eye, LogOut, Coffee, Flame, FileX,
  AlertTriangle, EyeOff, UserCheck, MousePointer2, ScrollText, Clock,
  Settings,
  Braces,
  Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatCards } from '@/components/seentics-ui/StatCards';
import {
  useFetchAutomation, useToggleAutomation, useDeleteAutomation, useUpdateAutomation,
  useAutomationDailyStats,
} from '@/lib/automations-api';
import {
  AutomationBuilder,
  type AutomationBuilderHandle,
  type AutomationDefinition,
} from '@/components/automations/AutomationBuilder';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const TRIGGER_LABELS: Record<string, string> = {
  page_view:     'Page View',
  click:         'Element Click',
  scroll_depth:  'Scroll Depth',
  time_on_page:  'Time on Page',
  exit_intent:   'Exit Intent',
  inactivity:    'Inactivity',
  rage_click:    'Rage Click',
  form_abandon:  'Form Abandonment',
  js_error:      'JS Error',
  tab_hidden:    'Tab Hidden',
  tab_visible:   'Tab Visible',
  custom_event:  'Custom Event',
  identify:      'Identify',
  // legacy
  goal_reached:  'Goal Reached',
};

const TRIGGER_ICONS: Record<string, React.ElementType> = {
  page_view:     Eye,
  click:         MousePointer2,
  scroll_depth:  ScrollText,
  time_on_page:  Clock,
  exit_intent:   LogOut,
  inactivity:    Coffee,
  rage_click:    Flame,
  form_abandon:  FileX,
  js_error:      AlertTriangle,
  tab_hidden:    EyeOff,
  tab_visible:   Eye,
  custom_event:  Zap,
  identify:      UserCheck,
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  show_modal:          MessageSquare,
  show_toast:          Bell,
  show_banner:         Megaphone,
  highlight_element:   Highlighter,
  show_tooltip:        Info,
  personalize_content: Feather,
  redirect:            ExternalLink,
  tag_session:         Tag,
  webhook:             Webhook,
  // legacy
  email:  Zap,
  banner: Megaphone,
  modal:  MessageSquare,
  script: Zap,
};

const ACTION_LABELS: Record<string, string> = {
  show_modal:          'Show Modal',
  show_toast:          'Show Toast',
  show_banner:         'Show Banner',
  highlight_element:   'Highlight Element',
  show_tooltip:        'Show Tooltip',
  personalize_content: 'Personalize Content',
  redirect:            'Redirect',
  tag_session:         'Tag Session',
  webhook:             'Webhook',
};

export default function AutomationDetailPage() {
  const params        = useParams();
  const router        = useRouter();
  const websiteId     = params?.websiteId as string;
  const automationId  = params?.automationId as string;

  const [editMode, setEditMode] = useState(false);

  // In edit mode the header owns Save, so it tracks what the builder holds and whether
  // that is saveable. The builder stays uncontrolled; this is a report, not a source.
  const builderRef = useRef<AutomationBuilderHandle>(null);
  const [draft, setDraft] = useState<AutomationDefinition | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [editName, setEditName] = useState('');

  const { data: automation, isLoading }         = useFetchAutomation(websiteId, automationId);
  const { mutate: toggle, isPending: toggling } = useToggleAutomation();
  const { mutate: remove, isPending: deleting } = useDeleteAutomation();
  const { mutate: update, isPending: saving }   = useUpdateAutomation();
  const { data: dailyStatsData } = useAutomationDailyStats(websiteId, automationId);

  if (!automation && !isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-sm">Automation not found.</p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back
        </Button>
      </div>
    );
  }
  if (!automation) return null;

  const TriggerIcon = TRIGGER_ICONS[automation.triggerType] ?? Zap;
  const runHistory  = dailyStatsData ?? Array.from({ length: 14 }, (_, i) => ({ day: `D${i + 1}`, runs: 0 }));

  // The stored definition is used directly: it is the full state, including the step
  // chain, frequency caps, A/B configuration and priority.
  const def = automation.definition ?? {};
  const rawDefinition: AutomationDefinition = {
    triggers: Array.isArray(def.triggers)
      ? (def.triggers as AutomationDefinition['triggers'])
      : [{ type: automation.triggerType }],
    graph: (def.graph as AutomationDefinition['graph'] | undefined) ?? { entry: '', nodes: [], edges: [] },
    frequency: (def.frequency as AutomationDefinition['frequency'] | undefined) ?? {},
    abTest: (def.abTest as AutomationDefinition['abTest'] | undefined) ?? { enabled: false, variants: [] },
    priority: typeof def.priority === 'number' ? def.priority : 50,
  };

  const handleEditSave = (definition: AutomationDefinition) => {
    update(
      { websiteId, automationId, data: { name: editName || automation.name, definition: definition as unknown as Record<string, unknown> } },
      { onSuccess: () => setEditMode(false) },
    );
  };

  const handleToggle = () => toggle({ websiteId, automationId: automation.id });
  const handleDelete = () => {
    if (!confirm('Delete this automation?')) return;
    remove({ websiteId, automationId: automation.id }, {
      onSuccess: () => router.push(`/websites/${websiteId}/automations`),
    });
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => {
            if (editMode) setEditMode(false);
            else router.push(`/websites/${websiteId}/automations`);
          }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {editMode ? 'Cancel edit' : 'Back to Automations'}
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={cn(
            'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
            automation.isActive ? 'bg-primary/10' : 'bg-muted',
          )}>
            <TriggerIcon className={cn('h-5 w-5', automation.isActive ? 'text-primary' : 'text-muted-foreground')} />
          </div>
          <div>
            {editMode ? (
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="h-8 border-none bg-transparent px-0 text-xl font-bold shadow-none focus-visible:ring-0"
              />
            ) : (
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-xl font-bold text-foreground">{automation.name}</h1>
                <Badge className={cn(
                  'text-xs border',
                  automation.isActive
                    // Was bg-green-50/dark:bg-green-950 — an uneven pair that read
                    // as a different colour in each theme.
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'border-border bg-muted text-muted-foreground',
                )}>
                  {automation.isActive ? 'active' : 'paused'}
                </Badge>
              </div>
            )}
            {automation.description && !editMode && (
              <p className="text-sm text-muted-foreground">{automation.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {editMode && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => builderRef.current?.openSettings()}
                title="Workflow settings"
                aria-label="Workflow settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => builderRef.current?.openJson()}
                title="View or edit JSON"
                aria-label="View or edit JSON"
              >
                <Braces className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => draft && handleEditSave(draft)}
                disabled={!draft || errors.length > 0 || saving}
                title={errors[0] ?? 'Save automation'}
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </>
          )}

          {!editMode && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => { setEditName(automation.name); setEditMode(true); }}
              >
                <Pencil className="h-3.5 w-3.5" />Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={handleToggle}
                disabled={toggling}
              >
                {automation.isActive ? <><Pause className="h-3.5 w-3.5" />Pause</> : <><Play className="h-3.5 w-3.5" />Activate</>}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="h-3.5 w-3.5" />Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Edit mode — full-height builder */}
      {editMode ? (
        <div className="rounded-lg border border-border overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>
          <AutomationBuilder
            ref={builderRef}
            key={`edit-${automationId}`}
            initialDefinition={rawDefinition}
            onSave={handleEditSave}
            isSaving={saving}
            onChange={(def, errs) => { setDraft(def); setErrors(errs); }}
            className="h-full"
          />
        </div>
      ) : (
        <>
          <StatCards
            cards={[
              // Only failures keep a tone, and only when there are any. Four
              // coloured figures in a row read as four warnings, not one summary.
              { label: 'Total runs',   value: automation.stats?.totalExecutions ?? 0, icon: Activity },
              { label: 'Success rate', value: `${(automation.stats?.successRate ?? 0).toFixed(1)}%`, icon: CheckCircle2 },
              { label: 'Last 30 days', value: automation.stats?.last30Days ?? 0, icon: TrendingUp },
              { label: 'Failures',     value: automation.stats?.failureCount ?? 0, icon: XCircle, tone: 'danger', toneWhen: (automation.stats?.failureCount ?? 0) > 0 },
            ]}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart */}
            <Card className="lg:col-span-2 border border-border">
              <CardHeader className="px-5 py-4 border-b border-border">
                <CardTitle className="text-sm font-semibold">Run history</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Last 14 days</p>
              </CardHeader>
              <CardContent className="p-5">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={runHistory} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    {/* Softened: fourteen full-primary bars beside coloured stat
                        tiles left nothing quiet on the page. */}
                    <Bar dataKey="runs" fill="hsl(var(--primary) / 0.55)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/*
              What it does, as a flow.

              This card used to be a three-row table — Trigger, Actions, Status —
              which told you the parts but not the shape, and Status was already in
              the badge beside the title. Reading it top to bottom now matches the
              order the automation runs in, which is the thing you came to check.
            */}
            <Card className="border border-border">
              <CardHeader className="px-5 py-4 border-b border-border">
                <CardTitle className="text-sm font-semibold">What it does</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">In the order it runs</p>
              </CardHeader>
              <CardContent className="space-y-3 p-5">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    When
                  </p>
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <TriggerIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {TRIGGER_LABELS[automation.triggerType] ?? automation.triggerType}
                    </span>
                  </div>
                </div>

                <div className="flex justify-center">
                  <ArrowDown className="h-4 w-4 text-muted-foreground/40" aria-hidden />
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Then
                  </p>
                  {automation.actions.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                      No action yet — this automation will do nothing.
                    </p>
                  ) : (
                    <ol className="space-y-2">
                      {automation.actions.map((a, i) => {
                        const Icon = ACTION_ICONS[a.actionType] ?? Zap;
                        return (
                          <li
                            key={i}
                            className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2"
                          >
                            <span className="w-4 shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
                              {i + 1}
                            </span>
                            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 truncate text-sm font-medium text-foreground">
                              {ACTION_LABELS[a.actionType] ?? a.actionType}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>

                <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                  Branches and delays are not shown here — open{' '}
                  <span className="font-medium text-foreground">Edit</span> to see the full graph.
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
