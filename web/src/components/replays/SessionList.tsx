'use client';

import { useState, type ReactNode } from 'react';
import { Play, Trash2 } from 'lucide-react';
import {
  CollectionRow, CollectionTable, GroupedRows, type CollectionColumn, type CollectionGroup, type RowSelection,
} from '@/components/ui/collection';
import { BarsIcon, CalmIcon, DOT, DoneIcon, DotLabel, HalfIcon, UrgentIcon } from '@/components/ui/linear-list';
import { entryPathDisplay, formatDuration, timeAgo } from '@/features/replays/format';
import type { SessionRow, SessionSort } from '@/features/replays/list-types';
import { sessionIcon, sessionLevel, sessionLine, sessionTags } from '@/features/replays/session-line';
import { cn } from '@/lib/utils';
import { getCountryCode, getCountryFlag } from '@/utils/countries';
import { useT } from '@/lib/i18n';

const groupsFor = (t: { groupLook: string; groupWatch: string; groupSmooth: string }): CollectionGroup[] => [
  { id: 'look', label: t.groupLook, icon: <UrgentIcon /> },
  { id: 'watch', label: t.groupWatch, icon: <HalfIcon /> },
  { id: 'smooth', label: t.groupSmooth, icon: <DoneIcon /> },
];

/** Labels shown per row; the rest are left for the replay. */
const MAX_LABELS = 2;

export interface SessionLayoutProps {
  rows: SessionRow[];
  websiteId: string;
  onPlay: (sessionId: string) => void;
  /** Absent when the viewer cannot delete (an embed, a viewer role). */
  onDelete?: (sessionId: string) => void;
  /** The panel's top row: the view tabs and the list's controls. */
  toolbar?: ReactNode;
}

const key = (s: SessionRow) => s.session_id;
const known = (s: SessionRow) => Boolean(s.country) && s.country !== 'Unknown';
const countryCode = (s: SessionRow) => (known(s) ? getCountryCode(s.country) ?? s.country.slice(0, 2).toUpperCase() : '—');

/** The visitor's flag, or their country's code where there is no flag image. */
function Flag({ s, title }: { s: SessionRow; title: string }) {
  const [broken, setBroken] = useState(false);
  if (!known(s) || broken) {
    return <span className="flex w-5 shrink-0 justify-center font-mono text-[10.5px] text-muted-foreground" title={title}>{countryCode(s)}</span>;
  }
  return <img src={getCountryFlag(s.country)} alt="" title={title} onError={() => setBroken(true)} className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover ring-1 ring-black/5" />;
}

/**
 * What the session was, in two lines: what happened (bold), then where it landed, on what and
 * from where (grey). One cell instead of several narrow columns.
 */
function SessionCell({ s, websiteId }: { s: SessionRow; websiteId: string }) {
  const m = useT().replays;
  const t = m.rows;
  const text = sessionLine(s, websiteId, m);
  const { display, title } = entryPathDisplay(s.entry_page, websiteId);
  const device = m.devices[s.device.toLowerCase() as keyof typeof m.devices] ?? s.device;
  const where = known(s) ? s.country : t.unknownLocation;
  return (
    <span className="flex min-w-0 flex-col gap-0.5 py-1.5 leading-tight">
      <span className="truncate text-[13px] font-medium text-foreground" title={text}>{text}</span>
      <span className="truncate text-[12px] text-muted-foreground">
        <span className="font-mono text-[11.5px]" title={title}>{display}</span>
        {' · '}{device}{' · '}{where}
      </span>
    </span>
  );
}

function LevelIcon({ s }: { s: SessionRow }) {
  const icon = sessionIcon(s);
  return (
    <span className="flex w-3.5 shrink-0 justify-center">
      {icon.kind === 'urgent' ? <UrgentIcon /> : icon.kind === 'bars' ? <BarsIcon color={DOT[icon.tone]} /> : <CalmIcon />}
    </span>
  );
}

function Labels({ s, className }: { s: SessionRow; className?: string }) {
  const m = useT().replays;
  const labels = sessionTags(s, m).slice(0, MAX_LABELS);
  if (labels.length === 0) return null;
  return <span className={cn('shrink-0 gap-1.5', className)}>{labels.map((l) => <DotLabel key={l.label} label={l.label} dot={DOT[l.tone]} />)}</span>;
}

