import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useSeentics } from '../context';
import { Skeleton, Card, Empty } from '../lib/ui';
import { fmt, t } from '../lib/utils';
import { TrendingUp } from 'lucide-react';

export interface TrafficChartProps {
  siteId:     string;
  days?:      number;
  height?:    number;
  className?: string;
  style?:     React.CSSProperties;
}

const VISITORS_COLOR  = t.primary;
const PAGEVIEWS_COLOR = t.primaryLight;

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const date = new Date(label).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return (
    <div style={{
      background: '#fff', border: `1px solid ${t.border}`, borderRadius: 8,
      padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      fontSize: 12, minWidth: 160,
    }}>
      <p style={{ fontSize: 11, color: t.muted, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${t.border}`, margin: '0 0 8px' }}>{date}</p>
      {[...payload].reverse().map((e: any) => (
        <div key={e.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 32, padding: '2px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.color, display: 'block', flexShrink: 0 }} />
            <span style={{ color: t.muted }}>{e.dataKey === 'views' ? 'Page Views' : 'Visitors'}</span>
          </div>
          <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt.number(e.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function TrafficChart({ siteId, days = 7, height = 320, className, style }: TrafficChartProps) {
  const { client } = useSeentics();

  const { data, isLoading } = useQuery({
    queryKey:        ['snc-timeseries', siteId, days],
    queryFn:         () => client.getTimeseries(siteId, days),
    enabled:         !!siteId,
    refetchInterval: 30_000,
  });

  const chartData = (data?.daily_stats ?? []).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <Card className={className} style={{ ...style }}>
      <div style={{ padding: '16px 20px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <TrendingUp size={15} color={t.muted} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Traffic</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          {[{ color: VISITORS_COLOR, label: 'Visitors' }, { color: PAGEVIEWS_COLOR, label: 'Page Views' }].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, display: 'block' }} />
              <span style={{ fontSize: 11, color: t.muted }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ height, padding: '0 4px 8px' }}>
        {isLoading ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 16px 24px' }}>
            <Skeleton style={{ height: '60%', borderRadius: '12px 12px 0 0', opacity: 0.15 }} />
          </div>
        ) : chartData.length === 0 ? (
          <Empty icon={<TrendingUp size={32} />} message="No traffic data yet" sub="Data will appear once visitors arrive" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 16, right: 24, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="snc-fill-views" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={PAGEVIEWS_COLOR} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={PAGEVIEWS_COLOR} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="snc-fill-visitors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={VISITORS_COLOR} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={VISITORS_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
              <XAxis
                dataKey="date"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tick={{ fill: t.muted }}
                tickFormatter={d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                interval="preserveStartEnd"
                dy={6}
              />
              <YAxis
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tick={{ fill: t.muted }}
                tickFormatter={v => fmt.number(v)}
                width={36}
                tickCount={4}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: t.border, strokeDasharray: '4 3', strokeWidth: 1 }} />
              <Area type="monotone" dataKey="views"  stroke={PAGEVIEWS_COLOR} strokeWidth={1.5} fill="url(#snc-fill-views)"    dot={false} activeDot={{ r: 4, fill: PAGEVIEWS_COLOR }} />
              <Area type="monotone" dataKey="unique" stroke={VISITORS_COLOR}  strokeWidth={2}   fill="url(#snc-fill-visitors)" dot={false} activeDot={{ r: 4, fill: VISITORS_COLOR }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
