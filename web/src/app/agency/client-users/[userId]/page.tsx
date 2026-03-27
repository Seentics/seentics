'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getClientUser,
  resetClientUserPassword,
  updateClient,
  ClientUser,
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
  Mail,
  Building2,
  Calendar,
  KeyRound,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type FeatureKey = keyof ClientUser['featuresEnabled'];

const STATUS_STYLES: Record<ClientUser['status'], string> = {
  active:    'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  suspended: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
};

const FEATURE_LABELS: Array<{ key: FeatureKey; label: string; description: string }> = [
  { key: 'analytics',   label: 'Analytics',       description: 'Page views, sessions, traffic sources' },
  { key: 'heatmaps',    label: 'Heatmaps',         description: 'Click and scroll heatmaps' },
  { key: 'replays',     label: 'Session Replays',  description: 'Record and replay user sessions' },
  { key: 'funnels',     label: 'Funnels',          description: 'Conversion funnel analysis' },
  { key: 'automations', label: 'Automations',      description: 'Workflow automations and triggers' },
];

type Tab = 'account' | 'api-access';

// ─── Copy Button ──────────────────────────────────────────────────────────────

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Button
      variant="outline" size="sm"
      className={cn('h-8 w-8 p-0 shrink-0', className)}
      onClick={handleCopy}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

// ─── Reset Password Dialog ────────────────────────────────────────────────────

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: ClientUser;
}

