'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useMemo, useState } from 'react';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useRouter } from 'next/navigation';
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

import { FlowCell, StatusCell, RowMenu } from '@/components/automations/automation-cells';
import { ListGroups } from '@/components/ui/list-groups';
import { AUTOMATION_GROUP_META, AUTOMATION_TONE_DOT, AUTOMATION_TONE_RANK, automationLine, automationTone, inAutomationGroup, type AutomationGroupId } from '@/features/automations/insights';
import { TRIGGERS, ACTIONS } from '@/features/automations/catalog';

export default function AutomationsPage() {
  const params = { websiteId: usePathSegment(1) ?? '' };
  const router = useRouter();
  const websiteId = params?.websiteId as string;

  const [search, setSearch] = useState('');
  const [confirm, confirmDialog] = useConfirm();
  const { data, isLoading } = useAutomations(websiteId);
  /** A group the table is narrowed to, from "Show all" below it. */
  const [groupFilter, setGroupFilter] = useState<AutomationGroupId | null>(null);
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
        const TriggerIcon = TRIGGERS[a.triggerType]?.icon ?? Zap;
        return (
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                a.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
              )}
            >
              <TriggerIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 max-w-[280px]">
              <p className="truncate text-[15px] font-semibold leading-tight text-foreground">{a.name}</p>
              {a.description ? (
                <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{a.description}</p>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      id: 'flow',
      header: 'What it does',
      size: 280,
      enableSorting: false,
      cell: ({ row }) => <FlowCell automation={row.original} />,
    },
    {
      id: 'what',
      header: 'What happened',
      accessorFn: row => AUTOMATION_TONE_RANK[automationTone(row)],
      size: 380,
      cell: ({ row }) => {
        const tone = automationTone(row.original);
        const text = automationLine(row.original);
        return (
          <div className="flex min-w-0 max-w-[30rem] items-center gap-2">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', AUTOMATION_TONE_DOT[tone])} />
            <span className={cn('truncate text-sm', tone === 'failing' ? 'text-foreground' : 'text-muted-foreground')} title={text}>
              {text}
            </span>
          </div>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: row => (row.isActive ? 1 : 0),
      size: 160,
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
    <div className="mx-auto w-full max-w-[1440px] p-4 md:p-5 lg:px-6 lg:py-5">
      {confirmDialog}
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
          },
        ]}
      />

      <DataTable
        className="rounded-lg shadow-sm [&_td]:!py-3.5 [&_th]:!py-2.5"
        data={groupFilter ? filtered.filter((a) => inAutomationGroup(a, groupFilter)) : filtered}
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
              onClick={async () => {
                const ok = await confirm({
                  title: `Delete ${selectedRows.length} automation${selectedRows.length === 1 ? '' : 's'}?`,
                  description: 'They stop running and their run history is removed.',
                  confirmLabel: 'Delete',
                  destructive: true,
                });
                if (!ok) return;
                bulkDelete.mutate({ websiteId, automationIds: selectedRows.map(r => r.id) });
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </>
        )}
        toolbarLeft={
          <div>
            <h3 className="text-sm font-semibold text-foreground">All automations</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {filtered.length === automations.length
                ? `${automations.length} automation${automations.length === 1 ? '' : 's'}`
                : `${filtered.length} of ${automations.length} shown`}
            </p>
          </div>
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

      <ListGroups
        className="mt-6"
        title="Automations by how they are doing"
        description="From each automation's runs. Open a group to see its automations."
        groups={AUTOMATION_GROUP_META.map((meta) => ({
          ...meta,
          items: automations
            .filter((a) => inAutomationGroup(a, meta.id))
            .map((a) => ({ key: a.id, text: `${a.name} — ${automationLine(a)}`, onClick: () => router.push(`/websites/${websiteId}/automations/${a.id}`) })),
        }))}
        onShowAll={(id) => { setGroupFilter(id as AutomationGroupId); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
      />
    </div>
  );
}
