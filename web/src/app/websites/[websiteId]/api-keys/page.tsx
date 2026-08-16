'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  KeyRound, Plus, Copy, Eye, EyeOff, Trash2, Check,
  Clock, Shield, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ApiKey {
  id:         string;
  name:       string;
  prefix:     string;
  created_at: string;
  last_used:  string | null;
  scopes:     string[];
  is_active:  boolean;
}

const DEMO_KEYS: ApiKey[] = [
  {
    id: 'k1',
    name: 'Production Ingest',
    prefix: 'snt_prod_a1b2c3',
    created_at: new Date(Date.now() - 1000*60*60*24*30).toISOString(),
    last_used: new Date(Date.now() - 1000*60*4).toISOString(),
    scopes: ['ingest:write', 'analytics:read'],
    is_active: true,
  },
  {
    id: 'k2',
    name: 'CI/CD Checks',
    prefix: 'snt_ci_d4e5f6',
    created_at: new Date(Date.now() - 1000*60*60*24*14).toISOString(),
    last_used: new Date(Date.now() - 1000*60*60*2).toISOString(),
    scopes: ['analytics:read'],
    is_active: true,
  },
  {
    id: 'k3',
    name: 'Legacy Dashboard',
    prefix: 'snt_leg_g7h8i9',
    created_at: new Date(Date.now() - 1000*60*60*24*90).toISOString(),
    last_used: new Date(Date.now() - 1000*60*60*24*7).toISOString(),
    scopes: ['analytics:read', 'events:write'],
    is_active: false,
  },
];

