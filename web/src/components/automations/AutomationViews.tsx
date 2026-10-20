'use client';

import type { ReactNode } from 'react';
import { ArrowRight, Zap } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  CARD, CardGrid, CollectionRow, CollectionTable, GroupedRows,
  type CollectionColumn, type CollectionGroup, type RowSelection,
} from '@/components/ui/collection';
import { PopupThumb } from '@/components/automations/PopupThumb';
import { RowMenu } from '@/components/automations/automation-cells';
import { ACTIONS, TRIGGERS, actionLabel, triggerLabel } from '@/features/automations/catalog';
import { useT } from '@/lib/i18n';
import type { AutomationsMessages } from '@/lib/i18n/messages/automations-en';
import { AUTOMATION_GROUP_META, automationLine, automationTone } from '@/features/automations/insights';
import { popupOf } from '@/features/automations/popup-of';
import { useToggleAutomation, type Automation } from '@/lib/automations-api';
import { cn } from '@/lib/utils';

/** The list's groups, named in the current language. */
export function automationGroups(m: AutomationsMessages): CollectionGroup[] {
  return AUTOMATION_GROUP_META.map((g) => ({
    id: g.id, label: m.groups[g.id].label, icon: <span aria-hidden className={cn('size-2 rounded-full', g.dot)} />,
  }));
}

export interface AutomationLayoutProps {
  automations: Automation[];
  websiteId: string;
  canEdit: boolean;
  onOpen: (a: Automation) => void;
  /** The panel's top row: the view tabs and the list's controls. */
  toolbar?: ReactNode;
}

const key = (a: Automation) => a.id;
const runs30 = (a: Automation) => a.stats?.last30Days ?? 0;
const triggerIconOf = (a: Automation) => TRIGGERS[a.triggerType]?.icon ?? Zap;

/** Trigger → first action, as two quiet outlined chips. */
export function Flow({ automation: a }: { automation: Automation }) {
  const m = useT().automations;
  const trigger = { label: triggerLabel(a.triggerType, m.catalog), icon: triggerIconOf(a) };
  const actions = a.actions ?? [];
  const first = actions[0]
    ? { label: actionLabel(actions[0].actionType, false, m.catalog), icon: ACTIONS[actions[0].actionType]?.icon ?? Zap }
    : null;
  const chip = 'inline-flex h-5 min-w-0 items-center gap-1 rounded-md border border-border px-1.5 text-[11.5px] text-foreground/75 [&_svg]:size-3 [&_svg]:shrink-0';
  return (
    <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
      <span className={chip}><trigger.icon aria-hidden /><span className="truncate">{trigger.label}</span></span>
      <ArrowRight aria-hidden className="size-3 shrink-0 text-muted-foreground" />
      {first ? <span className={chip}><first.icon aria-hidden /><span className="truncate">{first.label}</span></span> : <span className="text-[11.5px] italic text-muted-foreground">{m.views.noAction}</span>}
      {actions.length > 1 && <span className="text-[11px] text-muted-foreground" title={m.views.nActions(actions.length)}>+{actions.length - 1}</span>}
    </span>
  );
}

/** The on/off switch alone, for rows and cards; a viewer sees it but cannot change it. */
export function ActiveSwitch({ automation: a, websiteId, canEdit }: { automation: Automation; websiteId: string; canEdit: boolean }) {
  const m = useT().automations.views;
  const { mutate: toggle, isPending } = useToggleAutomation();
  return (
    <span onClick={(e) => e.stopPropagation()} className="flex shrink-0">
      <Switch
        checked={a.isActive}
        disabled={isPending || !canEdit}
        onCheckedChange={() => toggle({ websiteId, automationId: a.id })}
        aria-label={a.isActive ? m.pause(a.name) : m.activate(a.name)}
        className="scale-[0.8]"
      />
    </span>
  );
}

function Name({ automation: a, onOpen, className }: { automation: Automation; onOpen: (a: Automation) => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen(a); }}
      title={a.description || undefined}
      className={cn('min-w-0 truncate text-left text-[13px] text-foreground focus-visible:underline focus-visible:outline-none', className)}
    >
      {a.name}
    </button>
  );
}

function Line({ automation: a, className }: { automation: Automation; className?: string }) {
  const m = useT().automations;
  const failing = automationTone(a) === 'failing';
  return <span className={cn('truncate text-xs', failing ? 'text-destructive' : 'text-muted-foreground', className)}>{automationLine(a, m.line)}</span>;
}

function Menu({ automation: a, websiteId, canEdit, onOpen }: { automation: Automation; websiteId: string; canEdit: boolean; onOpen: (a: Automation) => void }) {
  if (!canEdit) return null;
  return <span className="shrink-0 [&_button]:size-7"><RowMenu automation={a} websiteId={websiteId} onEdit={() => onOpen(a)} /></span>;
}

// ── List ─────────────────────────────────────────────────────────────────────

