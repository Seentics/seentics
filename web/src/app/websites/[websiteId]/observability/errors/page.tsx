'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useErrorGroups, useUpdateErrorStatus, ErrorGroup } from '@/lib/observability-api';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle, EyeOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_BADGE: Record<string, string> = {
  open:     'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300',
  resolved: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300',
  ignored:  'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400',
};

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ErrorGroupRow({ group, projectId }: { group: ErrorGroup; projectId: string }) {
  const { mutate: updateStatus, isPending } = useUpdateErrorStatus();

  return (
    <div className="flex items-start gap-4 px-5 py-4 border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
            {group.error_type}
          </span>
          <span className="text-xs text-muted-foreground">{group.service}</span>
          <Badge className={cn('text-[10px] px-1.5 py-0 h-4 rounded border text-[10px]', STATUS_BADGE[group.status])}>
            {group.status}
          </Badge>
        </div>
        <p className="text-sm font-medium text-foreground truncate">{group.message}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span>First: {timeSince(group.first_seen)}</span>
          <span>Last: {timeSince(group.last_seen)}</span>
          <span className="font-semibold text-foreground">{group.count.toLocaleString()} occurrences</span>
        </div>
      </div>

      {/* Status actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {group.status !== 'resolved' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
            disabled={isPending}
            onClick={() => updateStatus({ fingerprint: group.fingerprint, projectId, status: 'resolved' })}
          >
            <CheckCircle className="h-3 w-3" />
            Resolve
          </Button>
        )}
        {group.status !== 'ignored' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1 text-muted-foreground"
            disabled={isPending}
            onClick={() => updateStatus({ fingerprint: group.fingerprint, projectId, status: 'ignored' })}
          >
            <EyeOff className="h-3 w-3" />
            Ignore
          </Button>
        )}
        {group.status !== 'open' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1 text-muted-foreground"
            disabled={isPending}
            onClick={() => updateStatus({ fingerprint: group.fingerprint, projectId, status: 'open' })}
          >
            Re-open
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ErrorsPage() {
  const params = useParams();
  const projectId = params?.websiteId as string;

  const [status, setStatus] = useState('open');
  const [service, setService] = useState('');

  const { data, isLoading, refetch } = useErrorGroups(projectId, service || undefined, status || undefined);
  const groups = data?.groups ?? [];

  const openCount   = groups.filter(g => g.status === 'open').length;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <DashboardPageHeader
        title="Error Tracking"
        description="Errors are automatically grouped by fingerprint. Resolve or ignore to keep your inbox clean."
        icon={AlertTriangle}
      >
        <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </DashboardPageHeader>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Open',     value: groups.filter(g => g.status === 'open').length,     color: 'text-red-600' },
          { label: 'Resolved', value: groups.filter(g => g.status === 'resolved').length, color: 'text-green-600' },
          { label: 'Ignored',  value: groups.filter(g => g.status === 'ignored').length,  color: 'text-muted-foreground' },
        ].map(s => (
          <Card key={s.label} className="border border-border/60">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
              <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <Select value={status || 'all'} onValueChange={v => setStatus(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All statuses</SelectItem>
            <SelectItem value="open" className="text-xs">Open</SelectItem>
            <SelectItem value="resolved" className="text-xs">Resolved</SelectItem>
            <SelectItem value="ignored" className="text-xs">Ignored</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Error groups */}
      <Card className="border border-border/60">
        <CardContent className="p-0">
          {isLoading ? (
            <div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-4 px-5 py-4 border-b border-border/40">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                </div>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              {status === 'open'
                ? 'No open errors. Your services are looking healthy!'
                : 'No errors found for the selected filter.'}
            </div>
          ) : (
            groups.map(group => (
              <ErrorGroupRow key={group.fingerprint} group={group} projectId={projectId} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
