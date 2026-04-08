import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Target, MousePointerClick, Eye } from 'lucide-react';
import { useSeentics } from '../context';
import { Skeleton, Card, Empty } from '../lib/ui';
import { fmt, t } from '../lib/utils';

export interface GoalConversionsProps {
  siteId:     string;
  days?:      number;
  limit?:     number;
  className?: string;
  style?:     React.CSSProperties;
}

export function GoalConversions({ siteId, days = 7, limit = 10, className, style }: GoalConversionsProps) {
  const { client } = useSeentics();

  const { data: eventsData, isLoading: eventsLoading }     = useQuery({
    queryKey: ['snc-events', siteId, days],
    queryFn:  () => client.getEvents(siteId, days),
    enabled:  !!siteId,
  });
  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ['snc-overview', siteId, days],
    queryFn:  () => client.getOverview(siteId, days),
    enabled:  !!siteId,
  });

  const isLoading   = eventsLoading || overviewLoading;
  const items       = (eventsData?.events ?? []).slice(0, limit);
  const maxCount    = items[0]?.count ?? 1;
  const totalVisitors = overviewData?.total_visitors ?? 0;

  const convRate = (count: number) => {
    if (!totalVisitors) return null;
    return fmt.percent((count / totalVisitors) * 100);
  };

  const isPageGoal = (props?: Record<string, unknown>) =>
    props && Object.keys(props).length === 1 && 'page' in props;

  return (
    <Card className={className} style={style}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Target size={15} color={t.muted} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Goal Conversions</span>
      </div>

      <div className="snc-scrollbar" style={{ maxHeight: 400, overflowY: 'auto' }}>
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${t.border}` }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Skeleton style={{ width: 32, height: 32, borderRadius: 6 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Skeleton style={{ width: 100, height: 12 }} />
                    <Skeleton style={{ width: 60, height: 10 }} />
                  </div>
                </div>
                <Skeleton style={{ width: 48, height: 18, borderRadius: 4 }} />
              </div>
            ))
          : items.length === 0
            ? <Empty icon={<Target size={32} />} message="No goals configured" sub="Use window.seentics.track() to fire custom events" />
            : items.map((item, idx) => {
                const pct      = isPageGoal(item.sample_properties);
                const barWidth = (item.count / maxCount) * 100;
                const rate     = convRate(item.count);

                return (
                  <div key={idx} style={{
                    position: 'relative', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', padding: '10px 16px',
                    borderBottom: `1px solid ${t.border}`,
                  }}>
                    {/* Background bar */}
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${barWidth}%`,
                      background: `${t.primary}06`,
                      borderRadius: '0 4px 4px 0',
                    }} />

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                        background: pct ? `${t.primary}10` : `${t.emerald}10`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {pct
                          ? <Eye size={15} color={t.primary} />
                          : <MousePointerClick size={15} color={t.emerald} />
                        }
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.event_type}
                        </div>
                        {rate && (
                          <div style={{ fontSize: 11, color: t.muted }}>{rate} conversion</div>
                        )}
                      </div>
                    </div>

                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{fmt.number(item.count)}</span>
                    </div>
                  </div>
                );
              })
        }
      </div>
    </Card>
  );
}
