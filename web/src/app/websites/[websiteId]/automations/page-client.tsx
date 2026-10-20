'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useMemo, useState } from 'react';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useRouter } from 'next/navigation';
import { Bot, LayoutTemplate, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  COLLECTION_SURFACE, CollectionEmpty, CollectionSkeleton, CountTabs, FilterToolbar, LayoutSwitch, useLayoutPreference, type FilterField,
} from '@/components/ui/collection';
import { GHOST_BUTTON, LIST_PAGE, PageBar } from '@/components/ui/linear-list';
import { AutomationCards, AutomationList, AutomationTable } from '@/components/automations/AutomationViews';
import { usePermissions } from '@/hooks/use-permissions';
import { useAutomations, useBulkDeleteAutomations, type Automation } from '@/lib/automations-api';
import { AUTOMATION_GROUP_META, AUTOMATION_TONE_RANK, automationTone, type AutomationGroupId } from '@/features/automations/insights';
import { actionLabel, triggerLabel } from '@/features/automations/catalog';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * The automations, in the shared list-page layout: the page heading with its actions, the panel's
 * top row (the views with their counts, sort, filters, search, layout), then a list grouped by how each one
 * is doing, a table with every figure (and bulk delete), or cards that show the popup itself.
 *
 * The on/off switch is on every row and card: switching one on or off is the most frequent
 * thing done here, and it used to be two clicks deep behind a menu.
 */

type View = 'all' | 'live' | 'attention';
type Sort = 'attention' | 'runs' | 'updated' | 'name';

const LAYOUTS = ['list', 'table', 'cards'] as const;
type AutomationLayout = (typeof LAYOUTS)[number];

const SORTS: Record<Sort, { compare: (a: Automation, b: Automation) => number }> = {
  attention: {
    compare: (a, b) => AUTOMATION_TONE_RANK[automationTone(b)] - AUTOMATION_TONE_RANK[automationTone(a)] || (b.stats?.last30Days ?? 0) - (a.stats?.last30Days ?? 0),
  },
  runs: { compare: (a, b) => (b.stats?.last30Days ?? 0) - (a.stats?.last30Days ?? 0) },
  updated: { compare: (a, b) => b.updatedAt.localeCompare(a.updatedAt) },
  name: { compare: (a, b) => a.name.localeCompare(b.name) },
};

const SORT_LABEL = { attention: 'sortAttention', runs: 'sortRuns', updated: 'sortUpdated', name: 'sortName' } as const;

