'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { AlertTriangle, Check, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import type { AccountScope } from '@/features/agency/types';
import { isDemoRefusal, useAgencyAPIKeys, useCreateAPIKey, useDeleteAPIKey } from '@/features/agency/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CopyButton } from '@/components/agency/CopyButton';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';

const ACCESS: Array<{ id: 'write' | 'read'; label: string; description: string; scopes: AccountScope[] }> = [
  {
    id: 'write',
    label: 'Read & write',
    description: 'Create, update and delete clients and websites — what a signup handler needs.',
    scopes: ['websites:read', 'websites:write'],
  },
  {
    id: 'read',
    label: 'Read only',
    description: 'List clients and websites and fetch tracking snippets.',
    scopes: ['websites:read'],
  },
];

export function CreateAccountKeyDialog({ websiteId, open, onOpenChange }: {
  websiteId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [access, setAccess] = useState<'write' | 'read'>('write');
  const [secret, setSecret] = useState<string | null>(null);
  const create = useCreateAPIKey(websiteId);

  const submit = () =>
    create.mutate({ name: name.trim(), scopes: ACCESS.find(a => a.id === access)!.scopes }, {
      onSuccess: key => { setSecret(key.key ?? null); setName(''); onOpenChange(false); },
      onError: e => { if (!isDemoRefusal(e)) toast.error((e as Error).message || 'Failed to create key'); },
    });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New account key</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input placeholder="e.g. Signup handler" value={name} onChange={e => setName(e.target.value)} className="h-9 text-sm" autoFocus />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Access</Label>
              {ACCESS.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAccess(a.id)}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
                    access === a.id ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground/30',
                  )}
                >
                  <p className="text-sm font-medium">{a.label}</p>
                  <p className="text-xs text-muted-foreground">{a.description}</p>
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button size="sm" onClick={submit} disabled={!name.trim() || create.isPending}>
                {create.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                Create key
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!secret} onOpenChange={v => !v && setSecret(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" />
              Key created
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Copy it now — it is never shown again. Keep it on your server; it can create and delete your sites.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-lg border border-border bg-muted px-3 py-2.5 font-mono text-xs">{secret}</code>
              <CopyButton text={secret ?? ''} />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setSecret(null)}>Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Account-level keys for the management API, as a table of rows. */
export function AccountKeysList({ websiteId, onCreate }: { websiteId: string; onCreate: () => void }) {
  const { data: keys = [], isLoading } = useAgencyAPIKeys(websiteId);
  const revoke = useDeleteAPIKey(websiteId);
  const [confirm, confirmDialog] = useConfirm();

  if (isLoading) {
    return (
      <div className="space-y-3 p-5">
        {[0, 1].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
      </div>
    );
  }

  if (keys.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
          <KeyRound className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">No account keys yet</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Create one to provision clients and websites from your own backend.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={onCreate}>
          <Plus className="h-3.5 w-3.5" />
          Create your first key
        </Button>
      </div>
    );
  }

  return (
    <>
    {confirmDialog}
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border/60 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <th className="px-5 py-3 font-medium">Name</th>
          <th className="px-5 py-3 font-medium">Key</th>
          <th className="px-5 py-3 font-medium">Access</th>
          <th className="px-5 py-3 font-medium">Last used</th>
          <th className="px-5 py-3 font-medium">Created</th>
          <th className="w-14 px-5 py-3" />
        </tr>
      </thead>
      <tbody className="divide-y divide-border/60">
        {keys.map(key => {
          const write = key.scopes.includes('websites:write');
          return (
            <tr key={key.id} className="hover:bg-muted/35">
              <td className="px-5 py-3.5 font-medium text-foreground">{key.name}</td>
              <td className="px-5 py-3.5">
                <code className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">{key.keyPrefix}…</code>
              </td>
              <td className="px-5 py-3.5">
                <span className={cn(
                  'rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
                  write
                    ? 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400'
                    : 'border-border bg-muted text-muted-foreground',
                )}>
                  {write ? 'Read & write' : 'Read only'}
                </span>
              </td>
              <td className="px-5 py-3.5 text-muted-foreground">
                {key.lastUsed ? formatDistanceToNow(new Date(key.lastUsed), { addSuffix: true }) : 'Never'}
              </td>
              <td className="px-5 py-3.5 text-muted-foreground">{format(new Date(key.createdAt), 'MMM d, yyyy')}</td>
              <td className="px-5 py-3.5 text-right">
                <Button
                  variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  title="Revoke key"
                  disabled={revoke.isPending}
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Revoke "${key.name}"?`,
                      description: 'Anything still using this key stops working immediately. This cannot be undone.',
                      confirmLabel: 'Revoke key',
                      destructive: true,
                    });
                    if (!ok) return;
                    revoke.mutate(key.id, {
                      onSuccess: () => toast.success('Key revoked'),
                      onError: e => { if (!isDemoRefusal(e)) toast.error((e as Error).message); },
                    });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </>
  );
}
