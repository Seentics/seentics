'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listClientUsers,
  createClientUser,
  deleteClientUser,
  resetClientUserPassword,
  ClientUser,
  CreateClientUserRequest,
  CreateClientUserResponse,
} from '@/lib/agency-api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Link from 'next/link';
import {
  UserPlus,
  Users,
  Trash2,
  KeyRound,
  Copy,
  Check,
  Eye,
  Loader2,
  Mail,
  Building2,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { USER_STATUS_STYLES } from '@/features/agency/constants';
import { CopyButton } from '@/components/agency/CopyButton';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ClientUserStatus = ClientUser['status'];

type FeatureKey = keyof ClientUser['featuresEnabled'];

const FEATURE_LABELS: Array<{ key: FeatureKey; label: string }> = [
  { key: 'analytics',   label: 'Analytics' },
  { key: 'heatmaps',    label: 'Heatmaps' },
  { key: 'replays',     label: 'Replays' },
  { key: 'funnels',     label: 'Funnels' },
  { key: 'automations', label: 'Automations' },
];

const DEFAULT_FEATURES: ClientUser['featuresEnabled'] = {
  analytics: true, heatmaps: true, replays: true, funnels: true, automations: true,
};

// ─── Copy Button ──────────────────────────────────────────────────────────────

// ─── Temp Password Display ────────────────────────────────────────────────────

import { TempPasswordDisplay, CreateClientUserDialog, ResetPasswordDialog, DeleteConfirmDialog } from '@/components/agency/client-user-dialogs';

interface ClientUserRowProps {
  user: ClientUser;
  onResetPassword: (user: ClientUser) => void;
  onDelete: (user: ClientUser) => void;
}

function ClientUserRow({ user, onResetPassword, onDelete }: ClientUserRowProps) {
  return (
    <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors">
      {/* Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-sm font-medium text-foreground">{user.name}</span>
        </div>
      </td>

      {/* Email */}
      <td className="px-4 py-3">
        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Mail className="h-3 w-3 opacity-60 shrink-0" />
          {user.email}
        </span>
      </td>

      {/* Company */}
      <td className="px-4 py-3">
        {user.company ? (
          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Building2 className="h-3 w-3 opacity-60 shrink-0" />
            {user.company}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/40">—</span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border capitalize', USER_STATUS_STYLES[user.status as keyof typeof USER_STATUS_STYLES])}>
          {user.status}
        </Badge>
      </td>

      {/* Features */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {FEATURE_LABELS.map(f => (
            <span
              key={f.key}
              className={cn(
                'text-[10px] px-1.5 py-0 rounded-sm border',
                user.featuresEnabled[f.key]
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-muted/30 text-muted-foreground/40 border-border/30 line-through',
              )}
            >
              {f.label}
            </span>
          ))}
        </div>
      </td>

      {/* Created */}
      <td className="px-4 py-3">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Calendar className="h-3 w-3 opacity-50 shrink-0" />
          {user.createdAt ? format(new Date(user.createdAt), 'MMM d, yyyy') : '—'}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost" size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            title="View details"
            asChild
          >
            <Link href={`/agency/client-users/${user.userId}`}>
              <Eye className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button
            variant="ghost" size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            title="Reset password"
            onClick={() => onResetPassword(user)}
          >
            <KeyRound className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost" size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            title="Delete account"
            onClick={() => onDelete(user)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientUsersPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate]         = useState(false);
  const [resetTarget, setResetTarget]       = useState<ClientUser | null>(null);
  const [deleteTarget, setDeleteTarget]     = useState<ClientUser | null>(null);
  const [search, setSearch]                 = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['agency-client-users'],
    queryFn: listClientUsers,
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteClientUser(userId),
    onSuccess: () => {
      toast.success('Account deleted');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['agency-client-users'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete account'),
  });

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.company ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-[1100px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Client Accounts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage user accounts for your clients. Each client gets full login access to their own dashboard.
          </p>
        </div>
        <Button size="sm" className="h-9 gap-1.5" onClick={() => setShowCreate(true)}>
          <UserPlus className="h-3.5 w-3.5" />
          Create Client Account
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by name, email, company…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-sm w-72"
        />
        <span className="text-xs text-muted-foreground">
          {users.length} account{users.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border/50 rounded-lg">
          <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {users.length === 0 ? 'No client accounts yet.' : 'No accounts match your search.'}
          </p>
          {users.length === 0 && (
            <Button size="sm" className="mt-4 gap-1.5" onClick={() => setShowCreate(true)}>
              <UserPlus className="h-3.5 w-3.5" />
              Create Client Account
            </Button>
          )}
        </div>
      ) : (
        <Card className="border border-border/60 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Features</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Created</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(user => (
                    <ClientUserRow
                      key={user.id}
                      user={user}
                      onResetPassword={setResetTarget}
                      onDelete={setDeleteTarget}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <CreateClientUserDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onDone={() => queryClient.invalidateQueries({ queryKey: ['agency-client-users'] })}
      />

      <ResetPasswordDialog
        user={resetTarget}
        onClose={() => setResetTarget(null)}
      />

      <DeleteConfirmDialog
        user={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={(userId) => deleteMutation.mutate(userId)}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
