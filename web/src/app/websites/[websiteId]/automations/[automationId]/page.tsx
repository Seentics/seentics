'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, Bot, Play, Pause, Trash2, TrendingUp, Pencil,
  CheckCircle2, XCircle, Activity, Zap, Webhook,
  MessageSquare, Bell, Megaphone, Highlighter, Info, Feather,
  ExternalLink, Tag, Eye, LogOut, Coffee, Flame, FileX,
  AlertTriangle, EyeOff, UserCheck, MousePointer2, ScrollText, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatCards } from '@/components/seentics-ui/StatCards';
import {
  useFetchAutomation, useToggleAutomation, useDeleteAutomation, useUpdateAutomation,
  useAutomationDailyStats,
} from '@/lib/automations-api';
import { AutomationBuilder, type AutomationDefinition } from '@/components/automations/AutomationBuilder';
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

  // Use the stored definition JSON directly — it contains the full state including conditions, frequency, abTest, priority
  const def = automation.definition ?? {};
  const rawDefinition: AutomationDefinition = {
    trigger:    (def.trigger as AutomationDefinition['trigger'] | undefined) ?? { type: automation.triggerType },
    conditions: (def.conditions as AutomationDefinition['conditions'] | undefined) ?? null,
    actions:    Array.isArray(def.actions)
      ? (def.actions as AutomationDefinition['actions'])
      : automation.actions.map(a => ({ type: a.actionType, ...a.actionConfig })),
    frequency:  (def.frequency as AutomationDefinition['frequency'] | undefined) ?? {},
    abTest:     (def.abTest as AutomationDefinition['abTest'] | undefined) ?? { enabled: false, variants: [] },
    priority:   typeof def.priority === 'number' ? def.priority : 50,
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
                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300'
                    : 'bg-muted text-muted-foreground border-border',
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
        <div className="flex items-center gap-2">
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
        <div className="rounded-xl border border-border overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>
          <AutomationBuilder
            key={`edit-${automationId}`}
            initialDefinition={rawDefinition}
            onSave={handleEditSave}
            isSaving={saving}
            className="h-full"
          />
        </div>
      ) : (
        <>
          <StatCards
            cards={[
              { label: 'Total Runs',   value: automation.stats?.totalExecutions ?? 0,  icon: Activity },
              { label: 'Success Rate', value: `${(automation.stats?.successRate ?? 0).toFixed(1)}%`, icon: CheckCircle2, iconColor: 'text-green-600', valueColor: 'text-green-600' },
              { label: 'Last 30 days', value: automation.stats?.last30Days ?? 0,        icon: TrendingUp },
              { label: 'Failures',     value: automation.stats?.failureCount ?? 0,      icon: XCircle, iconColor: 'text-red-500', valueColor: 'text-red-500' },
            ]}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart */}
            <Card className="lg:col-span-2 border border-border/60">
              <CardHeader className="px-5 py-4 border-b border-border/40">
                <CardTitle className="text-sm font-semibold">Run History (last 14 days)</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={runHistory} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="runs" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Config */}
            <Card className="border border-border/60">
              <CardHeader className="px-5 py-4 border-b border-border/40">
                <CardTitle className="text-sm font-semibold">Configuration</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex items-start justify-between px-5 py-3 border-b border-border/30">
                  <span className="text-xs text-muted-foreground">Trigger</span>
                  <div className="flex items-center gap-1.5 text-right">
                    <TriggerIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-xs font-medium">{TRIGGER_LABELS[automation.triggerType] ?? automation.triggerType}</span>
                  </div>
                </div>
                <div className="px-5 py-3 border-b border-border/30">
                  <span className="text-xs text-muted-foreground block mb-2">Actions</span>
                  <div className="flex flex-wrap gap-1.5">
                    {automation.actions.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : automation.actions.map((a, i) => {
                      const Icon = ACTION_ICONS[a.actionType] ?? Zap;
                      return (
                        <Badge key={i} variant="secondary" className="gap-1 text-[10px] h-5">
                          <Icon className="h-2.5 w-2.5" />
                          {ACTION_LABELS[a.actionType] ?? a.actionType}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-start justify-between px-5 py-3">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <span className="text-xs font-medium">{automation.isActive ? 'Active' : 'Paused'}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
