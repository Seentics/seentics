'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { DataTable, SortableHeader, ColumnDef, selectionColumn } from '@/components/ui/data-table';

import { StatCards } from '@/components/seentics-ui/StatCards';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Bot, Plus, Play, Pause, Trash2, MoreVertical, LayoutTemplate,
  Zap, Webhook, Bell, MessageSquare, Eye, Megaphone,
  Highlighter, Info, Feather, ExternalLink, Tag, Pencil,
  CheckCircle2, TrendingUp, Search, Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useAutomations,
  useToggleAutomation,
  useDeleteAutomation,
  useBulkDeleteAutomations,
  type Automation,
} from '@/lib/automations-api';


const TRIGGER_LABELS: Record<string, string> = {
  page_view:     'Page View',
  click:         'Element Click',
  scroll_depth:  'Scroll Depth',
  time_on_page:  'Time on Page',
  exit_intent:   'Exit Intent',
  inactivity:    'Inactivity',
  rage_click:    'Rage Click',
  form_abandon:  'Form Abandonment',
  js_error:      'JS Error',
  tab_hidden:    'Tab Hidden',
  tab_visible:   'Tab Visible',
  custom_event:  'Custom Event',
  identify:      'Identify',
  goal_reached:  'Goal Reached',
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  show_modal:          MessageSquare,
  show_toast:          Bell,
  show_banner:         Megaphone,
  highlight_element:   Highlighter,
  show_tooltip:        Info,
  personalize_content: Feather,
  redirect:            ExternalLink,
  tag_session:         Tag,
  webhook:             Webhook,
  // legacy
  email:               Zap,
  banner:              Megaphone,
  modal:               MessageSquare,
  notification:        Bell,
  hide_element:        Eye,
  script:              Zap,
};

