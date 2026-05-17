import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Eye, TrendingDown, Users, Activity, Radio } from 'lucide-react';
import { useSeentics } from '../context';
import { Skeleton, Card, GrowthBadge } from '../lib/ui';
import { fmt, t } from '../lib/utils';

export interface AnalyticsSummaryProps {
  siteId:    string;
  days?:     number;
  className?: string;
  style?:    React.CSSProperties;
}

interface CardDef {
  title:     string;
  icon:      React.ElementType;
  value:     number;
  prev?:     number;
  format:    'number' | 'duration' | 'percent';
  inverse?:  boolean;
  live?:     boolean;
}

export function AnalyticsSummary({ siteId, days = 7, className, style }: AnalyticsSummaryProps) {
  const { client } = useSeentics();

  const { data, isLoading } = useQuery({
    queryKey:        ['snc-overview', siteId, days],
    queryFn:         () => client.getOverview(siteId, days),
    enabled:         !!siteId,
    refetchInterval: 30_000,
  });

  const formatValue = (val: number, format: CardDef['format']) => {
    if (format === 'duration') return fmt.duration(val);
    if (format === 'percent')  return fmt.percent(val);
    return fmt.number(val);
  };

  const cards: CardDef[] = data ? [
    { title: 'Live Visitors',    icon: Radio,        value: data.live_visitors,    format: 'number',   live: true },
    { title: 'Total Visitors',   icon: Users,        value: data.total_visitors,   prev: data.comparison?.previous_period?.total_visitors,   format: 'number' },
    { title: 'Unique Visitors',  icon: Activity,     value: data.unique_visitors,  prev: data.comparison?.previous_period?.unique_visitors,   format: 'number' },
    { title: 'Page Views',       icon: Eye,          value: data.page_views,       prev: data.comparison?.previous_period?.page_views,        format: 'number' },
    { title: 'Session Duration', icon: Clock,        value: data.session_duration, prev: data.comparison?.previous_period?.avg_session_time,  format: 'duration' },
    { title: 'Bounce Rate',      icon: TrendingDown, value: data.bounce_rate,      prev: data.comparison?.previous_period?.bounce_rate,       format: 'percent', inverse: true },
  ] : [];

  return (
    <Card className={className} style={{ marginBottom: 24, ...style }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        borderBottom: `1px solid ${t.border}`,
      }}>
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ padding: 20, borderRight: `1px solid ${t.border}` }}>
                <Skeleton style={{ width: 80, height: 10, marginBottom: 16 }} />
                <Skeleton style={{ width: 60, height: 22, marginBottom: 8 }} />
                <Skeleton style={{ width: 40, height: 10 }} />
              </div>
            ))
          : cards.map((card, i) => (
              <SummaryCard key={i} {...card} formatValue={formatValue} />
            ))
        }
      </div>
    </Card>
  );
}

function SummaryCard({ title, icon: Icon, value, prev, format, inverse, live, formatValue }: CardDef & {
  formatValue: (v: number, f: CardDef['format']) => string;
}) {
  return (
    <div style={{
      padding: 20, borderRight: `1px solid ${t.border}`,
      transition: 'background 0.15s',
    }}>
      {/* Icon + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          background: 'rgba(0,0,0,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {live
            ? (
              <span style={{ position: 'relative', display: 'flex', width: 8, height: 8 }}>
                <span style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: t.emerald, opacity: 0.75,
                  animation: 'snc-ping 1.2s cubic-bezier(0,0,0.2,1) infinite',
                }} />
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.emerald, display: 'block' }} />
              </span>
            )
            : <Icon size={14} color={t.muted} />
          }
        </div>
        <span style={{ fontSize: 11, fontWeight: 500, color: t.muted }}>{title}</span>
      </div>

      {/* Value */}
      <div style={{
        fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1,
        marginBottom: 8, color: live ? t.emerald : '#111827',
      }}>
        {formatValue(value, format)}
      </div>

      {/* Growth */}
      {prev !== undefined && (
        <GrowthBadge current={value} previous={prev} inverse={inverse} />
      )}
    </div>
  );
}
