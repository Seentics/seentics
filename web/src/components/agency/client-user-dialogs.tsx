'use client';

import { useEffect, useState } from 'react';
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
} from '@/features/agency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { demoMutationGuard } from '@/lib/demo';
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
  /** The website the page was reached under; the demo website refuses the write. */
  websiteId?: string;
  /** Prefill from a client, when the login is for one that already exists. */
  initial?: { name: string; email: string; company?: string } | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}

export function CreateClientUserDialog({ websiteId, initial, open, onOpenChange, onDone }: CreateClientUserDialogProps) {
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

  useEffect(() => {
    if (open && initial) {
      setName(initial.name);
      setEmail(initial.email);
      setCompany(initial.company ?? '');
    }
  }, [open, initial]);

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
    if (websiteId && demoMutationGuard(websiteId)) return;
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
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader className="bg-card">
            <SheetTitle>Account created</SheetTitle>
            <SheetDescription>Send these details to your client.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-3 overflow-y-auto bg-muted/40 p-4">
            <div className="space-y-3 rounded-lg border bg-card p-3.5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <Check className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{result.user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{result.user.email}</p>
                </div>
              </div>
              {result.tempPassword && (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground">Temporary password</p>
                  <TempPasswordDisplay password={result.tempPassword} />
                </div>
              )}
            </div>
          </div>
          <SheetFooter className="bg-card pr-20">
            <Button size="sm" onClick={() => handleClose(false)}>Done</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  // ── Create form ────────────────────────────────────────────────────────────
  const field = 'h-8 !bg-card text-xs';
  const box = 'space-y-3 rounded-lg border bg-card p-3.5 shadow-sm';
  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader className="bg-card">
          <SheetTitle>Create client account</SheetTitle>
          <SheetDescription>A login that lets a client see only their own dashboard.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto bg-muted/40 p-4">
          <div className={box}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Full name <span className="text-destructive">*</span></Label>
                <Input placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} className={field} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Company</Label>
                <Input placeholder="Acme Corp" value={company} onChange={e => setCompany(e.target.value)} className={field} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email <span className="text-destructive">*</span></Label>
              <Input type="email" placeholder="jane@acme.com" value={email} onChange={e => setEmail(e.target.value)} className={field} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Password</Label>
              <Input
                type="password"
                placeholder="Leave empty to generate one"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={field}
              />
            </div>
          </div>

          <div className={box}>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Access</h4>
              <p className="text-[11px] text-muted-foreground">What this person can open.</p>
            </div>
            <ul className="divide-y divide-border rounded-md border bg-muted/20">
              {FEATURE_LABELS.map(({ key, label }) => (
                <li key={key} className="flex items-center justify-between px-3 py-2">
                  <span className="text-[13px] text-foreground">{label}</span>
                  <Switch
                    className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
                    checked={features[key]}
                    onCheckedChange={() => toggleFeature(key)}
                    aria-label={label}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <SheetFooter className="bg-card pr-20">
          <Button variant="outline" size="sm" onClick={() => handleClose(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!name.trim() || !email.trim() || mutation.isPending}>
            {mutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            Create account
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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