function ActionsCell({ automation, websiteId, onEdit }: { automation: Automation; websiteId: string; onEdit: () => void }) {
  const { mutate: toggle, isPending: toggling } = useToggleAutomation();
  const { mutate: remove, isPending: deleting } = useDeleteAutomation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={e => e.stopPropagation()}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem
          onClick={e => { e.stopPropagation(); onEdit(); }}
        >
          <Pencil className="h-3.5 w-3.5 mr-2" />Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={e => {
            e.stopPropagation();
            toggle({ websiteId, automationId: automation.id });
          }}
          disabled={toggling}
        >
          {automation.isActive
            ? <><Pause className="h-3.5 w-3.5 mr-2" />Pause</>
            : <><Play className="h-3.5 w-3.5 mr-2" />Activate</>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={e => {
            e.stopPropagation();
            if (!confirm('Delete this automation?')) return;
            remove({ websiteId, automationId: automation.id });
          }}
          disabled={deleting}
          className="text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" />
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
  const bulkDeleteMutation = useBulkDeleteAutomations();


  const filtered = useMemo(() =>
    automations.filter(a =>
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.description ?? '').toLowerCase().includes(search.toLowerCase())
    ),
    [automations, search]
  );

  const active    = automations.filter(a => a.isActive).length;
  const paused    = automations.filter(a => !a.isActive).length;
  const totalRuns = automations.reduce((s, a) => s + (a.stats?.totalExecutions ?? 0), 0);
  const avgSuccess = automations.length
    ? automations.reduce((s, a) => s + (a.stats?.successRate ?? 0), 0) / automations.length
    : 0;

  const columns: ColumnDef<Automation>[] = [
    selectionColumn<Automation>(),
    {
      id: 'name',

      header: ({ column }) => <SortableHeader column={column}>Automation</SortableHeader>,
      accessorKey: 'name',
      cell: ({ row }) => {
        const a = row.original;
        const ActionIcon = ACTION_ICONS[a.actions[0]?.actionType] ?? Zap;
        return (
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
              a.isActive ? 'bg-primary/10' : 'bg-muted',
            )}>
              <ActionIcon className={cn('h-3.5 w-3.5', a.isActive ? 'text-primary' : 'text-muted-foreground')} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
              {a.description && (
                <p className="text-xs text-muted-foreground truncate">{a.description}</p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      size: 90,
      cell: ({ row }) => (
        <Badge className={cn(
          'text-[10px] px-1.5 py-0 h-4 border rounded-lg',
          row.original.isActive
            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300'
            : 'bg-muted text-muted-foreground border-border',
        )}>
          {row.original.isActive ? 'active' : 'paused'}
        </Badge>
      ),
    },
    {
      id: 'trigger',
      header: 'Trigger',
      accessorKey: 'triggerType',
      size: 140,
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground">
          {TRIGGER_LABELS[getValue() as string] ?? getValue() as string}
        </span>
      ),
    },
    {
      id: 'runs',
      header: ({ column }) => <SortableHeader column={column}>Runs</SortableHeader>,
      accessorFn: row => row.stats?.totalExecutions ?? 0,
      size: 90,
      cell: ({ getValue }) => (
        <span className="text-sm font-semibold">{(getValue() as number).toLocaleString()}</span>
      ),
    },
    {
      id: 'success',
      header: 'Success %',
      accessorFn: row => row.stats?.successRate ?? 0,
      size: 100,
      cell: ({ getValue }) => {
        const rate = getValue() as number;
        return (
          <span className={cn('text-xs font-semibold', rate >= 90 ? 'text-green-600' : rate >= 70 ? 'text-amber-600' : 'text-red-600')}>
            {rate.toFixed(1)}%
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      size: 48,
      enableSorting: false,
      cell: ({ row }) => (
        <ActionsCell
          automation={row.original}
          websiteId={websiteId}
          onEdit={() => router.push(`/websites/${websiteId}/automations/${row.original.id}`)}
        />
      ),
    },
  ];

  return (
    <div className="w-full max-w-[1440px] mx-auto p-4 md:p-6 lg:p-8">
      <DashboardPageHeader
        websiteId={websiteId}
        title="Automations"
        description="Trigger actions automatically based on user behavior and analytics events."
      />

      <StatCards
        isLoading={isLoading}
        cards={[
          { label: 'Active',      value: active, icon: CheckCircle2, iconColor: 'text-green-600', valueColor: 'text-green-600' },
          { label: 'Paused',      value: paused, icon: Pause, iconColor: 'text-muted-foreground' },
          { label: 'Total Runs',  value: totalRuns, icon: Activity },
          { label: 'Avg Success', value: `${avgSuccess.toFixed(1)}%`, icon: TrendingUp, iconColor: 'text-blue-600' },
        ]}
      />

      <DataTable
        data={filtered}
        columns={columns}
        isLoading={isLoading}
        enableRowSelection={true}
        selectionActions={(selectedRows) => (
          <>
            <span className="text-sm font-medium text-muted-foreground mr-2">
              {selectedRows.length} selected
            </span>
            <Button
              variant="destructive"
              size="sm"
              className="h-8 gap-1.5"
              disabled={bulkDeleteMutation.isPending}
              onClick={() => {
                if (confirm(`Are you sure you want to delete ${selectedRows.length} automation(s)?`)) {
                  bulkDeleteMutation.mutate({ websiteId, automationIds: selectedRows.map(r => r.id) });
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </>
        )}
        toolbarLeft={
          <div>
            <h3 className=" font-semibold text-foreground">Automations</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{filtered.length} automation{filtered.length !== 1 ? 's' : ''} configured</p>
          </div>
        }

        toolbarRight={
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search automations..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-9 rounded-lg text-xs w-44"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className=" rounded-lg gap-1.5"
              onClick={() => router.push(`/websites/${websiteId}/automations/templates`)}
            >
              <LayoutTemplate className="h-3.5 w-3.5" />
              Templates
            </Button>
            <Button
              size="sm"
              className=" gap-1.5 rounded-lg"
              onClick={() => router.push(`/websites/${websiteId}/automations/new`)}
            >
              <Plus className="h-3.5 w-3.5" />
              New Automation
            </Button>
          </>
        }
        onRowClick={(row) => router.push(`/websites/${websiteId}/automations/${row.id}`)}
        emptyIcon={<Bot className="h-6 w-6" />}
        emptyTitle="No automations yet"
        emptyDescription="Create your first automation to trigger actions based on user behavior."
        pageSize={10}
      />
    </div>
  );
}
