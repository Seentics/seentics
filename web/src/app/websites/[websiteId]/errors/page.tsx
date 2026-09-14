'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, ChevronLeft } from 'lucide-react';
import { ErrorGroupDetail } from '@/components/errors/error-group-detail';
import { ErrorGroupList } from '@/components/errors/error-group-list';
import { useErrorGroup, useErrorGroups } from '@/features/errors/queries';
import { useSetErrorStatus } from '@/features/errors/mutations';

/**
 * Route composition only.
 *
 * This file chooses what to show and owns route-specific concerns — the selected
 * fingerprint, the filters, and where "watch replay" navigates to. Data access lives in
 * `features/errors`, and every piece of markup below the filters is a component that
 * takes data as props. See `docs/component-and-data-architecture.md`.
 */

const RANGES = [
  { value: '1',  label: 'Last 24 hours' },
  { value: '7',  label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
];

const STATUSES = [
  { value: 'unresolved', label: 'Unresolved' },
  { value: 'resolved',   label: 'Resolved' },
  { value: 'ignored',    label: 'Ignored' },
  { value: 'all',        label: 'All' },
];

export default function ErrorsPage() {
  const params    = useParams();
  const router    = useRouter();
  const websiteId = params?.websiteId as string;

  const [days,   setDays]   = useState(7);
  const [status, setStatus] = useState('unresolved');
  const [search, setSearch] = useState('');
  const [openFingerprint, setOpenFingerprint] = useState<string | null>(null);

  // The API treats an empty status as "every status"; the select calls that "all".
  const filters = { days, status: status === 'all' ? '' : status, search };

  const { data: groups, isLoading, error } = useErrorGroups(websiteId, filters);
  const detail    = useErrorGroup(websiteId, openFingerprint, days);
  const setStatusMutation = useSetErrorStatus(websiteId);

  const watchReplay = (sessionId: string) =>
    router.push(`/websites/${websiteId}/replays/${sessionId}`);

  if (openFingerprint) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-2 px-4 pt-4 sm:px-6">
          <Button
            variant="ghost" size="sm"
            onClick={() => setOpenFingerprint(null)}
            className="h-8 gap-1 px-2"
          >
            <ChevronLeft className="h-4 w-4" /> All errors
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-6">
          {detail.isLoading || !detail.data?.group ? (
            <div className="mt-3 h-40 animate-pulse rounded-xl bg-muted/50" />
          ) : (
            <ErrorGroupDetail
              className="mt-3"
              group={detail.data.group}
              samples={detail.data.samples}
              isUpdating={setStatusMutation.isPending}
              onWatchReplay={watchReplay}
              onSetStatus={(next) =>
                setStatusMutation.mutate({ fingerprint: openFingerprint, status: next })
              }
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DashboardPageHeader
        title="Errors"
        description="Uncaught JavaScript errors from real visitors, grouped by fault."
        websiteId={websiteId}
      />

      <div className="flex flex-wrap items-center gap-2 px-4 pb-3 sm:px-6">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search message or file…"
            className="h-9 pl-8"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="px-4 pb-3 sm:px-6">
          <Alert variant="destructive">
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-6">
        <ErrorGroupList
          groups={groups ?? []}
          isLoading={isLoading}
          status={status}
          onOpen={setOpenFingerprint}
        />
      </div>
    </div>
  );
}
