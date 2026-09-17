'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useMemo, useState } from 'react';
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

import { Chip, FlowCell, StatusCell, RowMenu, rateTone } from '@/components/automations/automation-cells';
import { TRIGGERS, ACTIONS } from '@/features/automations/catalog';

export default function AutomationsPage() {
  const params = { websiteId: usePathSegment(1) ?? '' };
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
    </div>
  );
}
