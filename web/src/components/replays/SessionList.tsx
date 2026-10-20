'use client';

import { Play, Trash2 } from 'lucide-react';
import {
  CollectionRow, CollectionTable, GroupedRows, type CollectionColumn, type CollectionGroup,
} from '@/components/ui/collection';
import { BarsIcon, CalmIcon, DOT, DoneIcon, DotLabel, HalfIcon, UrgentIcon } from '@/components/ui/linear-list';
import { entryPathDisplay, formatDuration, timeAgo } from '@/features/replays/format';
import type { SessionRow, SessionSort } from '@/features/replays/list-types';
import { sessionIcon, sessionLevel, sessionLine, sessionTags } from '@/features/replays/session-line';
import { cn } from '@/lib/utils';
import { getCountryCode } from '@/utils/countries';

const GROUPS: CollectionGroup[] = [
  { id: 'look', label: 'Needs a look', icon: <UrgentIcon /> },
  { id: 'watch', label: 'Worth watching', icon: <HalfIcon /> },
  { id: 'smooth', label: 'Smooth', icon: <DoneIcon /> },
];

/** Labels shown per row; the rest are left for the replay. */
const MAX_LABELS = 2;

export interface SessionLayoutProps {
  rows: SessionRow[];
  websiteId: string;
  onPlay: (sessionId: string) => void;
  /** Absent when the viewer cannot delete (an embed, a viewer role). */
  onDelete?: (sessionId: string) => void;
}

const key = (s: SessionRow) => s.session_id;
const known = (s: SessionRow) => Boolean(s.country) && s.country !== 'Unknown';
const countryCode = (s: SessionRow) => (known(s) ? getCountryCode(s.country) ?? s.country.slice(0, 2).toUpperCase() : '—');

function LevelIcon({ s }: { s: SessionRow }) {
  const icon = sessionIcon(s);
  return (
    <span className="flex w-3.5 shrink-0 justify-center">
      {icon.kind === 'urgent' ? <UrgentIcon /> : icon.kind === 'bars' ? <BarsIcon color={DOT[icon.tone]} /> : <CalmIcon />}
    </span>
  );
}

function Labels({ s, className }: { s: SessionRow; className?: string }) {
  const labels = sessionTags(s).slice(0, MAX_LABELS);
  if (labels.length === 0) return null;
  return <span className={cn('shrink-0 gap-1.5', className)}>{labels.map((l) => <DotLabel key={l.label} label={l.label} dot={DOT[l.tone]} />)}</span>;
}

function Actions({ s, onPlay, onDelete }: { s: SessionRow } & Pick<SessionLayoutProps, 'onPlay' | 'onDelete'>) {
  return (
    <>
      {onDelete && (
        <button
          type="button"
          title="Delete session"
          aria-label="Delete session"
          onClick={(e) => { e.stopPropagation(); onDelete(s.session_id); }}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="size-3" />
        </button>
      )}
      <button
        type="button"
        title="Watch replay"
        aria-label="Watch replay"
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
export function SessionList({ rows, websiteId, grouped, onPlay, onDelete }: SessionLayoutProps & { grouped: boolean }) {
  return (
    <GroupedRows
      items={rows}
      getKey={key}
      groups={grouped ? GROUPS : undefined}
      groupOf={sessionLevel}
      renderRow={(s) => {
        const text = sessionLine(s, websiteId);
        return (
          <CollectionRow onOpen={() => onPlay(s.session_id)} className="min-h-10 py-0">
            <span className="w-6 shrink-0 font-mono text-[11px] text-muted-foreground" title={known(s) ? s.country : 'Unknown location'}>{countryCode(s)}</span>
            <LevelIcon s={s} />
            <span className="min-w-0 flex-1 truncate text-[13px] text-foreground" title={text}>{text}</span>
            <Labels s={s} className="hidden md:flex" />
            <span className="hidden w-[120px] shrink-0 truncate text-right text-xs text-muted-foreground lg:block">{known(s) ? s.country : 'Unknown location'}</span>
            <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{s.duration_seconds > 0 ? formatDuration(s.duration_seconds) : '—'}</span>
            <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">{timeAgo(s.start_time)}</span>
            <Actions s={s} onPlay={onPlay} onDelete={onDelete} />
          </CollectionRow>
        );
      }}
    />
  );
}

/** Every field side by side: for scanning by length, pages, device or where people landed. */
export function SessionTable({ rows, websiteId, onPlay, onDelete, sort }: SessionLayoutProps & { sort: SessionSort }) {
  const columns: CollectionColumn<SessionRow>[] = [
    {
      id: 'visitor', header: 'Visitor', width: '84px',
      cell: (s) => (
        <span className="flex items-center gap-2">
          <LevelIcon s={s} />
          <span className="font-mono text-[11px] text-muted-foreground" title={known(s) ? s.country : 'Unknown location'}>{countryCode(s)}</span>
        </span>
      ),
    },
    {
      id: 'what', header: 'What happened', sorted: sort === 'frustration',
      cell: (s) => {
        const text = sessionLine(s, websiteId);
        return <span className="text-foreground" title={text}>{text}</span>;
      },
    },
    { id: 'signals', header: 'Signals', width: '210px', cell: (s) => (sessionTags(s).length ? <Labels s={s} className="flex" /> : <span className="text-muted-foreground">—</span>) },
    {
      id: 'entry', header: 'Entry page', width: '160px',
      cell: (s) => {
        const { display, title } = entryPathDisplay(s.entry_page, websiteId);
        return <span className="font-mono text-[11.5px] text-foreground/75" title={title}>{display}</span>;
      },
    },
    { id: 'device', header: 'Device', width: '150px', cell: (s) => <span className="text-foreground/75" title={`${s.browser} · ${s.os}`}>{s.device} · {s.browser.split(' ')[0]}</span> },
    { id: 'pages', header: 'Pages', width: '64px', align: 'right', cell: (s) => <span className="tabular-nums text-foreground/75">{s.pages_viewed}</span> },
    { id: 'length', header: 'Length', width: '88px', align: 'right', cell: (s) => <span className="tabular-nums text-foreground/75">{s.duration_seconds > 0 ? formatDuration(s.duration_seconds) : '—'}</span> },
    { id: 'when', header: 'Started', width: '84px', align: 'right', sorted: sort === 'recent', cell: (s) => <span className="text-xs text-muted-foreground">{timeAgo(s.start_time)}</span> },
    {
      id: 'actions', header: <span className="sr-only">Actions</span>, width: onDelete ? '76px' : '48px', align: 'right',
      cell: (s) => <span className="flex justify-end gap-1"><Actions s={s} onPlay={onPlay} onDelete={onDelete} /></span>,
    },
  ];
  return <CollectionTable label="Sessions" items={rows} getKey={key} columns={columns} onOpen={(s) => onPlay(s.session_id)} minWidth={1100} />;
}
