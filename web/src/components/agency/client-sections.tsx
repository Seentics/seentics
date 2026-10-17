'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Activity,
  Bot,
  Bug,
  Flame,
  GitBranch,
  Globe,
  KeyRound,
  Link2,
  Loader2,
  Plus,
  Trash2,
  UserPlus,
  Video,
} from 'lucide-react';
import {
  createPortalLink,
  revokePortalLink,
  type AgencyClient,
  type AgencyClientFeatures,
  type ClientLimits,
  type PortalLink,
} from '@/features/agency';
import {
  isDemoRefusal,
  useAgencyMutation,
  useAssignWebsite,
  useClientUsers,
  useCustomDomain,
  useUnassignWebsite,
  useUpdateClient,
} from '@/features/agency/queries';
import { getWebsites } from '@/features/websites/api';
import { demoMutationGuard } from '@/lib/demo';
import { isAgencyPlanRequired, useAgencyPlan } from '@/features/agency/plan';
import { AgencyPlanPrompt } from '@/components/agency/AgencyPlanPrompt';
import {
  ClientUserList,
  InviteClientUserDialog,
  PortalLinkReveal,
  useClientAccessError,
} from '@/components/agency/client-user-dialogs';
import { CopyButton } from '@/components/agency/CopyButton';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

function Panel({ title, description, action, children, className }: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('surface overflow-hidden', className)}>
      <div className="flex items-start justify-between gap-4 border-b border-border/60 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const reportError = (e: unknown) => {
  if (!isDemoRefusal(e)) toast.error((e as Error).message || 'Something went wrong');
};

// ─── Websites ────────────────────────────────────────────────────────────────

