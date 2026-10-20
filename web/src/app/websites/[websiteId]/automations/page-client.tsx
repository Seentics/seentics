'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useMemo, useState } from 'react';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useRouter } from 'next/navigation';
import { Bot, LayoutTemplate, Plus, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  CollectionEmpty, CollectionSkeleton, FilterToolbar, LayoutSwitch, useLayoutPreference, type FilterField,
} from '@/components/ui/collection';
import { GHOST_BUTTON, LIST_PAGE, PageBar, ViewTabs } from '@/components/ui/linear-list';
import { AutomationCards, AutomationList, AutomationTable } from '@/components/automations/AutomationViews';
import { usePermissions } from '@/hooks/use-permissions';
import { useAutomations, useBulkDeleteAutomations, type Automation } from '@/lib/automations-api';
import { AUTOMATION_GROUP_META, AUTOMATION_TONE_RANK, automationTone, type AutomationGroupId } from '@/features/automations/insights';
import { ACTIONS, TRIGGERS } from '@/features/automations/catalog';
import { cn } from '@/lib/utils';

/**
 * The automations, in the shared list-page layout: a top bar with the views and the page's
 * actions, the toolbar (sort, filters, search, layout), then a list grouped by how each one
 * is doing, a table with every figure (and bulk delete), or cards that show the popup itself.
 *
 * The on/off switch is on every row and card: switching one on or off is the most frequent
 * thing done here, and it used to be two clicks deep behind a menu.
 */

type View = 'all' | 'live' | 'attention';
type Sort = 'attention' | 'runs' | 'updated' | 'name';

const LAYOUTS = ['list', 'table', 'cards'] as const;
type AutomationLayout = (typeof LAYOUTS)[number];

const SORTS: Record<Sort, { label: string; compare: (a: Automation, b: Automation) => number }> = {
  attention: {
    label: 'Needs attention first',
    compare: (a, b) => AUTOMATION_TONE_RANK[automationTone(b)] - AUTOMATION_TONE_RANK[automationTone(a)] || (b.stats?.last30Days ?? 0) - (a.stats?.last30Days ?? 0),
  },
  runs: { label: 'Most runs', compare: (a, b) => (b.stats?.last30Days ?? 0) - (a.stats?.last30Days ?? 0) },
  updated: { label: 'Recently edited', compare: (a, b) => b.updatedAt.localeCompare(a.updatedAt) },
  name: { label: 'Name', compare: (a, b) => a.name.localeCompare(b.name) },
};

const label = (catalog: Record<string, { label: string }>, id: string) => catalog[id]?.label ?? id;

