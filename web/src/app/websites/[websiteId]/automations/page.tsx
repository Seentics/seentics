'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Bot,
  CheckCircle2,
  Clock,
  Coffee,
  Eye,
  EyeOff,
  ExternalLink,
  Feather,
  Globe,
  Highlighter,
  Info,
  LayoutTemplate,
  LogOut,
  Megaphone,
  MessageSquare,
  MoreVertical,
  MousePointer,
  Pause,
  Pencil,
  Plus,
  Search,
  Tag,
  Target,
  TrendingDown,
  TrendingUp,
  Trash2,
  UserCheck,
  Webhook,
  Zap,
} from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { ColumnDef, DataTable, SortableHeader, selectionColumn } from '@/components/ui/data-table';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  useAutomations,
  useBulkDeleteAutomations,
  useDeleteAutomation,
  useToggleAutomation,
  type Automation,
} from '@/lib/automations-api';

/**
 * The automations list.
 *
 * The table used to show a name, a status pill, one trigger label and two numbers —
 * which told you an automation existed but not what it did. An automation *is* a
 * trigger wired to actions, so that shape is now a column: `Exit Intent → Show Modal`.
 * It is the one thing you need to tell two rows apart without opening the builder.
 *
 * Activating and pausing also came out of the overflow menu. It is the most frequent
 * action on this page and it was two clicks deep behind a `MoreVertical`.
 */

const TRIGGERS: Record<string, { label: string; icon: React.ElementType }> = {
  page_view:    { label: 'Page View',        icon: Globe },
  click:        { label: 'Element Click',    icon: MousePointer },
  scroll_depth: { label: 'Scroll Depth',     icon: TrendingDown },
  time_on_page: { label: 'Time on Page',     icon: Clock },
  exit_intent:  { label: 'Exit Intent',      icon: LogOut },
  inactivity:   { label: 'Inactivity',       icon: Coffee },
  rage_click:   { label: 'Rage Click',       icon: Zap },
  form_abandon: { label: 'Form Abandonment', icon: AlertTriangle },
  js_error:     { label: 'JS Error',         icon: AlertTriangle },
  tab_hidden:   { label: 'Tab Hidden',       icon: EyeOff },
  tab_visible:  { label: 'Tab Visible',      icon: Eye },
  custom_event: { label: 'Custom Event',     icon: Zap },
  identify:     { label: 'Identify',         icon: UserCheck },
  goal_reached: { label: 'Goal Reached',     icon: Target },
};

const ACTIONS: Record<string, { label: string; icon: React.ElementType }> = {
  show_modal:          { label: 'Show Modal',          icon: MessageSquare },
  show_toast:          { label: 'Show Toast',          icon: Bell },
  show_banner:         { label: 'Show Banner',         icon: Megaphone },
  highlight_element:   { label: 'Highlight',           icon: Highlighter },
  show_tooltip:        { label: 'Show Tooltip',        icon: Info },
  personalize_content: { label: 'Personalize',         icon: Feather },
  redirect:            { label: 'Redirect',            icon: ExternalLink },
  tag_session:         { label: 'Tag Session',         icon: Tag },
  webhook:             { label: 'Webhook',             icon: Webhook },
  // Legacy action types still present on older rows.
  email:               { label: 'Email',               icon: Zap },
  banner:              { label: 'Banner',              icon: Megaphone },
  modal:               { label: 'Modal',               icon: MessageSquare },
  notification:        { label: 'Notification',        icon: Bell },
  hide_element:        { label: 'Hide Element',        icon: Eye },
  script:              { label: 'Script',              icon: Zap },
};

/** Success-rate colour. The old thresholds had no dark variants, so `text-green-600`
    on a dark table row was close to unreadable. */
