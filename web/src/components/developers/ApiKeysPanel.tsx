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
import {
  useApiKeys,
  useApiScopes,
  useCreateApiKey,
  useRevokeApiKey,
  type ApiKey,
  type CreatedApiKey,
} from '@/lib/api-keys-api';

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

function KeyRow({ websiteId, apiKey }: { websiteId: string; apiKey: ApiKey }) {
  const revoke = useRevokeApiKey(websiteId);
  const { toast } = useToast();

  const remove = async () => {
    try {
      await revoke.mutateAsync(apiKey.id);
      toast({ title: 'Key revoked', description: 'Requests using it will now be rejected.' });
    } catch {
      toast({ title: 'Could not revoke the key', description: 'Please try again.' });
    }
  };

  return (
    <div className="flex items-center gap-4 border-b border-border p-4 last:border-b-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <KeyRound className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{apiKey.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <code className="font-mono">{apiKey.prefix}…</code>
          <span>Created {new Date(apiKey.created_at).toLocaleDateString()}</span>
          <span>
            {apiKey.last_used_at
              ? `Last used ${new Date(apiKey.last_used_at).toLocaleDateString()}`
              : 'Never used'}
          </span>
        </div>
      </div>

      <div className="hidden flex-wrap gap-1 sm:flex">
        {apiKey.scopes.map(s => (
          <Badge key={s} variant="secondary" className="font-mono text-[10px]">{s}</Badge>
        ))}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={remove}
        disabled={revoke.isPending}
        className="h-8 gap-1.5 text-xs text-red-500 hover:bg-red-500/10 hover:text-red-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Revoke
      </Button>
    </div>
  );
}


export function ApiKeysPanel({ websiteId }: { websiteId: string }) {
  const { data: keys, isLoading } = useApiKeys(websiteId);
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState<CreatedApiKey | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
          A key lets a script or another dashboard read this site&apos;s data. Each key carries
          scopes, so a key built for traffic reporting cannot read session replays.
        </p>
        <Button size="sm" className="h-8 shrink-0 gap-1.5" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5" />
          New key
        </Button>
      </div>

      <div className="surface overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {[0, 1].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : !keys?.length ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <KeyRound className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No API keys yet</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Create one to start reading this site&apos;s data from your own tools.
              </p>
            </div>
            <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5" />
              Create your first key
            </Button>
          </div>
        ) : (
          keys.map(k => <KeyRow key={k.id} websiteId={websiteId} apiKey={k} />)
        )}
      </div>

      {showCreate && (
        <CreateKeyDialog
          websiteId={websiteId}
          onClose={() => setShowCreate(false)}
          onCreated={k => { setShowCreate(false); setNewKey(k); }}
        />
      )}

      {newKey && <SecretDialog apiKey={newKey} onClose={() => setNewKey(null)} />}
    </div>
  );
}
