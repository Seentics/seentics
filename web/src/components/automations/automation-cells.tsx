'use client';

import { useMemo, useState } from 'react';
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
import { TRIGGERS, ACTIONS } from '@/features/automations/catalog';

/**
 * The cells of the automations table: the trigger-to-action flow, the status toggle and
 * the row menu.
 *
 * Each takes the automation it renders, so the same row can appear in the list, a
 * dashboard summary or a fixture-driven demo.
 */
export function rateTone(rate: number): string {
  if (rate >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (rate >= 70) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

export function Chip({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <span className="inline-flex min-w-0 shrink items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1 text-[11px] font-medium text-foreground">
      <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="truncate">{label}</span>
    </span>
  );
}

/** Trigger → action, as the builder would draw it. */
export function FlowCell({ automation }: { automation: Automation }) {
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
export function StatusCell({ automation, websiteId }: { automation: Automation; websiteId: string }) {
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

export function RowMenu({ automation, websiteId, onEdit }: { automation: Automation; websiteId: string; onEdit: () => void }) {
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
