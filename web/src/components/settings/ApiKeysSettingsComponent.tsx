'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Key, Copy, Trash2, Plus, Loader2, Eye, EyeOff, AlertTriangle, Clock,
  ChevronDown, ChevronUp, Lock, BarChart3, MousePointer2, Video, GitFork,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { apiKeysAPI, type APIKey } from '@/lib/apikeys-api';
import { cn } from '@/lib/utils';
import { useSubscription } from '@/hooks/useSubscription';
import { isEnterprise } from '@/lib/features';

interface ApiKeysSettingsComponentProps {
  websiteId: string;
}

const ALLOWED_PLANS = ['growth', 'pro', 'enterprise', 'custom'];

const API_SECTIONS = [
  {
    title: 'Analytics',
    icon: BarChart3,
    color: 'text-indigo-500',
    endpoints: [
      { method: 'GET', path: '/api/v1/raw/analytics/overview', desc: 'Traffic overview (visitors, pageviews, bounce rate)' },
      { method: 'GET', path: '/api/v1/raw/analytics/timeseries', desc: 'Time-bucketed analytics data' },
      { method: 'GET', path: '/api/v1/raw/analytics/top-pages', desc: 'Most visited pages' },
      { method: 'GET', path: '/api/v1/raw/analytics/sources', desc: 'Traffic sources & referrers' },
      { method: 'GET', path: '/api/v1/raw/analytics/geography', desc: 'Visitor locations by country/city' },
      { method: 'GET', path: '/api/v1/raw/analytics/devices', desc: 'Browser, OS & device breakdown' },
      { method: 'GET', path: '/api/v1/raw/analytics/events', desc: 'Custom event data' },
      { method: 'GET', path: '/api/v1/raw/analytics/realtime', desc: 'Live visitor count & active pages' },
    ],
  },
  {
    title: 'Heatmaps',
    icon: MousePointer2,
    color: 'text-rose-500',
    endpoints: [
      { method: 'GET', path: '/api/v1/raw/heatmaps/list', desc: 'All heatmap snapshots for a site' },
      { method: 'GET', path: '/api/v1/raw/heatmaps/clicks', desc: 'Click coordinates & element data' },
    ],
  },
  {
    title: 'Session Replays',
    icon: Video,
    color: 'text-indigo-500',
    endpoints: [
      { method: 'GET', path: '/api/v1/raw/replays', desc: 'List recorded sessions' },
      { method: 'GET', path: '/api/v1/raw/replays/:session_id', desc: 'Full replay data for a session' },
    ],
  },
  {
    title: 'Funnels',
    icon: GitFork,
    color: 'text-emerald-500',
    endpoints: [
      { method: 'GET', path: '/api/v1/raw/funnels', desc: 'List all funnels' },
      { method: 'GET', path: '/api/v1/raw/funnels/:funnel_id', desc: 'Funnel steps & conversion data' },
    ],
  },
];

