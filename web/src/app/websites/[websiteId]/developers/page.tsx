'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { apiKeysAPI, type APIKey } from '@/lib/apikeys-api';
import {
  Code2, KeyRound, Layers, BookOpen, Plus, Copy, Check,
  Clock, Shield, AlertTriangle, Zap,
} from 'lucide-react';

const SCOPE_LABELS: Record<string, { label: string; color: string }> = {
  'ingest:write':   { label: 'Ingest Write',   color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300' },
  'analytics:read': { label: 'Analytics Read', color: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300' },
  'events:write':   { label: 'Events Write',   color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300' },
  'errors:write':   { label: 'Errors Write',   color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300' },
  'admin':          { label: 'Admin',           color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300' },
};

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── New Key Dialog ───────────────────────────────────────────────────────────

function NewKeyDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (name: string, scopes: string[]) => void;
}) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['ingest:write']);
  const allScopes = ['ingest:write', 'analytics:read', 'events:write', 'errors:write'];
  const toggle = (s: string) =>
    setScopes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const create = () => {
    if (!name.trim()) return;
    onCreated(name.trim(), scopes);
    setName(''); setScopes(['ingest:write']); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border border-border rounded-xl p-0 gap-0">
        <DialogHeader className="px-6 py-5 border-b border-border">
          <DialogTitle className="text-base font-semibold">Create API Key</DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Key Name</Label>
            <Input placeholder="e.g. Production Backend" value={name}
              onChange={e => setName(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Permissions</Label>
            <div className="space-y-2">
              {allScopes.map(s => (
                <label key={s} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggle(s)}
                    className="rounded border-border accent-primary h-4 w-4" />
                  <span className="text-sm text-foreground">{SCOPE_LABELS[s]?.label ?? s}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" onClick={create} disabled={!name.trim() || scopes.length === 0}>Create Key</Button>
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
      <DialogContent className="max-w-lg bg-card border border-border rounded-xl p-0 gap-0">
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

// ─── API Keys Tab ─────────────────────────────────────────────────────────────

function ApiKeysTab({ websiteId }: { websiteId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['apikeys', websiteId],
    queryFn: () => apiKeysAPI.list(websiteId),
    enabled: !!websiteId,
  });

  const createMutation = useMutation({
    mutationFn: ({ name, scopes }: { name: string; scopes: string[] }) =>
      apiKeysAPI.create(websiteId, name, scopes),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['apikeys', websiteId] });
      if (result.key) setNewSecret(result.key);
    },
    onError: () => toast({ title: 'Failed to create API key', variant: 'destructive' }),
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => apiKeysAPI.revoke(websiteId, keyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apikeys', websiteId] });
      toast({ title: 'Key revoked' });
    },
    onError: () => toast({ title: 'Failed to revoke key', variant: 'destructive' }),
  });

  const copyPrefix = async (prefix: string) => {
    await navigator.clipboard.writeText(prefix);
    toast({ title: 'Copied to clipboard' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">API Keys</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage authentication keys for the Seentics Ingest &amp; Analytics APIs.
          </p>
        </div>
        <Button size="sm" className="h-8 gap-1.5" onClick={() => setShowNew(true)}>
          <Plus className="h-3.5 w-3.5" />
          New Key
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Keys', value: keys.length,                            icon: KeyRound,      color: 'text-foreground' },
          { label: 'Active',     value: keys.filter(k => k.isActive).length,    icon: Shield,        color: 'text-green-600' },
          { label: 'Revoked',    value: keys.filter(k => !k.isActive).length,   icon: AlertTriangle, color: 'text-muted-foreground' },
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
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : keys.length === 0 ? (
            <div className="py-16 text-center">
              <KeyRound className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No API keys yet.</p>
            </div>
          ) : keys.map(key => (
            <div key={key.id} className={cn(
              'flex items-start gap-4 px-5 py-4 border-b border-border/40 last:border-0',
              !key.isActive && 'opacity-50',
            )}>
              <div className={cn(
                'mt-1.5 h-2 w-2 rounded-full shrink-0',
                key.isActive ? 'bg-green-500' : 'bg-muted-foreground/40',
              )} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-foreground">{key.name}</span>
                  {!key.isActive && (
                    <Badge className="text-[10px] px-1.5 py-0 h-4 bg-muted text-muted-foreground border border-border">revoked</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <code className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{key.keyPrefix}...</code>
                  <button onClick={() => copyPrefix(key.keyPrefix)} className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {key.scopes.map(s => (
                    <Badge key={s} className={cn('text-[10px] px-1.5 py-0 h-4 border rounded font-normal', SCOPE_LABELS[s]?.color)}>
                      {SCOPE_LABELS[s]?.label ?? s}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Created {timeAgo(key.createdAt)}</span>
                  {key.lastUsedAt && <span>Last used {timeAgo(key.lastUsedAt)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {key.isActive && (
                  <Button
                    variant="ghost" size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={() => revokeMutation.mutate(key.id)}
                    disabled={revokeMutation.isPending}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Usage */}
      <Card className="border border-border/60">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Usage
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Pass your API key in the <code className="font-mono bg-muted px-1 py-0.5 rounded">Authorization</code> header:
          </p>
          <pre className="text-xs font-mono bg-muted/60 border border-border/60 rounded-lg px-4 py-3 text-foreground overflow-x-auto">
{`curl https://api.seentics.com/raw/v1/${websiteId}/analytics/dashboard \\
  -H "Authorization: Bearer snc_live_..." \\
  -H "Content-Type: application/json"`}
          </pre>
        </CardContent>
      </Card>

      <NewKeyDialog
        open={showNew}
        onOpenChange={setShowNew}
        onCreated={(name, scopes) => createMutation.mutate({ name, scopes })}
      />
      {newSecret && <RevealDialog secret={newSecret} onClose={() => setNewSecret(null)} />}
    </div>
  );
}

// ─── UI Blocks Tab ────────────────────────────────────────────────────────────

const UI_BLOCKS = [
  {
    id: 'live-badge',
    title: 'Live Visitors Badge',
    category: 'badge',
    description: 'Embeddable badge showing current live visitor count.',
    preview: (
      <div className="flex items-center gap-2 bg-card border border-border/60 rounded-lg px-3 py-2 w-fit">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-xs font-semibold text-foreground">142 live</span>
      </div>
    ),
    code: `<script src="https://cdn.seentics.com/widgets/live-badge.js"
  data-website-id="YOUR_WEBSITE_ID">
</script>`,
  },
  {
    id: 'pageviews-badge',
    title: 'Page Views Counter',
    category: 'badge',
    description: 'Shows total page views for today or a selected period.',
    preview: (
      <div className="flex items-center gap-2 bg-card border border-border/60 rounded-lg px-3 py-2 w-fit">
        <span className="text-xs text-muted-foreground">Views today</span>
        <span className="text-sm font-bold text-primary">12,483</span>
      </div>
    ),
    code: `<script src="https://cdn.seentics.com/widgets/pageviews.js"
  data-website-id="YOUR_WEBSITE_ID"
  data-period="today">
</script>`,
  },
  {
    id: 'sparkline',
    title: 'Traffic Sparkline',
    category: 'chart',
    description: 'Compact 7-day sparkline chart for traffic trends.',
    preview: (
      <div className="flex items-end gap-0.5 h-8">
        {[3, 5, 4, 7, 6, 8, 9].map((h, i) => (
          <div key={i} className="w-3 bg-primary/80 rounded-sm" style={{ height: `${h * 10}%` }} />
        ))}
      </div>
    ),
    code: `<script src="https://cdn.seentics.com/widgets/sparkline.js"
  data-website-id="YOUR_WEBSITE_ID"
  data-days="7">
</script>`,
  },
  {
    id: 'stats-widget',
    title: 'Stats Widget',
    category: 'widget',
    description: 'Compact stats card with visitors, pageviews, and bounce rate.',
    preview: (
      <div className="grid grid-cols-3 gap-2">
        {[{ l: 'Visitors', v: '8.4k' }, { l: 'Views', v: '23.1k' }, { l: 'Bounce', v: '41%' }].map(s => (
          <div key={s.l} className="text-center">
            <p className="text-xs font-bold text-foreground">{s.v}</p>
            <p className="text-[10px] text-muted-foreground">{s.l}</p>
          </div>
        ))}
      </div>
    ),
    code: `<script src="https://cdn.seentics.com/widgets/stats.js"
  data-website-id="YOUR_WEBSITE_ID">
</script>`,
  },
];

function UIBlocksTab({ websiteId }: { websiteId: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const categories = ['all', 'badge', 'chart', 'widget', 'embed'];
  const filtered = UI_BLOCKS.filter(b =>
    (category === 'all' || b.category === category) &&
    (!search || b.title.toLowerCase().includes(search.toLowerCase()))
  );

  const copy = async (id: string, code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-foreground">UI Blocks</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Embeddable widgets to display analytics data on any website.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Input placeholder="Search blocks..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs w-44" />
        </div>
        <div className="flex items-center gap-1.5">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                'px-3 py-1 text-xs rounded-md font-medium capitalize transition-colors',
                category === c
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(block => (
          <Card key={block.id} className="border border-border/60">
            <CardHeader className="px-5 py-4 border-b border-border/40 flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">{block.title}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{block.description}</p>
              </div>
              <Badge variant="outline" className="text-[10px] capitalize shrink-0">{block.category}</Badge>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* Preview */}
              <div className="bg-muted/30 border border-border/40 rounded-lg p-4 flex items-center justify-center min-h-[60px]">
                {block.preview}
              </div>
              {/* Code */}
              <div className="relative group">
                <pre className="bg-muted/60 border border-border/40 rounded-lg px-4 py-3 text-[11px] font-mono text-foreground/80 overflow-x-auto whitespace-pre">
                  {block.code.replace('YOUR_WEBSITE_ID', websiteId)}
                </pre>
                <button
                  onClick={() => copy(block.id, block.code.replace('YOUR_WEBSITE_ID', websiteId))}
                  className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center rounded bg-background border border-border/60 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {copied === block.id
                    ? <Check className="h-3 w-3 text-green-500" />
                    : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* CDN note */}
      <Card className="border border-border/60 bg-primary/5">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            All widgets are served from <code className="font-mono bg-muted px-1 rounded text-foreground">cdn.seentics.com</code> — no npm install required.
            They respect your site&apos;s theme and are fully responsive.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Docs Tab ─────────────────────────────────────────────────────────────────

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group">
      <pre className="bg-muted/60 border border-border/60 rounded-lg px-4 py-3 overflow-x-auto text-[12px] leading-relaxed font-mono text-foreground/90 whitespace-pre">
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center rounded bg-background border border-border/60 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}

const SDK_TABS = ['Node.js', 'Go'] as const;
type SdkTab = typeof SDK_TABS[number];

const INSTALL: Record<SdkTab, string> = {
  'Node.js': `npm install @seentics/node`,
  'Go':      `go get github.com/seentics/go-sdk`,
};
const QUICKSTART: Record<SdkTab, string> = {
  'Node.js': `import { Seentics } from '@seentics/node';

const seentics = new Seentics({
  apiKey:    'snt_prod_YOUR_KEY',
  projectId: 'YOUR_PROJECT_ID',
  service:   'my-api',
  environment: process.env.NODE_ENV,
});

process.on('SIGTERM', async () => {
  await seentics.close();
  process.exit(0);
});`,
  'Go': `import seentics "github.com/seentics/go-sdk"

client := seentics.New(seentics.Config{
    APIKey:    "snt_prod_YOUR_KEY",
    ProjectID: "YOUR_PROJECT_ID",
    Service:   "my-api",
    Environment: os.Getenv("ENV"),
})
defer client.Shutdown(context.Background())`,
};

function DocsTab({ websiteId }: { websiteId: string }) {
  const [tab, setTab] = useState<SdkTab>('Node.js');

  return (
    <div className="w-full space-y-8">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Documentation</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Integrate Seentics into your services using the official SDKs and REST API.
        </p>
      </div>

      {/* SDK selector */}
      <div className="flex items-center gap-1 bg-muted/40 border border-border/60 rounded-lg p-1 w-fit">
        {SDK_TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 text-xs font-semibold rounded-md transition-colors',
              tab === t
                ? 'bg-background text-foreground shadow-sm border border-border/60'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Credentials callout */}
      <Card className="border border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Code2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-foreground">Your project credentials</p>
              <p className="text-muted-foreground">
                Project ID: <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">{websiteId}</code>
              </p>
              <p className="text-muted-foreground">
                API keys are managed in the <strong>API Keys</strong> tab above.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Installation */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Installation</h3>
        </div>
        <CodeBlock code={INSTALL[tab]} />
      </div>

      {/* Quick start */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Code2 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Quick start</h3>
        </div>
        <CodeBlock code={QUICKSTART[tab]} />
      </div>

      {/* HTTP API reference */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">HTTP API Reference</h3>
        </div>
        <Card className="border border-border/60">
          <CardContent className="p-0">
            {[
              { method: 'POST', path: '/api/v1/collect',                        desc: 'Ingest pageview or custom event' },
              { method: 'GET',  path: '/api/v1/websites/:id/stats',             desc: 'Summary stats (visitors, pageviews, bounce rate)' },
              { method: 'GET',  path: '/api/v1/websites/:id/pageviews',         desc: 'Pageview time series (hour|day|month)' },
              { method: 'GET',  path: '/api/v1/websites/:id/events',            desc: 'Custom event counts and property breakdowns' },
              { method: 'GET',  path: '/api/v1/websites/:id/goals',             desc: 'Goal list with conversion rates' },
              { method: 'GET',  path: '/api/v1/websites/:id/funnels/:funnelId', desc: 'Funnel step-by-step conversion data' },
              { method: 'GET',  path: '/api/v1/websites/:id/realtime',          desc: 'Live active visitor count and current pages' },
            ].map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40 last:border-0">
                <Badge variant="outline" className={cn(
                  'text-[10px] w-12 justify-center shrink-0 font-mono',
                  r.method === 'POST' && 'border-blue-400/60 text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-300',
                  r.method === 'GET'  && 'border-green-400/60 text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-300',
                )}>
                  {r.method}
                </Badge>
                <code className="text-[11px] font-mono text-foreground flex-1 min-w-0 truncate">{r.path}</code>
                <span className="text-xs text-muted-foreground hidden md:block shrink-0 max-w-[260px] truncate">{r.desc}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground mt-3">
          All requests must include <code className="font-mono bg-muted px-1 rounded">Authorization: Bearer &lt;apiKey&gt;</code>.
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DevelopersPage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;

  return (
    <div className="mx-auto w-full max-w-[1200px] p-4 md:p-6 lg:p-8">
      <DashboardPageHeader
        title="Developers"
        description="API keys, embeddable widgets, and SDK documentation."
      />

      <Tabs defaultValue="api-keys">
        <TabsList className="mb-6">
          <TabsTrigger value="api-keys" className="gap-1.5">
            <KeyRound className="h-3.5 w-3.5" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="ui-blocks" className="gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            UI Blocks
          </TabsTrigger>
          <TabsTrigger value="docs" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Docs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys">
          <ApiKeysTab websiteId={websiteId} />
        </TabsContent>

        <TabsContent value="ui-blocks">
          <UIBlocksTab websiteId={websiteId} />
        </TabsContent>

        <TabsContent value="docs">
          <DocsTab websiteId={websiteId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
