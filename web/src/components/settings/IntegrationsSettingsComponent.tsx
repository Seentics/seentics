'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
  Plus,
  Trash2,
  Loader2,
  Send,
  Plug,
  MessageSquare,
  Hash,
  Users,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  integrationsAPI,
  type Integration,
  type IntegrationProvider,
  type CreateIntegrationRequest,
  INTEGRATION_EVENTS,
} from '@/lib/integrations-api';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const PROVIDERS: { value: IntegrationProvider; label: string; icon: React.ReactNode; color: string; placeholder: string }[] = [
  { value: 'slack', label: 'Slack', icon: <Hash className="h-5 w-5" />, color: 'text-[#4A154B]', placeholder: 'https://hooks.slack.com/services/...' },
  { value: 'discord', label: 'Discord', icon: <MessageSquare className="h-5 w-5" />, color: 'text-[#5865F2]', placeholder: 'https://discord.com/api/webhooks/...' },
  { value: 'teams', label: 'Teams', icon: <Users className="h-5 w-5" />, color: 'text-[#6264A7]', placeholder: 'https://outlook.office.com/webhook/...' },
];

export function IntegrationsSettingsComponent() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // Form state
  const [formProvider, setFormProvider] = useState<IntegrationProvider>('slack');
  const [formUrl, setFormUrl] = useState('');
  const [formEvents, setFormEvents] = useState<string[]>(['daily_summary']);

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const data = await integrationsAPI.list();
      setIntegrations(data);
    } catch {
      toast.error('Failed to load integrations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formUrl.trim()) { toast.error('Please enter a webhook URL'); return; }
    try {
      const parsed = new URL(formUrl.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
      toast.error('Please enter a valid webhook URL (https://...)');
      return;
    }
    if (formEvents.length === 0) { toast.error('Please select at least one event'); return; }

    try {
      setCreating(true);
      const req: CreateIntegrationRequest = {
        provider: formProvider,
        webhookUrl: formUrl.trim(),
        events: formEvents,
      };
      const integration = await integrationsAPI.create(req);
      setIntegrations((prev) => [integration, ...prev]);
      setShowCreate(false);
      resetForm();
      toast.success('Integration added');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create integration');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this integration?')) return;
    try {
      setDeleting(id);
      await integrationsAPI.remove(id);
      setIntegrations((prev) => prev.filter((i) => i.id !== id));
      toast.success('Integration removed');
    } catch {
      toast.error('Failed to delete integration');
    } finally {
      setDeleting(null);
    }
  };

  const handleTest = async (id: string) => {
    try {
      setTesting(id);
      await integrationsAPI.test(id);
      toast.success('Test notification sent!');
    } catch {
      toast.error('Test notification failed');
    } finally {
      setTesting(null);
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    try {
      setToggling(id);
      await integrationsAPI.update(id, { active });
      setIntegrations((prev) =>
        prev.map((i) => (i.id === id ? { ...i, active } : i))
      );
      toast.success(active ? 'Integration enabled' : 'Integration paused');
    } catch {
      toast.error('Failed to update integration');
    } finally {
      setToggling(null);
    }
  };

  const resetForm = () => {
    setFormProvider('slack');
    setFormUrl('');
    setFormEvents(['daily_summary']);
  };

  const toggleEvent = (event: string) => {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const getProvider = (provider: string) =>
    PROVIDERS.find((p) => p.value === provider) || PROVIDERS[0];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight">Integrations</h2>
          <p className="text-muted-foreground text-sm">
            Connect Slack, Discord, or Teams to receive analytics notifications.
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="h-10 px-5 font-bold rounded gap-2 shadow-lg shadow-primary/20 transition-transform active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Add Integration
        </Button>
      </div>

      {/* Integration List */}
      <div className="grid grid-cols-1 gap-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : integrations.length === 0 ? (
          <div className="text-center py-12 bg-muted/20 rounded border border-dashed">
            <Plug className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground text-sm">No integrations configured yet.</p>
            <p className="text-muted-foreground text-xs mt-1">Add Slack, Discord, or Teams to get started.</p>
          </div>
        ) : (
          integrations.map((integration) => {
            const provider = getProvider(integration.provider);
            return (
              <div
                key={integration.id}
                className="group bg-card/50 backdrop-blur-sm p-4 rounded flex items-center justify-between border border-border/50 hover:border-primary/30 transition-all hover:bg-card/80"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className={cn('w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center border border-border/50', provider.color)}>
                    {provider.icon}
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-foreground">{provider.label}</h4>
                      {integration.active ? (
                        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider px-1.5 h-4 bg-green-500/10 text-green-600 border-green-500/30">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider px-1.5 h-4 bg-muted/50 text-muted-foreground">
                          Paused
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="truncate max-w-[200px] font-mono">{integration.webhookUrl}</span>
                      <span className="shrink-0">
                        {integration.events.length} event{integration.events.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={integration.active}
                    onCheckedChange={(checked) => handleToggle(integration.id, checked)}
                    disabled={toggling === integration.id}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTest(integration.id)}
                    disabled={testing === integration.id || !integration.active}
                    className="gap-1.5 text-xs"
                  >
                    {testing === integration.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Test
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(integration.id)}
                    disabled={deleting === integration.id}
                    className="h-8 w-8 text-muted-foreground hover:text-rose-500"
                  >
                    {deleting === integration.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Info Card */}
      <div className="bg-muted/30 p-4 rounded border border-border/50 flex gap-4">
        <Plug className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="space-y-1">
          <p className="text-xs font-bold text-foreground">How Integrations Work</p>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Integrations send formatted notifications to your chosen platform when analytics events occur.
            Each provider receives messages in its native format (Slack Block Kit, Discord Embeds, Teams MessageCard).
          </p>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Integration</DialogTitle>
            <DialogDescription>
              Connect a messaging platform to receive analytics notifications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Provider */}
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select value={formProvider} onValueChange={(v) => setFormProvider(v as IntegrationProvider)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className="flex items-center gap-2">
                        {p.icon}
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Webhook URL */}
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <Input
                placeholder={getProvider(formProvider).placeholder}
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            {/* Events */}
            <div className="space-y-2">
              <Label>Events</Label>
              <div className="grid grid-cols-1 gap-2">
                {INTEGRATION_EVENTS.map((event) => (
                  <button
                    key={event.value}
                    type="button"
                    onClick={() => toggleEvent(event.value)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded border text-left transition-all',
                      formEvents.includes(event.value)
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border/50 hover:border-border'
                    )}
                  >
                    {formEvents.includes(event.value) ? (
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{event.label}</p>
                      <p className="text-[11px] text-muted-foreground">{event.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !formUrl.trim() || formEvents.length === 0}
              className="gap-1.5"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
              Add Integration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
