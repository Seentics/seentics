'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listAgencyAPIKeys,
  createAgencyAPIKey,
  deleteAgencyAPIKey,
  AgencyAPIKey,
} from '@/lib/agency-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  KeyRound,
  Plus,
  Trash2,
  Copy,
  Check,
  Clock,
  AlertTriangle,
  Loader2,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

// ─── Reveal Dialog ────────────────────────────────────────────────────────────

function RevealDialog({ rawKey, onClose }: { rawKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg bg-card border border-border rounded-lg p-0 gap-0">
        <DialogHeader className="px-6 py-5 border-b border-border">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Check className="h-4 w-4 text-green-500" />
            Agency API Key Created
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Copy this key now. For security reasons, it will not be shown again.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-muted px-3 py-2.5 rounded-lg border border-border text-foreground break-all">
              {rawKey}
            </code>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={copy}>
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Dialog ────────────────────────────────────────────────────────────

interface CreateKeyDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (rawKey: string) => void;
}

function CreateKeyDialog({ open, onOpenChange, onCreated }: CreateKeyDialogProps) {
  const [name, setName] = useState('');

  const mutation = useMutation({
    mutationFn: (n: string) => createAgencyAPIKey(n),
    onSuccess: (key) => {
      if (key.key) {
        onCreated(key.key);
      } else {
        toast.success('API key created');
      }
      setName('');
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create API key');
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setName(''); }}>
      <DialogContent className="max-w-md bg-card border border-border rounded-lg p-0 gap-0">
        <DialogHeader className="px-6 py-5 border-b border-border">
          <DialogTitle className="text-base font-semibold">Create Agency API Key</DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Key Name</Label>
            <Input
              placeholder="e.g. Dashboard Integration"
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-9 text-sm"
              onKeyDown={e => { if (e.key === 'Enter' && name.trim() && !mutation.isPending) mutation.mutate(name.trim()); }}
            />
            <p className="text-[11px] text-muted-foreground">A descriptive name to identify where this key is used.</p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => mutation.mutate(name.trim())}
              disabled={!name.trim() || mutation.isPending}
            >
              {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Create Key
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgencyAPIKeysPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [revealKey, setRevealKey]   = useState<string | null>(null);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['agency-api-keys'],
    queryFn: listAgencyAPIKeys,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAgencyAPIKey(id),
    onSuccess: () => {
      toast.success('API key deleted');
      queryClient.invalidateQueries({ queryKey: ['agency-api-keys'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete API key');
    },
  });

  const handleDelete = (key: AgencyAPIKey) => {
    if (!confirm(`Delete API key "${key.name}"? Any integrations using it will stop working.`)) return;
    deleteMutation.mutate(key.id);
  };

  const handleCreated = (rawKey: string) => {
    queryClient.invalidateQueries({ queryKey: ['agency-api-keys'] });
    setRevealKey(rawKey);
  };

  const recentlyUsed = keys.filter(k => k.lastUsed).length;

  return (
    <div className="p-6 max-w-[900px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Agency API Keys</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Global keys for programmatic access to the agency API.
          </p>
        </div>
        <Button size="sm" className="h-9 gap-1.5" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5" />
          New Key
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Total Keys',     value: keys.length,  icon: KeyRound, color: 'text-foreground' },
          { label: 'Recently Used',  value: recentlyUsed, icon: Activity, color: 'text-green-600' },
        ].map(s => (
          <Card key={s.label} className="border border-border/60">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={cn('h-5 w-5 shrink-0', s.color)} />
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Keys list */}
      <Card className="border border-border/60">
        <CardHeader className="px-5 py-4 border-b border-border/40">
          <CardTitle className="text-sm font-semibold">Keys</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : keys.length === 0 ? (
            <div className="py-16 text-center">
              <KeyRound className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No agency API keys yet.</p>
              <Button size="sm" className="mt-4 gap-1.5" onClick={() => setShowCreate(true)}>
                <Plus className="h-3.5 w-3.5" />
                Create Your First Key
              </Button>
            </div>
          ) : (
            keys.map(key => (
              <div
                key={key.id}
                className="flex items-start gap-4 px-5 py-4 border-b border-border/40 last:border-0"
              >
                <div className="mt-2 h-2 w-2 rounded-lg-full shrink-0 bg-green-500" />

                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className="text-sm font-semibold text-foreground">{key.name}</p>

                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-lg">
                      {key.keyPrefix}…
                    </code>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Created {key.createdAt ? format(new Date(key.createdAt), 'MMM d, yyyy') : '—'}
                    </span>
                    {key.lastUsed ? (
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <Activity className="h-3 w-3" />
                        Last used {timeAgo(key.lastUsed)}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 opacity-60">Never used</span>
                    )}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0 mt-0.5"
                  onClick={() => handleDelete(key)}
                  disabled={deleteMutation.isPending}
                  title="Delete key"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Usage note */}
      <Card className="border border-border/60">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            Usage
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Pass your agency API key in the{' '}
            <code className="font-mono bg-muted px-1 py-0.5 rounded-lg">Authorization</code> header:
          </p>
          <pre className="text-xs font-mono bg-muted/60 border border-border/60 rounded-lg px-4 py-3 text-foreground overflow-x-auto">
{`curl https://api.seentics.com/v1/agency/clients \\
  -H "Authorization: Bearer <your-agency-key>" \\
  -H "Content-Type: application/json"`}
          </pre>
        </CardContent>
      </Card>

      <CreateKeyDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={handleCreated}
      />

      {revealKey && (
        <RevealDialog
          rawKey={revealKey}
          onClose={() => setRevealKey(null)}
        />
      )}
    </div>
  );
}
