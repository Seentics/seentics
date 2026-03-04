'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bell,
  Plus,
  Trash2,
  Loader2,
  TrendingUp,
  TrendingDown,
  Gauge,
  Activity,
  Clock,
  Mail,
  BellRing,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  alertsAPI,
  type AlertRule,
  type AlertEvent,
  type ConditionType,
  type Channel,
} from '@/lib/alerts-api';
import { cn } from '@/lib/utils';

const CONDITION_OPTIONS: { value: ConditionType; label: string; description: string; icon: React.ElementType }[] = [
  { value: 'traffic_spike', label: 'Traffic Spike', description: 'Alert when traffic increases above threshold', icon: TrendingUp },
  { value: 'traffic_drop', label: 'Traffic Drop', description: 'Alert when traffic drops below threshold', icon: TrendingDown },
  { value: 'usage_limit', label: 'Usage Limit', description: 'Alert when plan usage approaches limit', icon: Gauge },
  { value: 'anomaly', label: 'Anomaly Detection', description: 'Alert on unusual traffic patterns', icon: Activity },
];

const TIME_WINDOWS = [
  { value: '1h', label: '1 Hour' },
  { value: '6h', label: '6 Hours' },
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
];

export function AlertsSettingsComponent() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [view, setView] = useState<'rules' | 'history'>('rules');

  // Create form state
  const [formName, setFormName] = useState('');
  const [formCondition, setFormCondition] = useState<ConditionType>('traffic_spike');
  const [formThreshold, setFormThreshold] = useState('50');
  const [formTimeWindow, setFormTimeWindow] = useState('1h');
  const [formChannels, setFormChannels] = useState<Channel[]>(['in_app']);
  const [formCooldown, setFormCooldown] = useState('60');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rulesData, eventsData] = await Promise.all([
        alertsAPI.listRules(),
        alertsAPI.listEvents(20),
      ]);
      setRules(rulesData);
      setEvents(eventsData);
    } catch {
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error('Please enter a name');
      return;
    }
    const threshold = parseFloat(formThreshold);
    if (isNaN(threshold) || threshold <= 0) {
      toast.error('Threshold must be a positive number');
      return;
    }
    try {
      setCreating(true);
      const rule = await alertsAPI.createRule({
        name: formName.trim(),
        conditionType: formCondition,
        threshold,
        timeWindow: formTimeWindow,
        channels: formChannels,
        cooldownMinutes: parseInt(formCooldown) || 60,
      });
      setRules((prev) => [rule, ...prev]);
      setShowCreate(false);
      resetForm();
      toast.success('Alert rule created');
    } catch {
      toast.error('Failed to create alert rule');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await alertsAPI.toggleRule(id, enabled);
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
    } catch {
      toast.error('Failed to toggle alert');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this alert rule? This cannot be undone.')) return;
    try {
      setDeleting(id);
      await alertsAPI.deleteRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast.success('Alert rule deleted');
    } catch {
      toast.error('Failed to delete alert rule');
    } finally {
      setDeleting(null);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormCondition('traffic_spike');
    setFormThreshold('50');
    setFormTimeWindow('1h');
    setFormChannels(['in_app']);
    setFormCooldown('60');
  };

  const toggleChannel = (ch: Channel) => {
    setFormChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const getConditionIcon = (type: ConditionType) => {
    const opt = CONDITION_OPTIONS.find((o) => o.value === type);
    return opt?.icon || Activity;
  };

  const getConditionLabel = (type: ConditionType) => {
    return CONDITION_OPTIONS.find((o) => o.value === type)?.label || type;
  };

  const getThresholdLabel = (type: ConditionType, threshold: number) => {
    switch (type) {
      case 'traffic_spike': return `+${threshold}% increase`;
      case 'traffic_drop': return `-${threshold}% decrease`;
      case 'usage_limit': return `${threshold}% of limit`;
      case 'anomaly': return `${threshold}% deviation`;
      default: return `${threshold}%`;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Alerts</h3>
          <p className="text-sm text-muted-foreground">
            Get notified about traffic changes, usage limits, and anomalies.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setView('rules')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                view === 'rules' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Rules
            </button>
            <button
              onClick={() => setView('history')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                view === 'history' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              History
            </button>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New Alert
          </Button>
        </div>
      </div>

      {view === 'rules' ? (
        <>
          {rules.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <Bell className="h-6 w-6 text-muted-foreground" />
                </div>
                <h4 className="text-sm font-medium mb-1">No alert rules yet</h4>
                <p className="text-xs text-muted-foreground max-w-sm mb-4">
                  Create alert rules to get notified about traffic changes, usage limits, and anomalies.
                </p>
                <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Create Your First Alert
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => {
                const Icon = getConditionIcon(rule.conditionType);
                return (
                  <Card key={rule.id} className="border-border/60">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn(
                            'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
                            rule.enabled ? 'bg-primary/5' : 'bg-muted/50'
                          )}>
                            <Icon className={cn('h-4 w-4', rule.enabled ? 'text-primary' : 'text-muted-foreground')} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={cn('text-sm font-medium truncate', !rule.enabled && 'text-muted-foreground')}>{rule.name}</p>
                              {!rule.enabled && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Paused</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{getConditionLabel(rule.conditionType)}</span>
                              <span>{getThresholdLabel(rule.conditionType, rule.threshold)}</span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {TIME_WINDOWS.find((w) => w.value === rule.timeWindow)?.label || rule.timeWindow}
                              </span>
                              <span className="flex items-center gap-1">
                                {rule.channels.includes('email') && <Mail className="h-3 w-3" />}
                                {rule.channels.includes('in_app') && <BellRing className="h-3 w-3" />}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={(checked) => handleToggle(rule.id, checked)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-500"
                            onClick={() => handleDelete(rule.id)}
                            disabled={deleting === rule.id}
                          >
                            {deleting === rule.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Alert History */
        <>
          {events.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <History className="h-6 w-6 text-muted-foreground" />
                </div>
                <h4 className="text-sm font-medium mb-1">No alert history</h4>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Alert events will appear here when your rules are triggered.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <Card key={event.id} className="border-border/60">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <BellRing className="h-4 w-4 text-amber-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{event.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(event.createdAt)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Alert Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Alert Rule</DialogTitle>
            <DialogDescription>
              Set up a new alert to monitor your analytics.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Traffic drop alert"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Condition</Label>
              <Select value={formCondition} onValueChange={(v) => setFormCondition(v as ConditionType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <opt.icon className="h-3.5 w-3.5" />
                        <span>{opt.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {CONDITION_OPTIONS.find((o) => o.value === formCondition)?.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Threshold (%)</Label>
                <Input
                  type="number"
                  min="1"
                  max="1000"
                  value={formThreshold}
                  onChange={(e) => setFormThreshold(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Time Window</Label>
                <Select value={formTimeWindow} onValueChange={setFormTimeWindow}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_WINDOWS.map((w) => (
                      <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notification Channels</Label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => toggleChannel('in_app')}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors',
                    formChannels.includes('in_app')
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  )}
                >
                  <BellRing className="h-4 w-4" />
                  In-App
                </button>
                <button
                  type="button"
                  onClick={() => toggleChannel('email')}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors',
                    formChannels.includes('email')
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  )}
                >
                  <Mail className="h-4 w-4" />
                  Email
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cooldown (minutes)</Label>
              <Input
                type="number"
                min="5"
                max="1440"
                value={formCooldown}
                onChange={(e) => setFormCooldown(e.target.value)}
                placeholder="60"
              />
              <p className="text-xs text-muted-foreground">
                Minimum time between repeated alerts for the same rule.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !formName.trim()} className="gap-1.5">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
              Create Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