export default function AutomationsPage() {
  const { automations: m, actions } = useT();
  const t = m.list;
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
  // Table first: the automations side by side, with checkboxes for acting on several at once.
  const [layout, setLayout] = useLayoutPreference<AutomationLayout>('automations', LAYOUTS, 'table');

  const automations: Automation[] = useMemo(() => data?.automations ?? [], [data]);

  /** The automations the search and filters keep, before the tab narrows them. */
  const matching = useMemo(() => {
    const q = search.trim().toLowerCase();
    return automations
      .filter((a) => !status || automationTone(a) === status)
      .filter((a) => !trigger || a.triggerType === trigger)
      .filter((a) => !action || (a.actions ?? []).some((x) => x.actionType === action))
      .filter((a) => !q
        || a.name.toLowerCase().includes(q)
        || (a.description ?? '').toLowerCase().includes(q)
        || triggerLabel(a.triggerType, m.catalog).toLowerCase().includes(q)
        || (a.actions ?? []).some((x) => actionLabel(x.actionType, false, m.catalog).toLowerCase().includes(q)));
  }, [automations, status, trigger, action, search, m]);
  const inView = (a: Automation, v: View) => v === 'all' || (v === 'live' ? a.isActive : ['failing', 'never_fired'].includes(automationTone(a)));
  const shown = matching.filter((a) => inView(a, view)).sort(SORTS[sort].compare);

  // Only the triggers and actions in use: a filter that can only empty the list is noise.
  const usedTriggers = [...new Set(automations.map((a) => a.triggerType))];
  const usedActions = [...new Set(automations.flatMap((a) => (a.actions ?? []).map((x) => x.actionType)))];
  const filters: FilterField[] = [
    {
      id: 'status', label: t.filterStatus, value: status, onChange: (v) => setStatus(v as AutomationGroupId | ''),
      options: AUTOMATION_GROUP_META.map((g) => ({ value: g.id, label: m.groups[g.id].label, icon: <span aria-hidden className={cn('size-1.5 rounded-full', g.dot)} /> })),
    },
    { id: 'trigger', label: t.filterTrigger, value: trigger, onChange: setTrigger, options: usedTriggers.map((id) => ({ value: id, label: triggerLabel(id, m.catalog) })) },
    { id: 'action', label: t.filterAction, value: action, onChange: setAction, options: usedActions.map((id) => ({ value: id, label: actionLabel(id, false, m.catalog) })) },
  ];

  const open = (a: Automation) => router.push(`/websites/${websiteId}/automations/${a.id}`);
  const props = { automations: shown, websiteId, canEdit, onOpen: open };
  const chosen = [...selected].filter((id) => shown.some((a) => a.id === id));
  const narrowed = !!(search.trim() || status || trigger || action || view !== 'all');

  const deleteChosen = async () => {
    const ok = await confirm({
      title: t.deleteTitle(chosen.length),
      description: t.deleteBody,
      confirmLabel: actions.delete,
      destructive: true,
    });
    if (!ok) return;
    bulkDelete.mutate({ websiteId, automationIds: chosen }, { onSuccess: () => setSelected(new Set()) });
  };

  const views: { id: View; label: string }[] = [{ id: 'all', label: t.viewAll }, { id: 'live', label: t.viewLive }, { id: 'attention', label: t.viewAttention }];
  /** The panel's top row: the views with their counts on the left, every control on the right. */
  const toolbar = (
    <FilterToolbar
      leading={
        <CountTabs
          label={t.views}
          tabs={views.map((v) => ({ ...v, count: data ? matching.filter((a) => inView(a, v.id)).length : undefined }))}
          value={view}
          onChange={setView}
        />
      }
      sort={{
        value: sort, onChange: (v) => setSort(v as Sort),
        options: (Object.keys(SORTS) as Sort[]).map((id) => ({ value: id, label: t[SORT_LABEL[id]] })),
      }}
      filters={filters}
      search={{ value: search, onChange: setSearch, placeholder: t.searchPlaceholder, label: t.searchLabel }}
    >
      <LayoutSwitch layouts={LAYOUTS} value={layout} onChange={setLayout} />
    </FilterToolbar>
  );

  /** Under the toolbar while automations are ticked: how many, clear, delete. */
  const bulkBar = chosen.length > 0 && layout === 'table' && canEdit ? (
    <div className="flex items-center gap-2 border-b border-border/70 bg-muted/60 px-4 py-1.5 text-[13px]">
      <span className="font-medium text-foreground">{t.selected(chosen.length)}</span>
      <button type="button" className={GHOST_BUTTON} onClick={() => setSelected(new Set())}>{actions.clear}</button>
      <button type="button" className={cn(GHOST_BUTTON, 'gap-1.5 text-destructive hover:text-destructive')} disabled={bulkDelete.isPending} onClick={deleteChosen}>
        <Trash2 className="size-3.5" />{actions.delete}
      </button>
    </div>
  ) : null;

  return (
    <div className={LIST_PAGE}>
      {confirmDialog}

      <PageBar title={t.title} description={t.description}>
        {canEdit && (
          <>
            <button type="button" className={GHOST_BUTTON} onClick={() => router.push(`/websites/${websiteId}/automations/templates`)}>
              <LayoutTemplate className="size-3.5" />{t.templates}
            </button>
            <Button className="h-7 gap-1.5 px-2.5 text-[12.5px]" onClick={() => router.push(`/websites/${websiteId}/automations/new`)}>
              <Plus className="size-3.5" />{t.newAutomation}
            </Button>
          </>
        )}
      </PageBar>


      {isLoading ? <div className={COLLECTION_SURFACE}>{toolbar}<CollectionSkeleton /></div> : shown.length === 0 ? (
        <div className={COLLECTION_SURFACE}>{toolbar}<CollectionEmpty
          icon={<Bot />}
          title={narrowed ? t.noMatches : t.empty}
          description={narrowed ? t.noMatchesBody : t.emptyBody}
          action={!narrowed && canEdit ? (
            <div className="flex justify-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => router.push(`/websites/${websiteId}/automations/templates`)}><LayoutTemplate className="h-3.5 w-3.5" />{t.fromTemplate}</Button>
              <Button size="sm" className="gap-1.5" onClick={() => router.push(`/websites/${websiteId}/automations/new`)}><Plus className="h-3.5 w-3.5" />{t.newAutomation}</Button>
            </div>
          ) : undefined}
        /></div>
      ) : layout === 'table' ? (
        <AutomationTable
          {...props}
          toolbar={<>{toolbar}{bulkBar}</>}
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
        <AutomationCards {...props} toolbar={toolbar} />
      ) : (
        <AutomationList {...props} toolbar={toolbar} />
      )}
    </div>
  );
}