function Actions({ s, onPlay, onDelete }: { s: SessionRow } & Pick<SessionLayoutProps, 'onPlay' | 'onDelete'>) {
  const t = useT().replays.rows;
  return (
    <>
      {onDelete && (
        <button
          type="button"
          title={t.deleteSession}
          aria-label={t.deleteSession}
          onClick={(e) => { e.stopPropagation(); onDelete(s.session_id); }}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="size-3" />
        </button>
      )}
      <button
        type="button"
        title={t.watchReplay}
        aria-label={t.watchReplay}
        onClick={(e) => { e.stopPropagation(); onPlay(s.session_id); }}
        className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Play className="ml-px size-2.5 fill-current" />
      </button>
    </>
  );
}

/**
 * The sessions as Linear lists issues: one 40px line each, grouped under folding headers
 * (Needs a look / Worth watching / Smooth), or one plain list when `grouped` is off.
 */
export function SessionList({ rows, websiteId, grouped, onPlay, onDelete, toolbar }: SessionLayoutProps & { grouped: boolean }) {
  const m = useT().replays;
  const t = m.rows;
  return (
    <GroupedRows
      toolbar={toolbar}
      items={rows}
      getKey={key}
      groups={grouped ? groupsFor(t) : undefined}
      groupOf={sessionLevel}
      renderRow={(s) => {
        return (
          <CollectionRow onOpen={() => onPlay(s.session_id)} className="min-h-14 py-0">
            <Flag s={s} title={known(s) ? s.country : t.unknownLocation} />
            <LevelIcon s={s} />
            <span className="min-w-0 flex-1"><SessionCell s={s} websiteId={websiteId} /></span>
            <Labels s={s} className="hidden md:flex" />
            <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{s.duration_seconds > 0 ? formatDuration(s.duration_seconds) : '—'}</span>
            <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">{timeAgo(s.start_time, undefined, m.time)}</span>
            <Actions s={s} onPlay={onPlay} onDelete={onDelete} />
          </CollectionRow>
        );
      }}
    />
  );
}

/** Every field side by side: for scanning by length, pages, device or where people landed. */
export function SessionTable({ rows, websiteId, onPlay, onDelete, sort, toolbar, selection }: SessionLayoutProps & { sort: SessionSort; selection?: RowSelection }) {
  const m = useT().replays;
  const t = m.rows;
  const columns: CollectionColumn<SessionRow>[] = [
    {
      // The visitor's flag in a tile, as heatmaps shows a page icon, then the session in two lines.
      id: 'what', header: t.colWhat, sorted: sort === 'frustration',
      cell: (s) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted"><Flag s={s} title={known(s) ? s.country : t.unknownLocation} /></span>
          <span className="min-w-0 flex-1"><SessionCell s={s} websiteId={websiteId} /></span>
        </span>
      ),
    },
    { id: 'signals', header: t.colSignals, width: '240px', cell: (s) => (sessionTags(s, m).length ? <Labels s={s} className="flex" /> : <span className="text-muted-foreground">—</span>) },
    { id: 'length', header: t.colLength, width: '88px', align: 'right', cell: (s) => <span className="tabular-nums text-foreground/75">{s.duration_seconds > 0 ? formatDuration(s.duration_seconds) : '—'}</span> },
    { id: 'when', header: t.colStarted, width: '84px', align: 'right', sorted: sort === 'recent', cell: (s) => <span className="text-xs text-muted-foreground">{timeAgo(s.start_time, undefined, m.time)}</span> },
    {
      id: 'actions', header: <span className="sr-only">{t.colActions}</span>, width: onDelete ? '76px' : '48px', align: 'right',
      cell: (s) => <span className="flex justify-end gap-1"><Actions s={s} onPlay={onPlay} onDelete={onDelete} /></span>,
    },
  ];
  return <CollectionTable label={t.tableLabel} items={rows} getKey={key} columns={columns} onOpen={(s) => onPlay(s.session_id)} minWidth={760} rowClassName="h-14" toolbar={toolbar} selection={selection} />;
}
