'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft, Bot, Play, Pause, Trash2, TrendingUp,
  CheckCircle2, XCircle, Zap, Mail, Webhook, Bell,
  MousePointer, MessageSquare, Eye, Code2, Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatCards } from '@/components/seentics-ui/StatCards';
import {
  useAutomations,
  useToggleAutomation,
  useDeleteAutomation,
} from '@/lib/automations-api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const TRIGGER_LABELS: Record<string, string> = {
  custom_event:  'Custom Event',
  page_view:     'Page View',
  exit_intent:   'Exit Intent',
  inactivity:    'Inactivity',
  error_rate:    'Error Rate Spike',
  traffic_spike: 'Traffic Spike',
  goal_reached:  'Goal Reached',
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  email:        Mail,
  webhook:      Webhook,
  banner:       Bell,
  modal:        MessageSquare,
  notification: Bell,
  redirect:     MousePointer,
  hide_element: Eye,
  script:       Code2,
};

function demoRunHistory(totalRuns: number) {
  return Array.from({ length: 14 }, (_, i) => ({
    day: `D${i + 1}`,
    runs: Math.max(0, Math.floor((totalRuns / 14) * (0.6 + Math.random() * 0.8))),
  }));
}

export default function AutomationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const websiteId = params?.websiteId as string;
  const automationId = params?.automationId as string;

  const { data, isLoading } = useAutomations(websiteId);
  const { mutate: toggle, isPending: toggling } = useToggleAutomation();
  const { mutate: remove, isPending: deleting } = useDeleteAutomation();

  const automation = (data?.automations ?? []).find(a => a.id === automationId);

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

  const ActionIcon = ACTION_ICONS[automation.actions[0]?.actionType] ?? Zap;
  const runHistory = demoRunHistory(automation.stats?.totalExecutions ?? 0);

  const handleToggle = () => toggle({ websiteId, automationId: automation.id });
  const handleDelete = () => {
    if (!confirm('Delete this automation?')) return;
    remove({ websiteId, automationId: automation.id });
    router.push(`/websites/${websiteId}/automations`);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => router.push(`/websites/${websiteId}/automations`)}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Automations
        </Button>
      </div>

      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={cn(
            'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
            automation.isActive ? 'bg-primary/10' : 'bg-muted',
          )}>
            <ActionIcon className={cn('h-5 w-5', automation.isActive ? 'text-primary' : 'text-muted-foreground')} />
          </div>
          <div>
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
            {automation.description && (
              <p className="text-sm text-muted-foreground">{automation.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
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
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Stats */}
      <StatCards
        cards={[
          {
            label: 'Total Runs',
            value: automation.stats?.totalExecutions ?? 0,
            icon: Activity
          },
          {
            label: 'Success Rate',
            value: `${(automation.stats?.successRate ?? 0).toFixed(1)}%`,
            icon: CheckCircle2,
            iconColor: 'text-green-600',
            valueColor: 'text-green-600'
          },
          {
            label: 'Last 30 days',
            value: automation.stats?.last30Days ?? 0,
            icon: TrendingUp
          },
          {
            label: 'Failures',
            value: Math.floor((automation.stats?.totalExecutions ?? 0) * (1 - (automation.stats?.successRate ?? 100) / 100)),
            icon: XCircle,
            iconColor: 'text-red-500',
            valueColor: 'text-red-500'
          },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Run history chart */}
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
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                />
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
            {[
              { label: 'Trigger', value: TRIGGER_LABELS[automation.triggerType] ?? automation.triggerType },
              { label: 'Actions', value: automation.actions.map(a => a.actionType).join(', ') || '—' },
              { label: 'Status',  value: automation.isActive ? 'Active' : 'Paused' },
            ].map(item => (
              <div key={item.label} className="flex items-start justify-between px-5 py-3 border-b border-border/30 last:border-0">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="text-xs font-medium text-foreground text-right max-w-[60%]">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