function rateTone(rate: number): string {
  if (rate >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (rate >= 70) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function Chip({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <span className="inline-flex min-w-0 shrink items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1 text-[11px] font-medium text-foreground">
      <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="truncate">{label}</span>
    </span>
  );
}

/** Trigger → action, as the builder would draw it. */
function FlowCell({ automation }: { automation: Automation }) {
  const trigger = TRIGGERS[automation.triggerType] ?? { label: automation.triggerType, icon: Zap };
  const actions = automation.actions ?? [];
  const shown = actions.slice(0, 2);

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Chip icon={trigger.icon} label={trigger.label} />
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
      {shown.length === 0 ? (
        <span className="text-[11px] italic text-muted-foreground">no action</span>
      ) : (
        shown.map((a, i) => {
          const meta = ACTIONS[a.actionType] ?? { label: a.actionType, icon: Zap };
          return <Chip key={a.id ?? i} icon={meta.icon} label={meta.label} />;
        })
      )}
      {actions.length > shown.length && (
        <span
          className="shrink-0 text-[11px] font-medium text-muted-foreground"
          title={`${actions.length} actions in total`}
        >
          +{actions.length - shown.length}
        </span>
      )}
    </div>
  );
}

/** In-place activate/pause. */
function StatusCell({ automation, websiteId }: { automation: Automation; websiteId: string }) {
  const { mutate: toggle, isPending } = useToggleAutomation();

  return (
    <div className="flex items-center gap-2.5" onClick={e => e.stopPropagation()}>
      <Switch
        checked={automation.isActive}
        disabled={isPending}
        onCheckedChange={() => toggle({ websiteId, automationId: automation.id })}
        aria-label={automation.isActive ? `Pause ${automation.name}` : `Activate ${automation.name}`}
      />
      <span
        className={cn(
          'text-xs font-medium',
          automation.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
        )}
      >
        {automation.isActive ? 'Active' : 'Paused'}
      </span>
    </div>
  );
}

function RowMenu({ automation, websiteId, onEdit }: { automation: Automation; websiteId: string; onEdit: () => void }) {
  const { mutate: remove, isPending: deleting } = useDeleteAutomation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={e => e.stopPropagation()}>
          <MoreVertical className="h-3.5 w-3.5" />
          <span className="sr-only">Options for {automation.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem onClick={e => { e.stopPropagation(); onEdit(); }}>
          <Pencil className="mr-2 h-3.5 w-3.5" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={deleting}
          className="text-destructive"
          onClick={e => {
            e.stopPropagation();
            if (!confirm(`Delete "${automation.name}"?`)) return;
            remove({ websiteId, automationId: automation.id });
          }}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function AutomationsPage() {
  const params = useParams();
  const router = useRouter();
  const websiteId = params?.websiteId as string;

  const [search, setSearch] = useState('');
  const { data, isLoading } = useAutomations(websiteId);
  const automations: Automation[] = data?.automations ?? [];
  const bulkDelete = useBulkDeleteAutomations();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return automations;
    return automations.filter(a =>
      a.name.toLowerCase().includes(q) ||
      (a.description ?? '').toLowerCase().includes(q) ||
      (TRIGGERS[a.triggerType]?.label ?? a.triggerType).toLowerCase().includes(q) ||
      (a.actions ?? []).some(x => (ACTIONS[x.actionType]?.label ?? x.actionType).toLowerCase().includes(q)),
    );
  }, [automations, search]);

  const active = automations.filter(a => a.isActive).length;
  const paused = automations.length - active;
  const totalRuns = automations.reduce((s, a) => s + (a.stats?.totalExecutions ?? 0), 0);
  // Averaged over automations that have actually run — including never-run ones as 0%
  // dragged the figure down and made a healthy account look broken.
  const withRuns = automations.filter(a => (a.stats?.totalExecutions ?? 0) > 0);
  const avgSuccess = withRuns.length
    ? withRuns.reduce((s, a) => s + (a.stats?.successRate ?? 0), 0) / withRuns.length
    : 0;

  const columns: ColumnDef<Automation>[] = [
    selectionColumn<Automation>(),
    {
      id: 'name',
      header: ({ column }) => <SortableHeader column={column}>Automation</SortableHeader>,
      accessorKey: 'name',
      size: 260,
      cell: ({ row }) => {
        const a = row.original;
        return (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{a.name}</p>
            {a.description ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{a.description}</p>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'flow',
      header: 'What it does',
      size: 340,
      enableSorting: false,
      cell: ({ row }) => <FlowCell automation={row.original} />,
    },
    {
      id: 'runs',
      header: ({ column }) => <SortableHeader column={column}>Runs</SortableHeader>,
      accessorFn: row => row.stats?.totalExecutions ?? 0,
      size: 100,
      cell: ({ getValue }) => {
        const runs = getValue() as number;
        return runs > 0 ? (
          <span className="text-sm font-semibold tabular-nums text-foreground">{runs.toLocaleString()}</span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        );
      },
    },
    {
      id: 'success',
      header: ({ column }) => <SortableHeader column={column}>Success</SortableHeader>,
      accessorFn: row => row.stats?.successRate ?? 0,
      size: 128,
      cell: ({ row }) => {
        const stats = row.original.stats;
        if (!stats || stats.totalExecutions === 0) {
          return <span className="text-sm text-muted-foreground">—</span>;
        }
        return (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full',
                  stats.successRate >= 90 ? 'bg-emerald-500' : stats.successRate >= 70 ? 'bg-amber-500' : 'bg-rose-500',
                )}
                style={{ width: `${Math.min(stats.successRate, 100)}%` }}
              />
            </div>
            <span className={cn('text-xs font-semibold tabular-nums', rateTone(stats.successRate))}>
              {stats.successRate.toFixed(0)}%
            </span>
          </div>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: row => (row.isActive ? 1 : 0),
      size: 130,
      cell: ({ row }) => <StatusCell automation={row.original} websiteId={websiteId} />,
    },
    {
      id: 'actions',
      header: '',
      size: 56,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end pr-1">
          <RowMenu
            automation={row.original}
            websiteId={websiteId}
            onEdit={() => router.push(`/websites/${websiteId}/automations/${row.original.id}`)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1440px] p-4 md:p-6 lg:p-8">
      <DashboardPageHeader
        websiteId={websiteId}
        title="Automations"
        description="Trigger actions automatically based on user behavior and analytics events."
      >
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => router.push(`/websites/${websiteId}/automations/templates`)}
        >
          <LayoutTemplate className="h-3.5 w-3.5" />
          Templates
        </Button>
        <Button size="sm" className="gap-1.5" onClick={() => router.push(`/websites/${websiteId}/automations/new`)}>
          <Plus className="h-3.5 w-3.5" />
          New automation
        </Button>
      </DashboardPageHeader>

      <StatCards
        isLoading={isLoading}
        cards={[
          { label: 'Active', value: active, icon: CheckCircle2, tone: 'success', toneWhen: active > 0 },
          { label: 'Paused', value: paused, icon: Pause, tone: 'warning', toneWhen: paused > 0 },
          { label: 'Total runs', value: totalRuns, icon: Activity, tone: 'info' },
          {
            label: 'Avg success',
            value: withRuns.length ? `${avgSuccess.toFixed(1)}%` : '—',
            icon: TrendingUp,
            tone: 'accent',
            subtext: withRuns.length ? `across ${withRuns.length} that have run` : 'nothing has run yet',
          },
        ]}
      />

      <DataTable
        className="rounded-lg shadow-sm [&_td]:!py-3.5 [&_th]:!py-3.5"
        data={filtered}
        columns={columns}
        isLoading={isLoading}
        enableRowSelection
        rowClassName={() => 'hover:bg-muted/35'}
        selectionActions={selectedRows => (
          <>
            <span className="mr-2 text-sm font-medium text-muted-foreground">
              {selectedRows.length} selected
            </span>
            <Button
              variant="destructive"
              size="sm"
              className="h-8 gap-1.5"
              disabled={bulkDelete.isPending}
              onClick={() => {
                if (!confirm(`Delete ${selectedRows.length} automation(s)?`)) return;
                bulkDelete.mutate({ websiteId, automationIds: selectedRows.map(r => r.id) });
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </>
        )}
        // No title here: `DashboardPageHeader` above already says "Automations", and
        // repeating it inside the panel was the page's second <h> saying the same word.
        toolbarLeft={
          <p className="text-xs text-muted-foreground">
            {filtered.length === automations.length
              ? `${automations.length} automation${automations.length === 1 ? '' : 's'}`
              : `${filtered.length} of ${automations.length} shown`}
          </p>
        }
        toolbarRight={
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, trigger or action…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 w-60 pl-8 text-xs"
            />
          </div>
        }
        onRowClick={row => router.push(`/websites/${websiteId}/automations/${row.id}`)}
        emptyIcon={<Bot className="h-6 w-6" />}
        emptyTitle={search ? 'No matches' : 'No automations yet'}
        emptyDescription={
          search
            ? 'No automation matches that name, trigger or action.'
            : 'Create your first automation to trigger actions based on user behavior.'
        }
        pageSize={10}
      />
    </div>
  );
}