export function ClientWebsitesPanel({ websiteId, client }: { websiteId: string; client: AgencyClient }) {
  const [assigning, setAssigning] = useState(false);
  const [selected, setSelected] = useState('');
  const assign = useAssignWebsite(websiteId);
  const unassign = useUnassignWebsite(websiteId);
  const [confirm, confirmDialog] = useConfirm();
  const max = client.limits.maxWebsites;

  const { data: allSites = [] } = useQuery({ queryKey: ['websites'], queryFn: getWebsites, enabled: assigning });
  const assignable = allSites.filter(s => !client.websites.some(w => w.id === s.id));

  return (
    <Panel
      title="Websites"
      description={max === null ? `${client.websites.length} tracked` : `${client.websites.length} of ${max} allowed`}
      action={
        <Button
          size="sm" variant="outline" className="h-8 gap-1.5"
          onClick={() => { if (!demoMutationGuard(websiteId)) setAssigning(true); }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add website
        </Button>
      }
    >
      {client.websites.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Globe className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No websites under this client yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {client.websites.map(w => (
            <li key={w.id} className="space-y-2.5 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{w.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {w.url} · added {format(new Date(w.createdAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs text-muted-foreground" asChild>
                    <Link href={`/websites/${w.id}`}>
                      <Link2 className="h-3.5 w-3.5" />
                      Analytics
                    </Link>
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    title="Remove from client"
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Remove "${w.name}" from ${client.name}?`,
                        description: 'The website keeps tracking and keeps its data — it just stops being grouped under this client.',
                        confirmLabel: 'Remove from client',
                      });
                      if (!ok) return;
                      unassign.mutate({ clientId: client.id, siteId: w.id }, { onSuccess: () => toast.success('Website removed'), onError: reportError });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 pl-11">
                <code className="min-w-0 flex-1 truncate rounded-md border border-border/60 bg-muted/50 px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
                  {w.snippet}
                </code>
                <CopyButton text={w.snippet} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirmDialog}
      <Dialog open={assigning} onOpenChange={setAssigning}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add a website to {client.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">Website</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder={assignable.length ? 'Choose a website' : 'No other websites'} />
              </SelectTrigger>
              <SelectContent>
                {assignable.map(s => <SelectItem key={s.id} value={s.id}>{s.name} · {s.url}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">A site under another client moves to this one.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setAssigning(false)}>Cancel</Button>
            <Button
              size="sm"
              disabled={!selected || assign.isPending}
              onClick={() =>
                assign.mutate({ clientId: client.id, siteId: selected }, {
                  onSuccess: () => { toast.success('Website added'); setAssigning(false); setSelected(''); },
                  onError: (e: any) => e?.response?.data?.error === 'website_limit_reached'
                    ? toast.error(`${client.name} is at its website limit.`)
                    : isAgencyPlanRequired(e)
                      ? toast.error('Adding websites to clients is part of the Agency plan.')
                      : reportError(e),
                })
              }
            >
              {assign.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Add
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

// ─── Feature access ──────────────────────────────────────────────────────────

const FEATURES: { key: keyof AgencyClientFeatures; label: string; description: string; icon: React.ElementType }[] = [
  { key: 'analytics',   label: 'Analytics',   description: 'Off stops all collection',  icon: Activity },
  { key: 'replays',     label: 'Recordings',  description: 'Session replay',            icon: Video },
  { key: 'heatmaps',    label: 'Heatmaps',    description: 'Clicks and scroll depth',   icon: Flame },
  { key: 'funnels',     label: 'Funnels',     description: 'Conversion steps',          icon: GitBranch },
  { key: 'automations', label: 'Automations', description: 'Triggers and actions',      icon: Bot },
  { key: 'errors',      label: 'Errors',      description: 'JavaScript errors',         icon: Bug },
];

export function ClientFeaturesPanel({ websiteId, client }: { websiteId: string; client: AgencyClient }) {
  const update = useUpdateClient(websiteId);
  const [features, setFeatures] = useState(client.featuresEnabled);
  useEffect(() => setFeatures(client.featuresEnabled), [client.featuresEnabled]);
  const on = Object.values(features).filter(Boolean).length;

  const toggle = (key: keyof AgencyClientFeatures) => {
    const next = { ...features, [key]: !features[key] };
    setFeatures(next);
    update.mutate({ id: client.id, req: { featuresEnabled: next } }, {
      onError: (e) => { setFeatures(client.featuresEnabled); reportError(e); },
    });
  };

  return (
    <Panel title="Feature access" description={`${on} of ${FEATURES.length} on · applied to every site of this client`}>
      <ul className="divide-y divide-border/60">
        {FEATURES.map(({ key, label, description, icon: Icon }) => (
          <li key={key} className="flex items-center gap-3 px-5 py-3">
            <div className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              features[key] ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
            )}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <Switch checked={features[key]} onCheckedChange={() => toggle(key)} aria-label={`${label} for ${client.name}`} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ─── Limits ──────────────────────────────────────────────────────────────────

const LIMIT_FIELDS: { key: keyof ClientLimits; label: string; unit: string }[] = [
  { key: 'maxMonthlyEvents', label: 'Events', unit: 'per month' },
  { key: 'maxReplays',       label: 'Recordings', unit: 'per month' },
  { key: 'maxHeatmaps',      label: 'Heatmap pages', unit: 'total' },
  { key: 'maxWebsites',      label: 'Websites', unit: 'total' },
];

export function ClientLimitsPanel({ websiteId, client }: { websiteId: string; client: AgencyClient }) {
  const update = useUpdateClient(websiteId);
  const [limits, setLimits] = useState(client.limits);
  useEffect(() => setLimits(client.limits), [client.limits]);
  const dirty = LIMIT_FIELDS.some(f => limits[f.key] !== client.limits[f.key]);

  const parse = (v: string): number | null => {
    const n = parseInt(v.replace(/[^\d]/g, ''), 10);
    return Number.isNaN(n) ? null : n;
  };

  return (
    <Panel
      title="Usage caps"
      description="Blank is uncapped. Your plan's limits still apply across all clients."
      action={
        <Button
          size="sm" className="h-8" disabled={!dirty || update.isPending}
          onClick={() => update.mutate({ id: client.id, req: { limits } }, {
            onSuccess: () => toast.success('Caps saved'),
            onError: reportError,
          })}
        >
          {update.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
          Save
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        {LIMIT_FIELDS.map(f => (
          <div key={f.key} className="space-y-1.5">
            <Label className="flex items-baseline justify-between text-xs font-medium">
              {f.label}
              <span className="font-normal text-muted-foreground">{f.unit}</span>
            </Label>
            <Input
              inputMode="numeric"
              placeholder="Uncapped"
              value={limits[f.key] === null ? '' : limits[f.key]!.toLocaleString()}
              onChange={e => setLimits(prev => ({ ...prev, [f.key]: parse(e.target.value) }))}
              className="h-9 text-sm tabular-nums"
            />
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── Client access (Cloud, Agency plan) ──────────────────────────────────────

/**
 * Who at this client can open its read-only portal: its client users, each with their own magic
 * link, and one anonymous link for the whole client. Without the Agency plan, the prompt instead.
 */
export function ClientPortalPanel({ websiteId, client }: { websiteId: string; client: AgencyClient }) {
  const { allowed } = useAgencyPlan(websiteId);
  const { data: users = [], isLoading } = useClientUsers(websiteId, { clientId: client.id, enabled: allowed });
  const { data: domain } = useCustomDomain(websiteId, { enabled: allowed });
  const [inviting, setInviting] = useState(false);
  const [link, setLink] = useState<PortalLink | null>(null);
  const [confirm, confirmDialog] = useConfirm();
  const onError = useClientAccessError(websiteId);
  const generate = useAgencyMutation(websiteId, createPortalLink);
  const stop = useAgencyMutation(websiteId, revokePortalLink);

  if (!allowed) return <AgencyPlanPrompt websiteId={websiteId} feature="client-access" />;

  return (
    <Panel
      title="Client access"
      description={`People at ${client.name} who can open a read-only portal of its websites, by magic link. No account needed.`}
      action={
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setInviting(true)}>
          <UserPlus className="h-3.5 w-3.5" />
          Invite
        </Button>
      }
    >
      {confirmDialog}
      <InviteClientUserDialog
        websiteId={websiteId}
        client={inviting ? client : null}
        domain={domain}
        onOpenChange={o => { if (!o) setInviting(false); }}
      />
      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : users.length === 0 ? (
        <p className="px-5 py-4 text-xs text-muted-foreground">Nobody invited yet.</p>
      ) : (
        <ClientUserList websiteId={websiteId} users={users} domain={domain} />
      )}

      <div className="space-y-3 border-t border-border/60 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Anonymous link</p>
            <p className="text-xs text-muted-foreground">
              One link for anyone at {client.name}, valid 7 days. A new one stops the last.
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button
              size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" disabled={stop.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Stop the anonymous link?',
                  description: 'Anyone holding it loses access at once. Client users keep their own links.',
                  confirmLabel: 'Stop link',
                  destructive: true,
                });
                if (ok) stop.mutate(client.id, { onSuccess: () => { setLink(null); toast.success('Link stopped'); }, onError });
              }}
            >
              Stop link
            </Button>
            <Button
              size="sm" variant="outline" className="h-8 gap-1.5" disabled={generate.isPending}
              onClick={() => generate.mutate(client.id, { onSuccess: setLink, onError })}
            >
              {generate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
              Generate link
            </Button>
          </div>
        </div>
        {link && <PortalLinkReveal link={link} domain={domain} />}
      </div>
    </Panel>
  );
}
