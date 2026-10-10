'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Activity,
  Archive,
  Bot,
  Bug,
  CheckCircle2,
  ExternalLink,
  Flame,
  GitBranch,
  Globe,
  Gauge,
  MoreVertical,
  KeyRound,
  Pencil,
  UserPlus,
  Search,
  Trash2,
  Users,
  Video,
} from 'lucide-react';
import { useAgencyClients, useDeleteClient, useUpdateClient, isDemoRefusal } from '@/features/agency/queries';
import type { AgencyClient } from '@/features/agency/types';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { ColumnDef, DataTable, SortableHeader } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { isEnterprise } from '@/lib/features';
import { deleteClientUser, listClientUsers, type ClientUser } from '@/features/agency';
import { demoClientUsers, demoMutationGuard, isDemo } from '@/lib/demo';
import { CreateClientUserDialog, DeleteConfirmDialog, ResetPasswordDialog } from '@/components/agency/client-user-dialogs';
import { FEATURE_NAMES, compactNumber, initials, limitPhrases } from '@/components/agency/format';

type Filter = 'all' | AgencyClient['status'];

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All statuses' },
  { id: 'active', label: 'Active' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'archived', label: 'Archived' },
];

const AVATAR_TONES = [
  'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
];

/** Stable per client, so a client keeps its colour between visits. */
export function avatarTone(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length]!;
}

export function ClientAvatar({ client, size = 'md' }: { client: AgencyClient; size?: 'md' | 'lg' }) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg font-semibold',
        size === 'lg' ? 'h-11 w-11 text-sm' : 'h-9 w-9 text-xs',
        avatarTone(client.id),
      )}
    >
      {initials(client.name)}
    </div>
  );
}

const FEATURE_ICONS: { key: keyof AgencyClient['featuresEnabled']; icon: React.ElementType }[] = [
  { key: 'analytics', icon: Activity },
  { key: 'replays', icon: Video },
  { key: 'heatmaps', icon: Flame },
  { key: 'funnels', icon: GitBranch },
  { key: 'automations', icon: Bot },
  { key: 'errors', icon: Bug },
];

/** A monthly cap: the number, or a dash for uncapped. One line, right-aligned like any figure. */
function CapCell({ value }: { value: number | null }) {
  return value === null ? (
    <span className="text-sm text-muted-foreground/60">—</span>
  ) : (
    <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-foreground">{compactNumber(value)}</span>
  );
}

const STATUS_PILL: Record<AgencyClient['status'], string> = {
  active: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  suspended: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  archived: 'bg-muted text-muted-foreground',
};