export function ApiKeysSettingsComponent({ websiteId }: ApiKeysSettingsComponentProps) {
  const { subscription, loading: subLoading } = useSubscription();
  const plan = subscription?.plan?.toLowerCase() || '';
  const hasAccess = ALLOWED_PLANS.includes(plan);

  const [keys, setKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<APIKey | null>(null);
  const [showKey, setShowKey] = useState(true);
  const [showEndpoints, setShowEndpoints] = useState(false);

  useEffect(() => {
    if (hasAccess) loadKeys();
    else setLoading(false);
  }, [hasAccess]);

  const loadKeys = async () => {
    try {
      setLoading(true);
      const data = await apiKeysAPI.list(websiteId);
      setKeys(data);
    } catch {
      toast.error('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error('Please enter a key name');
      return;
    }
    try {
      setCreating(true);
      const key = await apiKeysAPI.create(websiteId, newKeyName.trim(), []);
      setCreatedKey(key);
      setShowCreate(false);
      setNewKeyName('');
      setShowKey(true);
      await loadKeys();
    } catch {
      toast.error('Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to revoke this API key? Any applications using it will stop working.')) {
      return;
    }
    try {
      setDeleting(id);
      await apiKeysAPI.revoke(websiteId, id);
      setKeys((prev) => prev.filter((k) => k.id !== id));
      toast.success('API key revoked');
    } catch {
      toast.error('Failed to revoke API key');
    } finally {
      setDeleting(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isEnterprise) return null;

  if (subLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Plan gate — show upgrade prompt for starter/basic
  if (!hasAccess) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-bold mb-2">Raw Data API Access</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Programmatic access to your analytics, heatmaps, session replays, and funnels data
              is available on the <span className="font-semibold text-foreground">Growth</span> plan and above.
            </p>
            <Button asChild className="gap-2">
              <a href={`/websites/${websiteId}/settings/billing`}>
                <Zap className="h-4 w-4" />
                Upgrade Plan
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* Preview of available endpoints */}
        <Card className="bg-muted/20 border-border/40">
          <CardContent className="p-4">
            <h4 className="text-sm font-medium mb-3">Available API Endpoints</h4>
            <div className="grid gap-3">
              {API_SECTIONS.map((section) => {
                const Icon = section.icon;
                return (
                  <div key={section.title} className="flex items-start gap-2.5">
                    <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', section.color)} />
                    <div>
                      <p className="text-xs font-medium">{section.title}</p>
                      <p className="text-[10px] text-muted-foreground">{section.endpoints.length} endpoints</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">API Keys</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage API keys for programmatic access to your analytics data.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Create Key
        </Button>
      </div>

      {/* Newly Created Key Banner */}
      {createdKey?.key && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium">
                  Store your API key securely — it won&apos;t be shown again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted/50 border rounded-lg px-3 py-2 font-mono break-all">
                    {showKey ? createdKey.key : '\u2022'.repeat(48)}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => copyToClipboard(createdKey.key!)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => setCreatedKey(null)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Keys List */}
      {keys.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Key className="h-6 w-6 text-muted-foreground" />
            </div>
            <h4 className="text-sm font-medium mb-1">No API keys yet</h4>
            <p className="text-xs text-muted-foreground max-w-sm mb-4">
              Create an API key to access your analytics data programmatically via the Raw Data API.
            </p>
            <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Create Your First Key
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <Card key={key.id} className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                      <Key className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{key.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <code className="font-mono">{key.keyPrefix}\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022</code>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {key.lastUsedAt ? `Used ${formatDate(key.lastUsedAt)}` : 'Never used'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-8 w-8 shrink-0 text-muted-foreground hover:text-red-500',
                      deleting === key.id && 'pointer-events-none'
                    )}
                    onClick={() => handleDelete(key.id)}
                    disabled={deleting === key.id}
                  >
                    {deleting === key.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* API Endpoint Documentation */}
      <Card className="bg-muted/20 border-border/40">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-medium">Raw Data API</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Include your API key as a Bearer token in the Authorization header.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setShowEndpoints(!showEndpoints)}
            >
              {showEndpoints ? (
                <><ChevronUp className="h-3.5 w-3.5" /> Hide Endpoints</>
              ) : (
                <><ChevronDown className="h-3.5 w-3.5" /> Show Endpoints</>
              )}
            </Button>
          </div>

          <code className="block text-xs bg-background/80 border rounded-lg px-3 py-2 font-mono text-muted-foreground mb-3">
            Authorization: Bearer sk_your_api_key_here
          </code>

          {showEndpoints && (
            <div className="space-y-4 mt-4 pt-4 border-t border-border/40">
              {API_SECTIONS.map((section) => {
                const Icon = section.icon;
                return (
                  <div key={section.title}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={cn('h-3.5 w-3.5', section.color)} />
                      <span className="text-xs font-bold">{section.title}</span>
                    </div>
                    <div className="space-y-1">
                      {section.endpoints.map((ep) => (
                        <div
                          key={ep.path}
                          className="flex items-start gap-2 text-xs px-2 py-1.5 rounded-lg hover:bg-muted/30"
                        >
                          <span className="font-mono font-bold text-emerald-600 shrink-0 w-8">{ep.method}</span>
                          <code className="font-mono text-muted-foreground break-all">{ep.path}</code>
                          <span className="text-muted-foreground/70 ml-auto shrink-0 text-right max-w-[200px]">{ep.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Key Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Give your key a descriptive name so you can identify it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              placeholder="e.g. Production Dashboard, CI/CD Pipeline..."
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newKeyName.trim()} className="gap-1.5">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Key className="h-3.5 w-3.5" />}
              Create Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