export default function AutomationsPage() {
  const websiteId = usePathSegment(1) ?? '';
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const { data, isLoading } = useAutomations(websiteId);
  const bulkDelete = useBulkDeleteAutomations();
  // A viewer reads; creating, switching and deleting are for members and up.
  const { canEdit } = usePermissions(websiteId);

  const [view, setView] = useState<View>('all');
  const [sort, setSort] = useState<Sort>('attention');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AutomationGroupId | ''>('');
  const [trigger, setTrigger] = useState('');
  const [action, setAction] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [layout, setLayout] = useLayoutPreference<AutomationLayout>('automations', LAYOUTS, 'list');

  const automations: Automation[] = useMemo(() => data?.automations ?? [], [data]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return automations
      .filter((a) => view === 'all' || (view === 'live' ? a.isActive : ['failing', 'never_fired'].includes(automationTone(a))))
      .filter((a) => !status || automationTone(a) === status)
      .filter((a) => !trigger || a.triggerType === trigger)
      .filter((a) => !action || (a.actions ?? []).some((x) => x.actionType === action))
      .filter((a) => !q
        || a.name.toLowerCase().includes(q)
        || (a.description ?? '').toLowerCase().includes(q)
        || label(TRIGGERS, a.triggerType).toLowerCase().includes(q)
        || (a.actions ?? []).some((x) => label(ACTIONS, x.actionType).toLowerCase().includes(q)))
      .sort(SORTS[sort].compare);
  }, [automations, view, status, trigger, action, search, sort]);

  // Only the triggers and actions in use: a filter that can only empty the list is noise.
  const usedTriggers = [...new Set(automations.map((a) => a.triggerType))];
  const usedActions = [...new Set(automations.flatMap((a) => (a.actions ?? []).map((x) => x.actionType)))];
  const filters: FilterField[] = [
    {
      id: 'status', label: 'Status', value: status, onChange: (v) => setStatus(v as AutomationGroupId | ''),
      options: AUTOMATION_GROUP_META.map((g) => ({ value: g.id, label: g.label, icon: <span aria-hidden className={cn('size-1.5 rounded-full', g.dot)} /> })),
    },
    { id: 'trigger', label: 'Trigger', value: trigger, onChange: setTrigger, options: usedTriggers.map((t) => ({ value: t, label: label(TRIGGERS, t) })) },
    { id: 'action', label: 'Action', value: action, onChange: setAction, options: usedActions.map((t) => ({ value: t, label: label(ACTIONS, t) })) },
  ];

  const open = (a: Automation) => router.push(`/websites/${websiteId}/automations/${a.id}`);
  const props = { automations: shown, websiteId, canEdit, onOpen: open };
  const chosen = [...selected].filter((id) => shown.some((a) => a.id === id));
  const narrowed = !!(search.trim() || status || trigger || action || view !== 'all');

  const deleteChosen = async () => {
    const ok = await confirm({
      title: `Delete ${chosen.length} automation${chosen.length === 1 ? '' : 's'}?`,
      description: 'They stop running and their run history is removed.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    bulkDelete.mutate({ websiteId, automationIds: chosen }, { onSuccess: () => setSelected(new Set()) });
  };

  return (
    <div className={LIST_PAGE}>
      {confirmDialog}

      <PageBar
        icon={<Zap />}
        title="Automations"
        views={
          <ViewTabs
            label="Views"
            tabs={[{ id: 'all', label: 'All' }, { id: 'live', label: 'Live' }, { id: 'attention', label: 'Needs attention' }]}
            value={view}
            onChange={setView}
          />
        }
      >
        {canEdit && (
          <>
            <button type="button" className={GHOST_BUTTON} onClick={() => router.push(`/websites/${websiteId}/automations/templates`)}>
              <LayoutTemplate className="size-3.5" />Templates
            </button>
            <Button className="h-7 gap-1.5 px-2.5 text-[12.5px]" onClick={() => router.push(`/websites/${websiteId}/automations/new`)}>
              <Plus className="size-3.5" />New automation
            </Button>
          </>
        )}
      </PageBar>

      <FilterToolbar
        sort={{
          value: sort, onChange: (v) => setSort(v as Sort),
          options: (Object.keys(SORTS) as Sort[]).map((id) => ({ value: id, label: SORTS[id].label })),
        }}
        filters={filters}
        search={{ value: search, onChange: setSearch, placeholder: 'Search name, trigger or action…', label: 'Search automations' }}
        count={data ? `${shown.length} of ${automations.length}` : undefined}
      >
        <LayoutSwitch layouts={LAYOUTS} value={layout} onChange={setLayout} />
      </FilterToolbar>

      {chosen.length > 0 && layout === 'table' && (
        <div className="flex items-center gap-2 border-b border-border bg-primary/[0.04] px-4 py-1.5 text-[13px]">
          <span className="font-medium">{chosen.length} selected</span>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelected(new Set())}>Clear</Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive" disabled={bulkDelete.isPending} onClick={deleteChosen}>
            <Trash2 className="h-3.5 w-3.5" />Delete
          </Button>
        </div>
      )}

      {isLoading ? <CollectionSkeleton /> : shown.length === 0 ? (
        <CollectionEmpty
          icon={<Bot />}
          title={narrowed ? 'No matches' : 'No automations yet'}
          description={narrowed
            ? 'No automation matches this view, these filters or that search.'
            : 'Create your first automation to show a popup, collect leads or call a webhook when visitors do something.'}
          action={!narrowed && canEdit ? (
            <div className="flex justify-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => router.push(`/websites/${websiteId}/automations/templates`)}><LayoutTemplate className="h-3.5 w-3.5" />Start from a template</Button>
              <Button size="sm" className="gap-1.5" onClick={() => router.push(`/websites/${websiteId}/automations/new`)}><Plus className="h-3.5 w-3.5" />New automation</Button>
            </div>
          ) : undefined}
        />
      ) : layout === 'table' ? (
        <AutomationTable
          {...props}
          sortedBy={sort}
          selection={canEdit ? {
            selected,
            labelOf: (id) => automations.find((a) => a.id === id)?.name ?? id,
            onChange: (ids, on) => setSelected((prev) => {
              const next = new Set(prev);
              ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
              return next;
            }),
          } : undefined}
        />
      ) : layout === 'cards' ? (
        <AutomationCards {...props} />
      ) : (
        <AutomationList {...props} />
      )}
    </div>
  );
}
