'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useState } from 'react';

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
import { USER_STATUS_STYLES } from '@/features/agency/constants';
import { CopyButton } from '@/components/agency/CopyButton';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type FeatureKey = keyof ClientUser['featuresEnabled'];

const FEATURE_LABELS: Array<{ key: FeatureKey; label: string; description: string }> = [
  { key: 'analytics',   label: 'Analytics',       description: 'Page views, sessions, traffic sources' },
  { key: 'heatmaps',    label: 'Heatmaps',         description: 'Click and scroll heatmaps' },
  { key: 'replays',     label: 'Session Replays',  description: 'Record and replay user sessions' },
  { key: 'funnels',     label: 'Funnels',          description: 'Conversion funnel analysis' },
  { key: 'automations', label: 'Automations',      description: 'Workflow automations and triggers' },
];

type Tab = 'account' | 'api-access';

// ─── Copy Button ──────────────────────────────────────────────────────────────

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
      <DialogContent className="max-w-sm bg-card border border-border rounded-lg p-0 gap-0">
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
                  <code className="flex-1 text-xs font-mono bg-muted/50 border border-border/60 rounded-lg px-3 py-2 select-all break-all">
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

import { AccountTab, ApiAccessTab } from '@/components/agency/client-user-tabs';

export default function ClientUserDetailPage() {
  const params = { userId: usePathSegment(2) ?? '' };
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
              <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border capitalize', USER_STATUS_STYLES[user.status])}>
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