/** Grouped by how each is doing: failing first, then live but never fired, working, off. */
export function AutomationList({ automations, websiteId, canEdit, onOpen, toolbar }: AutomationLayoutProps) {
  const m = useT().automations;
  return (
    <GroupedRows
      toolbar={toolbar}
      items={automations}
      getKey={key}
      groups={automationGroups(m)}
      groupOf={automationTone}
      renderRow={(a) => {
        const Icon = triggerIconOf(a);
        return (
          <CollectionRow onOpen={() => onOpen(a)} className="min-h-[52px]">
            <span aria-hidden className={cn('flex size-7 shrink-0 items-center justify-center rounded-md [&_svg]:size-3.5', a.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
              <Icon />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Name automation={a} onOpen={onOpen} />
              <Line automation={a} />
            </span>
            <span className="hidden shrink-0 lg:flex"><Flow automation={a} /></span>
            <span className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground md:block">
              <span className="tabular-nums text-foreground">{runs30(a).toLocaleString()}</span> {m.views.in30Days}
            </span>
            <ActiveSwitch automation={a} websiteId={websiteId} canEdit={canEdit} />
            <Menu automation={a} websiteId={websiteId} canEdit={canEdit} onOpen={onOpen} />
          </CollectionRow>
        );
      }}
    />
  );
}

// ── Table ────────────────────────────────────────────────────────────────────

/** Every figure side by side, with checkboxes for deleting several at once. */
export function AutomationTable({ automations, websiteId, canEdit, onOpen, selection, sortedBy, toolbar }: AutomationLayoutProps & { selection?: RowSelection; sortedBy: string }) {
  const m = useT().automations;
  const v = m.views;
  // What decides which automation to open: what it does, its state, how often it ran lately and
  // whether it is on. Totals, success rate and edit date are on the automation's own screen.
  const columns: CollectionColumn<Automation>[] = [
    {
      id: 'name', header: v.colAutomation, sorted: sortedBy === 'name',
      cell: (a) => {
        const first = a.actions?.[0];
        const flow = `${triggerLabel(a.triggerType, m.catalog)} → ${first ? actionLabel(first.actionType, false, m.catalog) : v.noAction}`;
        return (
          <span className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-3.5"><Zap /></span>
            <span className="flex min-w-0 flex-col leading-tight">
              <Name automation={a} onOpen={onOpen} className="font-medium" />
              <span className="truncate text-[12px] text-muted-foreground" title={flow}>{flow}</span>
            </span>
          </span>
        );
      },
    },
    {
      id: 'status', header: v.colStatus, width: '150px', sorted: sortedBy === 'attention',
      cell: (a) => (
        <span className="flex items-center gap-2 text-foreground/80">
          <span aria-hidden className={cn('size-2 shrink-0 rounded-full', AUTOMATION_GROUP_META.find((g) => g.id === automationTone(a))!.dot)} />
          {m.groups[automationTone(a)].label}
        </span>
      ),
    },
    { id: 'recent', header: v.colRecent, width: '110px', align: 'right', sorted: sortedBy === 'runs', cell: (a) => <span className="tabular-nums text-foreground/80">{runs30(a).toLocaleString()}</span> },
    { id: 'on', header: v.colOn, width: '64px', align: 'right', cell: (a) => <span className="flex justify-end"><ActiveSwitch automation={a} websiteId={websiteId} canEdit={canEdit} /></span> },
    ...(canEdit ? [{ id: 'menu', header: <span className="sr-only">{v.colOptions}</span>, width: '52px', align: 'right' as const, cell: (a: Automation) => <span className="flex justify-end"><Menu automation={a} websiteId={websiteId} canEdit={canEdit} onOpen={onOpen} /></span> }] : []),
  ];
  return <CollectionTable label={v.tableLabel} items={automations} getKey={key} columns={columns} onOpen={onOpen} selection={selection} minWidth={720} rowClassName="h-14" toolbar={toolbar} />;
}

// ── Cards ────────────────────────────────────────────────────────────────────

/** What the visitor sees, then what it has done. Automations with no popup show their flow. */
export function AutomationCards({ automations, websiteId, canEdit, onOpen, toolbar }: AutomationLayoutProps) {
  const m = useT().automations;
  return (
    <CardGrid
      toolbar={toolbar}
      items={automations}
      getKey={key}
      minCardWidth={300}
      renderCard={(a) => {
        const popup = popupOf(a);
        const Icon = triggerIconOf(a);
        const tone = { ...AUTOMATION_GROUP_META.find((g) => g.id === automationTone(a))!, label: m.groups[automationTone(a)].label };
        return (
          <div onClick={() => onOpen(a)} className={cn(CARD, 'group relative cursor-pointer gap-0 overflow-hidden p-0')}>
            <div className={cn('border-b border-border', !a.isActive && 'opacity-60')}>
              {popup ? <PopupThumb action={popup} /> : (
                <div aria-hidden className="flex aspect-[4/3] items-center justify-center bg-muted/40 text-muted-foreground [&_svg]:size-6">
                  <Icon />
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-3">
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden className={cn('size-2 shrink-0 rounded-full', tone.dot)} title={tone.label} />
                <Name automation={a} onOpen={onOpen} className="font-medium" />
                <span className="ml-auto flex items-center gap-1">
                  <ActiveSwitch automation={a} websiteId={websiteId} canEdit={canEdit} />
                  <Menu automation={a} websiteId={websiteId} canEdit={canEdit} onOpen={onOpen} />
                </span>
              </span>
              <Flow automation={a} />
              <Line automation={a} className="line-clamp-2 min-h-[2.4em] whitespace-normal leading-snug" />
              <span className="flex gap-4 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                <span><span className="tabular-nums text-foreground">{runs30(a).toLocaleString()}</span> {m.views.in30Days}</span>
                <span><span className="tabular-nums text-foreground">{(a.stats?.totalExecutions ?? 0).toLocaleString()}</span> {m.views.runsInAll}</span>
              </span>
            </div>
          </div>
        );
      }}
    />
  );
}