const SCOPE_LABELS: Record<string, { label: string; color: string }> = {
  'ingest:write':    { label: 'Ingest Write',    color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300' },
  'analytics:read':  { label: 'Analytics Read',  color: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300' },
  'events:write':    { label: 'Events Write',    color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300' },
  'errors:write':    { label: 'Errors Write',    color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300' },
  'admin':           { label: 'Admin',           color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300' },
};

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function NewKeyDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (key: ApiKey, secret: string) => void;
}) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['ingest:write']);

  const allScopes = ['ingest:write', 'analytics:read', 'events:write', 'errors:write'];

  const toggle = (s: string) =>
    setScopes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const create = () => {
    if (!name.trim()) return;
    const secret = `snt_${Math.random().toString(36).slice(2, 10)}_${Math.random().toString(36).slice(2, 18)}`;
    const key: ApiKey = {
      id: `k${Date.now()}`,
      name: name.trim(),
      prefix: secret.slice(0, 14) + '...',
      created_at: new Date().toISOString(),
      last_used: null,
      scopes,
      is_active: true,
    };
    onCreated(key, secret);
    setName('');
    setScopes(['ingest:write']);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border border-border rounded-lg p-0 gap-0">
        <DialogHeader className="px-6 py-5 border-b border-border">
          <DialogTitle className="text-base font-semibold">Create API Key</DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Key Name</Label>
            <Input
              placeholder="e.g. Production Backend"
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Permissions</Label>
            <div className="space-y-2">
              {allScopes.map(s => (
                <label key={s} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={scopes.includes(s)}
                    onChange={() => toggle(s)}
                    className="rounded-lg border-border accent-primary h-4 w-4"
                  />
                  <span className="text-sm text-foreground">{SCOPE_LABELS[s]?.label ?? s}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" onClick={create} disabled={!name.trim() || scopes.length === 0}>
              Create Key
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RevealDialog({ secret, onClose }: { secret: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg bg-card border border-border rounded-lg p-0 gap-0">
        <DialogHeader className="px-6 py-5 border-b border-border">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Check className="h-4 w-4 text-green-500" />
            API Key Created
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Copy this key now. It will not be shown again for security reasons.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-muted px-3 py-2.5 rounded-lg border border-border text-foreground break-all">
              {secret}
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

export default function ApiKeysPage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;
  const { toast } = useToast();

  const [keys, setKeys] = useState<ApiKey[]>(DEMO_KEYS);
  const [showNew, setShowNew] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const copyPrefix = async (prefix: string) => {
    await navigator.clipboard.writeText(prefix);
    toast({ title: 'Copied to clipboard' });
  };

  const deleteKey = (id: string) => {
    if (!confirm('Delete this API key? This cannot be undone.')) return;
    setKeys(prev => prev.filter(k => k.id !== id));
    toast({ title: 'Key deleted' });
  };

  const revokeKey = (id: string) => {
    setKeys(prev => prev.map(k => k.id === id ? { ...k, is_active: false } : k));
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[900px] mx-auto">
      <DashboardPageHeader
        websiteId={websiteId}
        title="API Keys"
        description="Manage authentication keys for the Seentics Ingest & Analytics APIs."
      >
        <Button size="sm" className="h-8 gap-1.5" onClick={() => setShowNew(true)}>
          <Plus className="h-3.5 w-3.5" />
          New Key
        </Button>
      </DashboardPageHeader>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Keys',  value: keys.length,                         icon: KeyRound, color: 'text-foreground' },
          { label: 'Active',      value: keys.filter(k => k.is_active).length, icon: Shield,   color: 'text-green-600' },
          { label: 'Revoked',     value: keys.filter(k => !k.is_active).length, icon: AlertTriangle, color: 'text-muted-foreground' },
        ].map(s => (
          <Card key={s.label} className="border border-border">
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

      {/* Keys table */}
      <Card className="border border-border">
        <CardHeader className="px-5 py-4 border-b border-border">
          <CardTitle className="text-sm font-semibold">Keys</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {keys.length === 0 ? (
            <div className="py-16 text-center">
              <KeyRound className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No API keys yet.</p>
            </div>
          ) : (
            keys.map(key => (
              <div key={key.id} className={cn(
                'flex items-start gap-4 px-5 py-4 border-b border-border/60 last:border-0',
                !key.is_active && 'opacity-50',
              )}>
                {/* Status dot */}
                <div className={cn(
                  'mt-1.5 h-2 w-2 rounded-lg-full shrink-0',
                  key.is_active ? 'bg-green-500' : 'bg-muted-foreground/40',
                )} />

                {/* Key info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">{key.name}</span>
                    {!key.is_active && (
                      <Badge className="text-[10px] px-1.5 py-0 h-4 bg-muted text-muted-foreground border border-border">
                        revoked
                      </Badge>
                    )}
                  </div>

                  {/* Key prefix */}
                  <div className="flex items-center gap-2 mb-2">
                    <code className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-lg">
                      {key.prefix}
                    </code>
                    <button
                      onClick={() => copyPrefix(key.prefix)}
                      className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Scopes */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {key.scopes.map(s => (
                      <Badge
                        key={s}
                        className={cn('text-[10px] px-1.5 py-0 h-4 border rounded-lg font-normal', SCOPE_LABELS[s]?.color)}
                      >
                        {SCOPE_LABELS[s]?.label ?? s}
                      </Badge>
                    ))}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Created {timeAgo(key.created_at)}
                    </span>
                    {key.last_used && (
                      <span>Last used {timeAgo(key.last_used)}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {key.is_active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground"
                      onClick={() => revokeKey(key.id)}
                    >
                      Revoke
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => deleteKey(key.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Base URL reference */}
      <Card className="border border-border mt-4">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Usage
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Pass your API key in the <code className="font-mono bg-muted px-1 py-0.5 rounded-lg">Authorization</code> header:
          </p>
          <pre className="text-xs font-mono bg-muted/60 border border-border rounded-lg px-4 py-3 text-foreground overflow-x-auto">
{`curl https://api.seentics.com/v1/ingest \\
  -H "Authorization: Bearer snt_prod_..." \\
  -H "Content-Type: application/json" \\
  -d '{"project_id":"${websiteId}","events":[...]}'`}
          </pre>
        </CardContent>
      </Card>

      <NewKeyDialog
        open={showNew}
        onOpenChange={setShowNew}
        onCreated={(key, secret) => {
          setKeys(prev => [key, ...prev]);
          setNewSecret(secret);
        }}
      />
      {newSecret && <RevealDialog secret={newSecret} onClose={() => setNewSecret(null)} />}
    </div>
  );
}
