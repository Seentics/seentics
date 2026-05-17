import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Radio, Globe, FileText } from 'lucide-react';
import { useSeentics } from '../context';
import { Skeleton, Card } from '../lib/ui';
import { fmt, t, getPathFromUrl, getPageName } from '../lib/utils';

export interface RealtimeCounterProps {
  siteId:     string;
  className?: string;
  style?:     React.CSSProperties;
  /** Show breakdown of top pages and countries. Default: true */
  showBreakdown?: boolean;
}

export function RealtimeCounter({ siteId, className, style, showBreakdown = true }: RealtimeCounterProps) {
  const { client } = useSeentics();

  const { data, isLoading } = useQuery({
    queryKey:        ['snc-realtime', siteId],
    queryFn:         () => client.getRealtime(siteId),
    enabled:         !!siteId,
    refetchInterval: 5_000,
  });

  const live      = data?.live_visitors ?? 0;
  const topPages  = (data?.top_pages ?? []).slice(0, 5);
  const topCountries = (data?.top_countries ?? []).slice(0, 5);

  return (
    <Card className={className} style={style}>
      {/* Live count */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: showBreakdown ? `1px solid ${t.border}` : 'none' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: `${t.emerald}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          position: 'relative',
        }}>
          <span style={{
            position: 'absolute', inset: 0, borderRadius: 12,
            background: `${t.emerald}15`,
            animation: 'snc-ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
          }} />
          <Radio size={22} color={t.emerald} />
        </div>

        <div>
          {isLoading
            ? <>
                <Skeleton style={{ width: 60, height: 32, marginBottom: 6 }} />
                <Skeleton style={{ width: 100, height: 12 }} />
              </>
            : <>
                <div style={{ fontSize: 36, fontWeight: 800, color: t.emerald, lineHeight: 1, letterSpacing: '-0.03em' }}>
                  {fmt.number(live)}
                </div>
                <div style={{ fontSize: 12, color: t.muted, marginTop: 4 }}>
                  visitor{live !== 1 ? 's' : ''} right now
                </div>
              </>
          }
        </div>
      </div>

      {/* Breakdown */}
      {showBreakdown && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: t.border }}>
          {/* Top pages */}
          <div style={{ background: '#fff', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <FileText size={12} color={t.muted} />
              <span style={{ fontSize: 11, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Pages</span>
            </div>
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} style={{ height: 12, marginBottom: 8 }} />)
              : topPages.length === 0
                ? <span style={{ fontSize: 11, color: t.muted }}>No data</span>
                : topPages.map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: i < topPages.length - 1 ? `1px solid ${t.border}` : 'none' }}>
                      <span style={{ fontSize: 11, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>
                        {getPageName(p.page)}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{p.count}</span>
                    </div>
                  ))
            }
          </div>

          {/* Top countries */}
          <div style={{ background: '#fff', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Globe size={12} color={t.muted} />
              <span style={{ fontSize: 11, fontWeight: 600, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Countries</span>
            </div>
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} style={{ height: 12, marginBottom: 8 }} />)
              : topCountries.length === 0
                ? <span style={{ fontSize: 11, color: t.muted }}>No data</span>
                : topCountries.map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: i < topCountries.length - 1 ? `1px solid ${t.border}` : 'none' }}>
                      <span style={{ fontSize: 11, color: '#111827' }}>{c.country || 'Unknown'}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{c.count}</span>
                    </div>
                  ))
            }
          </div>
        </div>
      )}
    </Card>
  );
}
