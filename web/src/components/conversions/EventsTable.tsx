'use client';

/** Every conversion sent, newest first: what it was, where it went, how it was matched, and how it went. */
import { useMemo, useState } from 'react';
import { ArrowRight, RotateCw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { GHOST_CONTROL } from '@/components/ui/ghost-control';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { relativeTime } from '@/features/errors/format';
import { useRetryConversion } from '@/features/conversions/mutations';
import { useConversionEvents } from '@/features/conversions/queries';
import type { ConversionEvent, ConversionStatus, Destination, EventKind } from '@/features/conversions/types';
import { cn } from '@/lib/utils';
import { formatValue, KIND_LABEL, PLATFORMS, STATUS_META } from './conversion-format';
import { MatchChips, StatusLabel } from './parts';

const PAGE_SIZE = 25;
const ALL = '__all__';

export function EventsTable({
  websiteId, destinations, now, canEdit,
}: { websiteId: string; destinations: Destination[]; now?: number; canEdit: boolean }) {
  const [page, setPage] = useState(0);
  const [destination, setDestination] = useState('');
  const [status, setStatus] = useState<ConversionStatus | ''>('');
  const [kind, setKind] = useState<EventKind | ''>('');
  const list = useConversionEvents(websiteId, { destination, status, kind, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
  const retry = useRetryConversion(websiteId);
  const total = list.data?.total ?? 0;
  const narrowed = !!(destination || status || kind);

  const columns = useMemo<ColumnDef<ConversionEvent>[]>(() => [
    {
      id: 'when',
      header: 'When',
      cell: ({ row }) => (
        <time className="whitespace-nowrap text-xs text-muted-foreground" dateTime={row.original.created_at} title={new Date(row.original.created_at).toLocaleString()}>
          {relativeTime(row.original.created_at, now)}
        </time>
      ),
    },
    {
      id: 'event',
      header: 'Event',
      cell: ({ row }) => {
        const e = row.original;
        return (
          <div className="min-w-[180px]">
            <p className="flex items-center gap-1.5 text-[13px] text-foreground">
              <span className="font-mono">{e.event_name}</span>
              <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="sent as" />
              <span className="font-mono text-foreground/80">{e.platform_event}</span>
            </p>
            <p className="text-xs text-muted-foreground">{KIND_LABEL[e.kind]}{e.order_id ? ` · order ${e.order_id}` : ''}</p>
          </div>
        );
      },
    },
    {
      id: 'platform',
      header: 'Platform',
      cell: ({ row }) => <span className="whitespace-nowrap text-[13px] text-foreground/80">{PLATFORMS[row.original.platform].label}</span>,
    },
    {
      id: 'value',
      header: 'Value',
      cell: ({ row }) => <span className="whitespace-nowrap text-[13px] tabular-nums text-foreground">{formatValue(row.original.value, row.original.currency)}</span>,
    },
    {
      id: 'matched',
      header: 'Matched with',
      cell: ({ row }) => <span className="block"><MatchChips keys={row.original.match_keys} /></span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const e = row.original;
        return (
          <div className="min-w-[140px] max-w-[300px]">
            <StatusLabel status={e.status} />
            {e.error && <p className={cn('mt-0.5 line-clamp-2 text-xs', e.status === 'failed' ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground')} title={e.error}>{e.error}</p>}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const e = row.original;
        if (e.status !== 'failed' || !canEdit) return <span className="block w-[72px]" aria-hidden />;
        return (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => retry.mutate(e.id, {
              onSuccess: () => toast.success('Queued to send again'),
              onError: () => toast.error('Could not retry. Please try again.'),
            })}
          >
            <RotateCw className="h-3.5 w-3.5" />Retry
          </Button>
        );
      },
    },
  ], [canEdit, now, retry]);

  return (
    <DataTable
      columns={columns}
      data={list.data?.events ?? []}
      isLoading={list.isLoading}
      paginationMode="server"
      pageSize={PAGE_SIZE}
      pageIndex={page}
      pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
      totalRowCount={total}
      onPaginationChange={(p) => setPage(p.pageIndex)}
      pageSizeOptions={[PAGE_SIZE]}
      toolbarLeft={<h2 className="text-sm font-semibold text-foreground">Recent events</h2>}
      toolbarRight={
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Select value={destination || ALL} onValueChange={(v) => { setDestination(v === ALL ? '' : v); setPage(0); }}>
            <SelectTrigger className={cn(GHOST_CONTROL, 'h-8 w-auto gap-2 px-3 text-xs')} aria-label="Platform"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL} className="text-xs">All platforms</SelectItem>
              {destinations.map((d) => <SelectItem key={d.id} value={d.id} className="text-xs">{d.name || PLATFORMS[d.platform].label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={kind || ALL} onValueChange={(v) => { setKind(v === ALL ? '' : (v as EventKind)); setPage(0); }}>
            <SelectTrigger className={cn(GHOST_CONTROL, 'h-8 w-auto gap-2 px-3 text-xs')} aria-label="Event"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL} className="text-xs">All events</SelectItem>
              {(Object.keys(KIND_LABEL) as EventKind[]).map((k) => <SelectItem key={k} value={k} className="text-xs">{KIND_LABEL[k]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status || ALL} onValueChange={(v) => { setStatus(v === ALL ? '' : (v as ConversionStatus)); setPage(0); }}>
            <SelectTrigger className={cn(GHOST_CONTROL, 'h-8 w-auto gap-2 px-3 text-xs')} aria-label="Status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL} className="text-xs">Any status</SelectItem>
              {(Object.keys(STATUS_META) as ConversionStatus[]).map((s) => <SelectItem key={s} value={s} className="text-xs">{STATUS_META[s].label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      }
      emptyIcon={<Send className="h-6 w-6" />}
      emptyTitle={narrowed ? 'No matches' : 'Nothing sent yet'}
      emptyDescription={
        narrowed
          ? 'No conversion matches these filters.'
          : 'Conversions appear here as visitors who consented buy, sign up or fill in a form. Send a test event from a platform card to check the connection.'
      }
    />
  );
}
