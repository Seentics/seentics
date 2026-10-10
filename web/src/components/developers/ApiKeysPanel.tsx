'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Check, Copy, KeyRound, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  useApiKeys,
  useApiScopes,
  useCreateApiKey,
  useRevokeApiKey,
  type ApiKey,
  type CreatedApiKey,
} from '@/features/api-keys';

/**
 * API keys, for the developer settings tab.
 *
 * The scope list comes from the server so the form cannot offer a scope the backend
 * would reject — the previous version of this screen offered four that did not exist.
 */

function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access is denied in some embedded contexts; say so rather than
      // showing a success state for something that did not happen.
      toast({ title: 'Could not copy', description: 'Select the text and copy it manually.' });
    }
  };

  return (
    <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={copy}>
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : label}
    </Button>
  );
}

/** The one and only sight of a secret. */
function SecretDialog({ apiKey, onClose }: { apiKey: CreatedApiKey; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Copy your API key</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
              This is the only time we can show you this key. We store a hash of it, not the key
              itself, so it cannot be retrieved later — if you lose it, revoke this one and
              create another.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">{apiKey.name}</Label>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-muted px-3 py-2 font-mono text-xs">
                {apiKey.secret}
              </code>
              <CopyButton value={apiKey.secret} />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {apiKey.scopes.map(s => (
              <Badge key={s} variant="secondary" className="font-mono text-[10px]">{s}</Badge>
            ))}
          </div>
        </div>

        <Button className="mt-2 w-full" onClick={onClose}>I have saved it</Button>
      </DialogContent>
    </Dialog>
  );
}

function CreateKeyDialog({
  websiteId, onCreated, onClose,
}: { websiteId: string; onCreated: (k: CreatedApiKey) => void; onClose: () => void }) {
  const { data: scopes, isLoading } = useApiScopes();
  const create = useCreateApiKey(websiteId);
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>(['analytics:read']);

  const toggle = (scope: string) =>
    setSelected(s => (s.includes(scope) ? s.filter(x => x !== scope) : [...s, scope]));

  const submit = async () => {
    try {
      const key = await create.mutateAsync({ name: name.trim(), scopes: selected });
      onCreated(key);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Please try again.';
      toast({ title: 'Could not create the key', description: message });
    }
  };

  const canSubmit = name.trim().length > 0 && selected.length > 0 && !create.isPending;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New API key</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="key-name" className="text-xs">Name</Label>
            <Input
              id="key-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Grafana dashboard"
              maxLength={80}
            />
            <p className="text-[11px] text-muted-foreground">
              For your own reference — it appears in this list, never in a request.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Scopes</Label>
            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {(scopes ?? []).map(s => {
                  const on = selected.includes(s.scope);
                  return (
                    <button
                      key={s.scope}
                      type="button"
                      onClick={() => toggle(s.scope)}
                      aria-pressed={on}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                        on ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                          on ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                        )}
                        aria-hidden
                      >
                        {on && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-mono text-xs font-semibold text-foreground">{s.scope}</span>
                        <span className="block text-[11px] text-muted-foreground">{s.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {selected.length === 0 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">Choose at least one scope.</p>
            )}
          </div>
        </div>

        <Button className="mt-2 w-full" onClick={submit} disabled={!canSubmit}>
          {create.isPending ? 'Creating…' : 'Create key'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One website's read-only keys, as a card matching the account keys above it: title,
 * the site picker and New key in one header row, then a table.
 */
export function WebsiteKeysCard({ websiteId, sitePicker }: { websiteId: string; sitePicker: React.ReactNode }) {
  const { data: keys, isLoading } = useApiKeys(websiteId);
  const revoke = useRevokeApiKey(websiteId);
  const [confirm, confirmDialog] = useConfirm();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState<CreatedApiKey | null>(null);

  const remove = async (apiKey: ApiKey) => {
    const ok = await confirm({
      title: `Revoke "${apiKey.name}"?`,
      description: 'Requests using this key are rejected from now on. This cannot be undone.',
      confirmLabel: 'Revoke key',
      destructive: true,
    });
    if (!ok) return;
    try {
      await revoke.mutateAsync(apiKey.id);
      toast({ title: 'Key revoked', description: 'Requests using it will now be rejected.' });
    } catch {
      toast({ title: 'Could not revoke the key', description: 'Please try again.' });
    }
  };

  return (
    <section className="surface overflow-hidden">
      {confirmDialog}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Website keys</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Analytics API — read one website&apos;s data. Scoped, so a reporting key cannot read recordings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sitePicker}
          <Button size="sm" className="h-8 gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5" />
            New key
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3 p-5">
          {[0, 1].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </div>
      ) : !keys?.length ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
            <KeyRound className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground">No keys for this website</p>
          <p className="max-w-sm text-xs text-muted-foreground">Create one to read its data from your own tools.</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Key</th>
              <th className="px-5 py-3 font-medium">Scopes</th>
              <th className="px-5 py-3 font-medium">Last used</th>
              <th className="px-5 py-3 font-medium">Created</th>
              <th className="w-14 px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {keys.map(k => (
              <tr key={k.id} className="hover:bg-muted/35">
                <td className="px-5 py-3.5 font-medium text-foreground">{k.name}</td>
                <td className="px-5 py-3.5">
                  <code className="font-mono text-[13px] text-muted-foreground">{k.prefix}…</code>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex flex-wrap gap-1">
                    {k.scopes.map(s => (
                      <span key={s} className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground/70">{s}</span>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">
                  {k.last_used_at ? formatDistanceToNow(new Date(k.last_used_at), { addSuffix: true }) : 'Never'}
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">{format(new Date(k.created_at), 'MMM d, yyyy')}</td>
                <td className="px-5 py-3.5 text-right">
                  <Button
                    variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    title="Revoke key" disabled={revoke.isPending} onClick={() => remove(k)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreate && (
        <CreateKeyDialog
          websiteId={websiteId}
          onClose={() => setShowCreate(false)}
          onCreated={k => { setShowCreate(false); setNewKey(k); }}
        />
      )}
      {newKey && <SecretDialog apiKey={newKey} onClose={() => setNewKey(null)} />}
    </section>
  );
}
