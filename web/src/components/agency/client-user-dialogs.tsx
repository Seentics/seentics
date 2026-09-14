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

type FeatureKey = keyof ClientUser['featuresEnabled'];

const DEFAULT_FEATURES: ClientUser['featuresEnabled'] = {
  analytics: true, heatmaps: true, replays: true, funnels: true, automations: true,
};

const FEATURE_LABELS: Array<{ key: FeatureKey; label: string }> = [
  { key: 'analytics',   label: 'Analytics' },
  { key: 'heatmaps',    label: 'Heatmaps' },
  { key: 'replays',     label: 'Replays' },
  { key: 'funnels',     label: 'Funnels' },
  { key: 'automations', label: 'Automations' },
];

/**
 * The create, reset-password and delete dialogs for client users.
 *
 * Three modals and the temporary-password panel, 280 lines in the route file. Each takes
 * the user it acts on and a callback, so the same dialog can be opened from the list, the
 * detail page, or anywhere else that manages a client user.
 */
export function TempPasswordDisplay({ password }: { password: string }) {
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

export interface CreateClientUserDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}

export function CreateClientUserDialog({ open, onOpenChange, onDone }: CreateClientUserDialogProps) {
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
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-950 border border-green-200 dark:border-green-800 flex items-center justify-center shrink-0">
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

export interface ResetPasswordDialogProps {
  user: ClientUser | null;
  onClose: () => void;
}

export function ResetPasswordDialog({ user, onClose }: ResetPasswordDialogProps) {
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

export interface DeleteConfirmDialogProps {
  user: ClientUser | null;
  onClose: () => void;
  onConfirm: (userId: string) => void;
  isDeleting: boolean;
}

export function DeleteConfirmDialog({ user, onClose, onConfirm, isDeleting }: DeleteConfirmDialogProps) {
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

export interface ClientUserRowProps {
  user: ClientUser;
  onResetPassword: (user: ClientUser) => void;
  onDelete: (user: ClientUser) => void;
}