function ResetPasswordDialog({ open, onOpenChange, user }: ResetPasswordDialogProps) {
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => resetClientUserPassword(user.userId),
    onSuccess: (data) => setTempPassword(data.tempPassword),
    onError: (err: any) => toast.error(err.message || 'Failed to reset password'),
  });

  const handleClose = (v: boolean) => {
    if (!v) setTempPassword(null);
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm bg-card border border-border rounded-xl p-0 gap-0">
        <DialogHeader className="px-6 py-5 border-b border-border">
          <DialogTitle className="text-base font-semibold">Reset Password</DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-4">
          {tempPassword ? (
            <>
              <p className="text-sm text-muted-foreground">
                New temporary password for <strong>{user.name}</strong>:
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono bg-muted/50 border border-border/60 rounded-md px-3 py-2 select-all break-all">
                    {tempPassword}
                  </code>
                  <CopyButton text={tempPassword} />
                </div>
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Share this password with your client. It won't be shown again.
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Generate a new temporary password for <strong>{user.name}</strong>?
              Their current password will be invalidated.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => handleClose(false)}>
            {tempPassword ? 'Close' : 'Cancel'}
          </Button>
          {!tempPassword && (
            <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Generate Password
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Account Tab ──────────────────────────────────────────────────────────────

function AccountTab({ user }: { user: ClientUser }) {
  const queryClient = useQueryClient();
  const [showReset, setShowReset] = useState(false);

  const [features, setFeatures] = useState<ClientUser['featuresEnabled']>({ ...user.featuresEnabled });
  const [limits, setLimits] = useState<NonNullable<ClientUser['limits']>>(user.limits ?? {});

  const updateMutation = useMutation({
    mutationFn: (req: Parameters<typeof updateClient>[1]) => updateClient(user.id, req),
    onSuccess: () => {
      toast.success('Account updated');
      queryClient.invalidateQueries({ queryKey: ['agency-client-user', user.userId] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update account'),
  });

  const handleFeatureToggle = (key: FeatureKey) => {
    const next = { ...features, [key]: !features[key] };
    setFeatures(next);
    updateMutation.mutate({ featuresEnabled: next });
  };

  const parseLimit = (val: string): number | undefined => {
    const n = parseInt(val, 10);
    return isNaN(n) || val.trim() === '' ? undefined : n;
  };

  const handleLimitSave = () => {
    updateMutation.mutate({ limits: {
      maxMonthlyEvents: limits.maxMonthlyEvents ?? null,
      maxReplays: limits.maxReplays ?? null,
      maxHeatmaps: limits.maxHeatmaps ?? null,
      maxWebsites: limits.maxWebsites ?? null,
    } });
  };

  return (
    <div className="space-y-6">
      {/* User info */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Name</p>
              <p className="font-medium">{user.name}</p>
            </div>
            {user.company && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Company</p>
                <p className="font-medium flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 opacity-60" />
                  {user.company}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Email</p>
              <p className="font-medium flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 opacity-60" />
                {user.email}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Status</p>
              <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border capitalize', STATUS_STYLES[user.status])}>
                {user.status}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Member since</p>
              <p className="font-medium flex items-center gap-1.5 text-sm">
                <Calendar className="h-3.5 w-3.5 opacity-60" />
                {user.createdAt ? format(new Date(user.createdAt), 'MMM d, yyyy') : '—'}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-border/40">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setShowReset(true)}
            >
              <KeyRound className="h-3.5 w-3.5" />
              Reset Password
            </Button>
          </div>
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
            <Button size="sm" onClick={handleLimitSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Save Limits
            </Button>
          </div>
        </CardContent>
      </Card>

      <ResetPasswordDialog open={showReset} onOpenChange={setShowReset} user={user} />
    </div>
  );
}

// ─── API Access Tab ───────────────────────────────────────────────────────────

function ApiAccessTab({ userId }: { userId: string }) {
  const curlExample = `curl -X POST https://your-gateway.com/api/v1/agency/api/users/${userId}/websites \\
  -H "Authorization: Bearer YOUR_AGENCY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"websiteId": "site_abc123"}'`;

  const endpoints: Array<{ method: string; path: string; description: string }> = [
    { method: 'GET',    path: `/api/v1/agency/api/users`,                         description: 'List all client users' },
    { method: 'POST',   path: `/api/v1/agency/api/users`,                         description: 'Create a client user' },
    { method: 'GET',    path: `/api/v1/agency/api/users/${userId}`,               description: 'Get this client user' },
    { method: 'DELETE', path: `/api/v1/agency/api/users/${userId}`,               description: 'Delete this client user' },
    { method: 'POST',   path: `/api/v1/agency/api/users/${userId}/websites`,      description: 'Assign a website' },
    { method: 'GET',    path: `/api/v1/agency/api/users/${userId}/websites`,      description: 'List assigned websites' },
  ];

  const METHOD_COLORS: Record<string, string> = {
    GET:    'text-green-600 dark:text-green-400',
    POST:   'text-blue-600 dark:text-blue-400',
    DELETE: 'text-red-600 dark:text-red-400',
  };

  return (
    <div className="space-y-6">
      <Card className="border border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Agency Programmatic API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use your agency API key to manage clients programmatically. All endpoints require the
            <code className="mx-1 text-xs font-mono bg-muted px-1.5 py-0.5 rounded">Authorization: Bearer YOUR_AGENCY_API_KEY</code>
            header.
          </p>

          {/* Endpoint list */}
          <div className="rounded-lg border border-border/60 overflow-hidden">
            {endpoints.map((ep, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 text-sm',
                  i < endpoints.length - 1 ? 'border-b border-border/40' : '',
                  i % 2 === 0 ? 'bg-card' : 'bg-muted/20',
                )}
              >
                <span className={cn('text-xs font-bold font-mono w-14 shrink-0', METHOD_COLORS[ep.method])}>
                  {ep.method}
                </span>
                <code className="text-xs font-mono text-foreground flex-1 break-all">{ep.path}</code>
                <span className="text-xs text-muted-foreground hidden sm:block shrink-0">{ep.description}</span>
              </div>
            ))}
          </div>

          {/* Example */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Example — Create a website for this client:
            </p>
            <div className="relative group">
              <pre className="text-xs font-mono bg-zinc-950 dark:bg-zinc-900 text-zinc-100 rounded-lg p-4 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
                {curlExample}
              </pre>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <CopyButton text={curlExample} className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-100 hover:text-zinc-100" />
              </div>
            </div>
          </div>

          {/* User ID reference */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-4 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">This client's user ID</p>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono text-foreground flex-1 select-all">{userId}</code>
              <CopyButton text={userId} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientUserDetailPage() {
  const params  = useParams();
  const userId  = params.userId as string;
  const [activeTab, setActiveTab] = useState<Tab>('account');

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['agency-client-user', userId],
    queryFn: () => getClientUser(userId),
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="p-6 max-w-[800px] mx-auto">
        <div className="py-16 text-center border border-dashed border-border/50 rounded-lg">
          <p className="text-sm text-muted-foreground">Client account not found or you don't have access.</p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link href="/agency/client-users">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Back to Client Accounts
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'account',    label: 'Account' },
    { id: 'api-access', label: 'API Access' },
  ];

  return (
    <div className="p-6 max-w-[800px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/agency/client-users"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Client Accounts
        </Link>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{user.name}</h1>
              <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border capitalize', STATUS_STYLES[user.status])}>
                {user.status}
              </Badge>
            </div>
            {user.company && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <Building2 className="h-3 w-3 opacity-60" />
                {user.company}
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
      {activeTab === 'account'    && <AccountTab user={user} />}
      {activeTab === 'api-access' && <ApiAccessTab userId={user.userId} />}
    </div>
  );
}
