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

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ClientUserStatus = ClientUser['status'];

const STATUS_STYLES: Record<ClientUserStatus, string> = {
  active:    'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  suspended: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
};

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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Button variant="outline" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={handleCopy}>
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

// ─── Temp Password Display ────────────────────────────────────────────────────

function TempPasswordDisplay({ password }: { password: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs font-mono bg-muted/50 border border-border/60 rounded-lg px-3 py-2 select-all break-all">
          {password}
        </code>
        <CopyButton text={password} />
      </div>
      <p className="text-[11px] text-amber-600 dark:text-amber-400">
        Share this password with your client. It won't be shown again.
      </p>
    </div>
  );
}

// ─── Create Client User Dialog ────────────────────────────────────────────────

interface CreateClientUserDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}

function CreateClientUserDialog({ open, onOpenChange, onDone }: CreateClientUserDialogProps) {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [company, setCompany]   = useState('');
  const [password, setPassword] = useState('');
  const [features, setFeatures] = useState<ClientUser['featuresEnabled']>({ ...DEFAULT_FEATURES });
  const [result, setResult]     = useState<CreateClientUserResponse | null>(null);

  const mutation = useMutation({
    mutationFn: (req: CreateClientUserRequest) => createClientUser(req),
    onSuccess: (data) => {
      setResult(data);
      onDone();
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create client account'),
  });

  const resetForm = () => {
    setName(''); setEmail(''); setCompany(''); setPassword('');
    setFeatures({ ...DEFAULT_FEATURES });
    setResult(null);
  };

  const handleClose = (v: boolean) => {
    onOpenChange(v);
    if (!v) resetForm();
  };

  const handleSubmit = () => {
    if (!name.trim() || !email.trim()) return;
    const req: CreateClientUserRequest = {
      name: name.trim(),
      email: email.trim(),
      company: company.trim() || undefined,
      password: password.trim() || undefined,
      features,
    };
    mutation.mutate(req);
  };

  const toggleFeature = (key: FeatureKey) =>
    setFeatures(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Success state ──────────────────────────────────────────────────────────
  if (result) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md bg-card border border-border rounded-lg p-0 gap-0">
          <DialogHeader className="px-6 py-5 border-b border-border">
            <DialogTitle className="text-base font-semibold">Account Created</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg-full bg-green-100 dark:bg-green-950 border border-green-200 dark:border-green-800 flex items-center justify-center shrink-0">
                <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Account created successfully!</p>
                <p className="text-xs text-muted-foreground">{result.user.email}</p>
              </div>
            </div>

            {result.tempPassword && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-medium text-muted-foreground">Temporary password</p>
                <TempPasswordDisplay password={result.tempPassword} />
              </div>
            )}
          </div>
          <div className="flex justify-end px-6 py-4 border-t border-border">
            <Button size="sm" onClick={() => handleClose(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Create form ────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-card border border-border rounded-lg p-0 gap-0">
        <DialogHeader className="px-6 py-5 border-b border-border">
          <DialogTitle className="text-base font-semibold">Create Client Account</DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Full Name <span className="text-destructive">*</span></Label>
              <Input placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Company</Label>
              <Input placeholder="Acme Corp" value={company} onChange={e => setCompany(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Email <span className="text-destructive">*</span></Label>
            <Input type="email" placeholder="jane@acme.com" value={email} onChange={e => setEmail(e.target.value)} className="h-9 text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Password</Label>
            <Input
              type="password"
              placeholder="Auto-generate if empty"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Features</Label>
            <div className="grid grid-cols-2 gap-2">
              {FEATURE_LABELS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={features[key]}
                    onChange={() => toggleFeature(key)}
                    className="rounded-lg border-border accent-primary h-4 w-4"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => handleClose(false)}>Cancel</Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!name.trim() || !email.trim() || mutation.isPending}
          >
            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            Create Account
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reset Password Dialog ────────────────────────────────────────────────────

interface ResetPasswordDialogProps {
  user: ClientUser | null;
  onClose: () => void;
}

function ResetPasswordDialog({ user, onClose }: ResetPasswordDialogProps) {
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (userId: string) => resetClientUserPassword(userId),
    onSuccess: (data) => setTempPassword(data.tempPassword),
    onError: (err: any) => toast.error(err.message || 'Failed to reset password'),
  });

  const handleClose = () => {
    setTempPassword(null);
    onClose();
  };

  if (!user) return null;

  return (
    <Dialog open={!!user} onOpenChange={(v) => { if (!v) handleClose(); }}>
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
              <TempPasswordDisplay password={tempPassword} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Generate a new temporary password for <strong>{user.name}</strong>?
              Their current password will be invalidated.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={handleClose}>
            {tempPassword ? 'Close' : 'Cancel'}
          </Button>
          {!tempPassword && (
            <Button
              size="sm"
              onClick={() => mutation.mutate(user.userId)}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Generate Password
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

interface DeleteConfirmDialogProps {
  user: ClientUser | null;
  onClose: () => void;
  onConfirm: (userId: string) => void;
  isDeleting: boolean;
}

function DeleteConfirmDialog({ user, onClose, onConfirm, isDeleting }: DeleteConfirmDialogProps) {
  if (!user) return null;
  return (
    <Dialog open={!!user} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm bg-card border border-border rounded-lg p-0 gap-0">
        <DialogHeader className="px-6 py-5 border-b border-border">
          <DialogTitle className="text-base font-semibold">Delete Account</DialogTitle>
        </DialogHeader>
        <div className="p-6">
          <p className="text-sm text-muted-foreground">
            Delete <strong>{user.name}</strong>'s account? This will permanently delete their user
            account and all associated data. This action cannot be undone.
          </p>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onConfirm(user.userId)}
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
            Delete Account
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Client User Row ──────────────────────────────────────────────────────────

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
          <div className="h-8 w-8 rounded-lg-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
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
        <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border capitalize', STATUS_STYLES[user.status])}>
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
                'text-[10px] px-1.5 py-0 rounded-lg-sm border',
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
