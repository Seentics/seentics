'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getClient,
  updateClient,
  listClientWebsites,
  assignWebsite,
  unassignWebsite,
  generatePortalToken,
  AgencyClient,
  AgencyClientFeatures,
  ClientLimits,
  ClientWebsite,
  PortalToken,
} from '@/lib/agency-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ArrowLeft,
  Loader2,
  Globe,
  Link2,
  Trash2,
  Plus,
  Copy,
  Check,
  KeyRound,
  Building2,
  Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<AgencyClient['status'], string> = {
  active:    'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  suspended: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  archived:  'bg-muted text-muted-foreground border-border',
};

const FEATURE_LABELS: Array<{ key: keyof AgencyClientFeatures; label: string; description: string }> = [
  { key: 'analytics',   label: 'Analytics',         description: 'Page views, sessions, traffic sources' },
  { key: 'heatmaps',    label: 'Heatmaps',           description: 'Click and scroll heatmaps' },
  { key: 'replays',     label: 'Session Replays',    description: 'Record and replay user sessions' },
  { key: 'funnels',     label: 'Funnels',            description: 'Conversion funnel analysis' },
  { key: 'automations', label: 'Automations',        description: 'Workflow automations and triggers' },
];

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'websites' | 'portal';

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ client }: { client: AgencyClient }) {
  const queryClient = useQueryClient();

  // Feature toggles state — optimistic local copy
  const [features, setFeatures] = useState<AgencyClientFeatures>({ ...client.featuresEnabled });
  const [limits, setLimits] = useState<ClientLimits>({ ...client.limits });

  const updateMutation = useMutation({
    mutationFn: (req: Parameters<typeof updateClient>[1]) => updateClient(client.id, req),
    onSuccess: () => {
      toast.success('Client updated');
      queryClient.invalidateQueries({ queryKey: ['agency-client', client.id] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update client'),
  });

  const handleFeatureToggle = (key: keyof AgencyClientFeatures) => {
    const next = { ...features, [key]: !features[key] };
    setFeatures(next);
    updateMutation.mutate({ featuresEnabled: next });
  };

  const handleLimitSave = () => {
    updateMutation.mutate({ limits });
  };

  const parseLimit = (val: string): number | null => {
    const n = parseInt(val, 10);
    return isNaN(n) || val.trim() === '' ? null : n;
  };

  return (
    <div className="space-y-6">
      {/* Client info card */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Client Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Name</p>
              <p className="font-medium">{client.name}</p>
            </div>
            {client.company && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Company</p>
                <p className="font-medium flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 opacity-60" />
                  {client.company}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Email</p>
              <p className="font-medium flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 opacity-60" />
                {client.email}
              </p>
            </div>
            {client.websiteUrl && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Website</p>
                <a
                  href={client.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium flex items-center gap-1.5 hover:underline text-primary"
                >
                  <Globe className="h-3.5 w-3.5 opacity-60" />
                  {client.websiteUrl}
                </a>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Member since</p>
              <p className="font-medium">
                {client.createdAt ? format(new Date(client.createdAt), 'MMM d, yyyy') : '—'}
              </p>
            </div>
          </div>
          {client.note && (
            <div className="pt-2 border-t border-border/40">
              <p className="text-xs text-muted-foreground mb-1">Note</p>
              <p className="text-sm text-muted-foreground">{client.note}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feature toggles */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Feature Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {FEATURE_LABELS.map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <Switch
                checked={features[key]}
                onCheckedChange={() => handleFeatureToggle(key)}
                disabled={updateMutation.isPending}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Resource limits */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Resource Limits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Leave blank to use your agency plan's default limits.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Max Monthly Events</Label>
              <Input
                type="number"
                placeholder="Agency default"
                value={limits.maxMonthlyEvents ?? ''}
                onChange={e => setLimits(prev => ({ ...prev, maxMonthlyEvents: parseLimit(e.target.value) }))}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Max Session Replays</Label>
              <Input
                type="number"
                placeholder="Agency default"
                value={limits.maxReplays ?? ''}
                onChange={e => setLimits(prev => ({ ...prev, maxReplays: parseLimit(e.target.value) }))}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Max Heatmaps</Label>
              <Input
                type="number"
                placeholder="Agency default"
                value={limits.maxHeatmaps ?? ''}
                onChange={e => setLimits(prev => ({ ...prev, maxHeatmaps: parseLimit(e.target.value) }))}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Max Websites</Label>
              <Input
                type="number"
                placeholder="Agency default"
                value={limits.maxWebsites ?? ''}
                onChange={e => setLimits(prev => ({ ...prev, maxWebsites: parseLimit(e.target.value) }))}
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              onClick={handleLimitSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Save Limits
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Websites Tab ─────────────────────────────────────────────────────────────

function WebsitesTab({ client }: { client: AgencyClient }) {
  const queryClient = useQueryClient();
  const [showAssign, setShowAssign] = useState(false);
  const [websiteIdInput, setWebsiteIdInput] = useState('');

  const { data: websites = [], isLoading } = useQuery({
    queryKey: ['agency-client-websites', client.id],
    queryFn: () => listClientWebsites(client.id),
  });

  const assignMutation = useMutation({
    mutationFn: (websiteId: string) => assignWebsite(client.id, websiteId),
    onSuccess: () => {
      toast.success('Website assigned');
      setShowAssign(false);
      setWebsiteIdInput('');
      queryClient.invalidateQueries({ queryKey: ['agency-client-websites', client.id] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to assign website'),
  });

  const unassignMutation = useMutation({
    mutationFn: (websiteId: string) => unassignWebsite(client.id, websiteId),
    onSuccess: () => {
      toast.success('Website removed');
      queryClient.invalidateQueries({ queryKey: ['agency-client-websites', client.id] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to remove website'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {websites.length} website{websites.length !== 1 ? 's' : ''} assigned
        </p>
        <Button size="sm" className="h-8 gap-1.5" onClick={() => setShowAssign(true)}>
          <Plus className="h-3.5 w-3.5" />
          Assign Website
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : websites.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-border/50 rounded-lg">
          <Globe className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No websites assigned yet.</p>
          <Button size="sm" className="mt-3 gap-1.5" onClick={() => setShowAssign(true)}>
            <Plus className="h-3.5 w-3.5" />
            Assign Website
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {websites.map((w: ClientWebsite) => (
            <div
              key={w.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-card"
            >
              <div className="flex items-center gap-2.5">
                <Globe className="h-4 w-4 text-muted-foreground opacity-60" />
                <div>
                  <p className="text-sm font-mono font-medium">{w.websiteId}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Added {w.createdAt ? format(new Date(w.createdAt), 'MMM d, yyyy') : '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost" size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  asChild
                >
                  <Link href={`/websites/${w.websiteId}`}>
                    <Link2 className="h-3.5 w-3.5 mr-1" />
                    View
                  </Link>
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    if (!confirm(`Remove website "${w.websiteId}" from this client?`)) return;
                    unassignMutation.mutate(w.websiteId);
                  }}
                  disabled={unassignMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assign Website Dialog */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="max-w-sm bg-card border border-border rounded-xl p-0 gap-0">
          <DialogHeader className="px-6 py-5 border-b border-border">
            <DialogTitle className="text-base font-semibold">Assign Website</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Website ID (site_id)</Label>
              <Input
                placeholder="e.g. site_abc123"
                value={websiteIdInput}
                onChange={e => setWebsiteIdInput(e.target.value)}
                className="h-9 text-sm font-mono"
                onKeyDown={e => {
                  if (e.key === 'Enter' && websiteIdInput.trim()) {
                    assignMutation.mutate(websiteIdInput.trim());
                  }
                }}
              />
              <p className="text-[11px] text-muted-foreground">
                Enter the site_id from your analytics dashboard.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setShowAssign(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => websiteIdInput.trim() && assignMutation.mutate(websiteIdInput.trim())}
              disabled={!websiteIdInput.trim() || assignMutation.isPending}
            >
              {assignMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Assign
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Portal Access Tab ────────────────────────────────────────────────────────

function PortalAccessTab({ client }: { client: AgencyClient }) {
  const [token, setToken] = useState<PortalToken | null>(null);
  const [copied, setCopied] = useState(false);

  const generateMutation = useMutation({
    mutationFn: () => generatePortalToken(client.id),
    onSuccess: (data) => {
      setToken(data);
      toast.success('Portal link generated');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to generate portal link'),
  });

  const portalURL = token?.token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/client-portal/${token.token}`
    : '';

  const handleCopy = () => {
    if (!portalURL) return;
    navigator.clipboard.writeText(portalURL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Client Self-Service Portal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Generate a secure one-time link that lets <strong>{client.name}</strong> access their
            analytics portal without needing a Seentics account. The link expires in <strong>7 days</strong>.
          </p>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2 text-sm">
            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">What the client can see:</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {Object.entries(client.featuresEnabled)
                .filter(([, enabled]) => enabled)
                .map(([key]) => {
                  const feature = FEATURE_LABELS.find(f => f.key === key);
                  return feature ? (
                    <li key={key} className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                      {feature.label}
                    </li>
                  ) : null;
                })}
              {Object.entries(client.featuresEnabled).every(([, v]) => !v) && (
                <li className="text-amber-600 dark:text-amber-400">No features enabled for this client.</li>
              )}
            </ul>
          </div>

          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="gap-1.5"
          >
            {generateMutation.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <KeyRound className="h-3.5 w-3.5" />
            }
            Generate Portal Link
          </Button>

          {token && portalURL && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-medium text-muted-foreground">
                Portal link (expires {token.expiresAt ? format(new Date(token.expiresAt), 'MMM d, yyyy') : 'in 7 days'}):
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-muted/50 border border-border/60 rounded-md px-3 py-2 break-all select-all">
                  {portalURL}
                </code>
                <Button
                  variant="outline" size="sm"
                  className="h-9 w-9 p-0 shrink-0"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                Share this link directly with your client. It will only work once per session and expires in 7 days.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { data: client, isLoading, isError } = useQuery({
    queryKey: ['agency-client', clientId],
    queryFn: () => getClient(clientId),
    enabled: !!clientId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !client) {
    return (
      <div className="p-6 max-w-[800px] mx-auto">
        <div className="py-16 text-center border border-dashed border-border/50 rounded-lg">
          <p className="text-sm text-muted-foreground">Client not found or you don't have access.</p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link href="/agency/clients">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Back to Clients
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'websites', label: 'Websites' },
    { id: 'portal',   label: 'Portal Access' },
  ];

  return (
    <div className="p-6 max-w-[800px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/agency/clients"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Clients
        </Link>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary">
              {client.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{client.name}</h1>
              <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border capitalize', STATUS_STYLES[client.status])}>
                {client.status}
              </Badge>
            </div>
            {client.company && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <Building2 className="h-3 w-3 opacity-60" />
                {client.company}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border/60">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab client={client} />}
      {activeTab === 'websites' && <WebsitesTab client={client} />}
      {activeTab === 'portal'   && <PortalAccessTab client={client} />}
    </div>
  );
}