export function ClientsTab({
  websiteId,
  onOpen,
  onEdit,
}: {
  websiteId: string;
  onOpen: (clientId: string) => void;
  onEdit: (client: AgencyClient) => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [confirm, confirmDialog] = useConfirm();
  const { data: clients = [], isLoading } = useAgencyClients(websiteId);
  const update = useUpdateClient(websiteId);
  const remove = useDeleteClient(websiteId);

  // A client's login is the login with its email. Cloud only; the demo site shows samples.
  const demo = isDemo(websiteId);
  const showLogins = isEnterprise || demo;
  const queryClient = useQueryClient();
  const { data: logins = [] } = useQuery({
    queryKey: ['agency-client-users', demo],
    queryFn: () => (demo ? Promise.resolve(demoClientUsers()) : listClientUsers()),
    enabled: showLogins,
  });
  const loginFor = (c: AgencyClient): ClientUser | undefined =>
    c.email ? logins.find(u => u.email.toLowerCase() === c.email.toLowerCase()) : undefined;
  const refreshLogins = () => queryClient.invalidateQueries({ queryKey: ['agency-client-users'] });
  const [newLoginFor, setNewLoginFor] = useState<AgencyClient | null>(null);
  const [resetTarget, setResetTarget] = useState<ClientUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientUser | null>(null);
  const deleteLogin = (userId: string) => {
    if (demoMutationGuard(websiteId)) return;
    deleteClientUser(userId)
      .then(() => { toast.success('Login removed'); setDeleteTarget(null); refreshLogins(); })
      .catch((e: Error) => toast.error(e.message || 'Could not remove the login'));
  };

  const onError = (e: unknown) => { if (!isDemoRefusal(e)) toast.error((e as Error).message || 'Something went wrong'); };
  const setStatus = (c: AgencyClient, status: AgencyClient['status']) =>
    update.mutate({ id: c.id, req: { status } }, {
      onSuccess: () => toast.success(`${c.name} is now ${status}`),
      onError,
    });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter(c => {
      if (filter !== 'all' && c.status !== filter) return false;
      if (!q) return true;
      return [c.name, c.company, c.email, c.externalId ?? '', ...c.websites.map(w => w.url)]
        .some(v => v.toLowerCase().includes(q));
    });
  }, [clients, search, filter]);

  const active = clients.filter(c => c.status === 'active').length;
  const sites = clients.reduce((n, c) => n + c.websites.length, 0);
  const capped = clients.filter(c => limitPhrases(c.limits).length > 0).length;

  const columns: ColumnDef<AgencyClient>[] = [
    {
      id: 'name',
      header: ({ column }) => <SortableHeader column={column}>Client</SortableHeader>,
      accessorKey: 'name',
      size: 190,
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex min-w-0 items-center gap-3">
            <ClientAvatar client={c} />
            {/* A hard max: the table lays out automatically, so `truncate` needs a bound. */}
            <div className="min-w-0 max-w-[130px]">
              <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
              {/* Your own ID first: it is what the management API looks clients up by. */}
              <p className={cn('mt-0.5 truncate text-xs text-muted-foreground', c.externalId && 'font-mono')}>
                {c.externalId || c.company || c.email || '—'}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      id: 'websites',
      header: ({ column }) => <SortableHeader column={column}>Websites</SortableHeader>,
      accessorFn: c => c.websites.length,
      size: 170,
      cell: ({ row }) => {
        const ws = row.original.websites;
        if (ws.length === 0) return <span className="text-sm text-muted-foreground">None yet</span>;
        return (
          <div className="flex min-w-0 items-center gap-2">
            <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="max-w-[120px] truncate text-sm text-foreground" title={ws[0]!.url}>{ws[0]!.url}</span>
            {ws.length > 1 && (
              <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                +{ws.length - 1}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'features',
      header: 'Features',
      size: 136,
      enableSorting: false,
      // Six fixed slots, one per feature: lit when on, dimmed and struck through when off.
      // Always one line, and the same position means the same feature on every row.
      cell: ({ row }) => {
        const enabled = row.original.featuresEnabled;
        return (
          <div className="flex items-center">
            {FEATURE_ICONS.map(({ key, icon: Icon }) => {
              const on = enabled[key];
              return (
                <span
                  key={key}
                  title={`${FEATURE_NAMES[key]} ${on ? 'on' : 'off'}`}
                  className={cn(
                    'relative flex h-6 w-[22px] items-center justify-center',
                    on ? 'text-primary' : 'text-muted-foreground/35',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {!on && <span className="absolute h-px w-4 rotate-45 bg-muted-foreground/50" />}
                </span>
              );
            })}
          </div>
        );
      },
    },
    {
      id: 'events',
      header: ({ column }) => <SortableHeader column={column}>Event cap</SortableHeader>,
      accessorFn: c => c.limits.maxMonthlyEvents ?? Number.MAX_SAFE_INTEGER,
      size: 80,
      cell: ({ row }) => <CapCell value={row.original.limits.maxMonthlyEvents} />,
    },
    {
      id: 'replays',
      header: ({ column }) => <SortableHeader column={column}>Rec. cap</SortableHeader>,
      accessorFn: c => c.limits.maxReplays ?? Number.MAX_SAFE_INTEGER,
      size: 84,
      cell: ({ row }) => <CapCell value={row.original.limits.maxReplays} />,
    },
    ...(showLogins ? [{
      id: 'login',
      header: 'Login',
      enableSorting: false,
      size: 50,
      cell: ({ row }: { row: { original: AgencyClient } }) => {
        const u = loginFor(row.original);
        return u ? (
          <span className="inline-flex" title={`Login: ${u.email}`}>
            <KeyRound className="h-4 w-4 text-emerald-600" aria-hidden />
            <span className="sr-only">Has login</span>
          </span>
        ) : (
          <span className="text-muted-foreground/60">—</span>
        );
      },
    } as ColumnDef<AgencyClient>] : []),
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      size: 100,
      cell: ({ row }) => {
        const c = row.original;
        return (
          <span className={cn('whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold capitalize', STATUS_PILL[c.status])}>
            {c.status}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      size: 48,
      enableSorting: false,
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex justify-end pr-1" onClick={e => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => onOpen(c.id)}>
                  <ExternalLink className="mr-2 h-3.5 w-3.5" /> Open
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(c)}>
                  <Pencil className="mr-2 h-3.5 w-3.5" /> Edit details
                </DropdownMenuItem>
                {c.status !== 'archived' && (
                  <DropdownMenuItem onClick={() => setStatus(c, c.status === 'active' ? 'suspended' : 'active')}>
                    <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> {c.status === 'active' ? 'Suspend' : 'Activate'}
                  </DropdownMenuItem>
                )}
                {c.status !== 'archived' ? (
                  <DropdownMenuItem onClick={() => setStatus(c, 'archived')}>
                    <Archive className="mr-2 h-3.5 w-3.5" /> Archive
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setStatus(c, 'active')}>
                    <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Restore
                  </DropdownMenuItem>
                )}
                {showLogins && (() => {
                  const u = loginFor(c);
                  if (u) {
                    return (
                      <>
                        <DropdownMenuItem onClick={() => setResetTarget(u)}>
                          <KeyRound className="mr-2 h-3.5 w-3.5" /> Reset login password
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteTarget(u)}>
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove login
                        </DropdownMenuItem>
                      </>
                    );
                  }
                  return c.email ? (
                    <DropdownMenuItem onClick={() => { if (!demoMutationGuard(websiteId)) setNewLoginFor(c); }}>
                      <UserPlus className="mr-2 h-3.5 w-3.5" /> Create login
                    </DropdownMenuItem>
                  ) : null;
                })()}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Delete ${c.name}?`,
                      description: 'The client and its feature switches and caps are removed. Its websites keep tracking and keep their data, no longer grouped.',
                      confirmLabel: 'Delete client',
                      destructive: true,
                    });
                    if (!ok) return;
                    remove.mutate(c.id, { onSuccess: () => toast.success('Client deleted'), onError });
                  }}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return (
    <>
      {confirmDialog}
      <CreateClientUserDialog
        websiteId={websiteId}
        open={!!newLoginFor}
        onOpenChange={o => !o && setNewLoginFor(null)}
        initial={newLoginFor ? { name: newLoginFor.name, email: newLoginFor.email, company: newLoginFor.company } : null}
        onDone={refreshLogins}
      />
      <ResetPasswordDialog user={resetTarget} onClose={() => setResetTarget(null)} />
      <DeleteConfirmDialog user={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={deleteLogin} isDeleting={false} />
      <StatCards
        isLoading={isLoading}
        cards={[
          { label: 'Clients', value: clients.length, icon: Users, tone: 'info' },
          { label: 'Active', value: active, icon: CheckCircle2, tone: 'success', toneWhen: active > 0 },
          { label: 'Websites', value: sites, icon: Globe, tone: 'accent' },
          { label: 'With caps', value: capped, icon: Gauge, tone: 'warning', toneWhen: capped > 0 },
        ]}
      />

      <DataTable
        className="overflow-hidden rounded-lg shadow-sm [&_td]:!py-2.5 [&_td]:!px-3 [&_th]:!px-3"
        data={filtered}
        columns={columns}
        isLoading={isLoading}
        rowClassName={() => 'hover:bg-muted/35'}
        onRowClick={c => onOpen(c.id)}
        toolbarLeft={
          <div>
            <h3 className="text-sm font-semibold text-foreground">All clients</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {filtered.length === clients.length
                ? `${clients.length} client${clients.length === 1 ? '' : 's'}`
                : `${filtered.length} of ${clients.length} shown`}
            </p>
          </div>
        }
        toolbarRight={
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={v => setFilter(v as Filter)}>
              <SelectTrigger className="h-8 w-36 !bg-card text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTERS.map(f => (
                  <SelectItem key={f.id} value={f.id} className="text-xs">{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search client, ID or domain…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 w-60 !bg-card pl-8 text-xs"
              />
            </div>
          </div>
        }
        emptyIcon={<Users className="h-6 w-6" />}
        emptyTitle={search || filter !== 'all' ? 'No matches' : 'No clients yet'}
        emptyDescription={
          search || filter !== 'all'
            ? 'No client matches that search or status.'
            : 'Add a client to group its websites, switch features off and set monthly caps — or create them from your backend with the management API.'
        }
        pageSize={10}
      />
    </>
  );
}
