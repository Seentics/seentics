import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Workflow, ChevronDown } from 'lucide-react';
import { useSeentics } from '../context';
import { Skeleton, Card, Empty } from '../lib/ui';
import { fmt, t } from '../lib/utils';
import type { Funnel } from '../lib/types';

export interface FunnelChartProps {
  siteId:     string;
  funnelId?:  string; // if omitted, shows funnel picker
  days?:      number;
  className?: string;
  style?:     React.CSSProperties;
}

function FunnelDetail({ funnel, days, siteId }: { funnel: Funnel; days: number; siteId: string }) {
  const { client } = useSeentics();

  const { data: detail, isLoading } = useQuery({
    queryKey: ['snc-funnel', siteId, funnel.id, days],
    queryFn:  () => client.getFunnel(siteId, funnel.id),
    enabled:  !!funnel.id,
  });

  const steps     = detail?.stats?.step_breakdown ?? [];
  const chartData = steps.map(s => ({
    name:       s.name,
    entries:    s.entries,
    completion: s.conversion,
  }));
  const max = steps[0]?.entries ?? 1;

  return (
    <div style={{ padding: '0 0 8px' }}>
      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, borderBottom: `1px solid ${t.border}`, background: t.border }}>
        {[
          { label: 'Total Entries',    value: fmt.number(detail?.stats?.total_entries ?? 0) },
          { label: 'Completions',      value: fmt.number(detail?.stats?.completions ?? 0) },
          { label: 'Conversion Rate',  value: fmt.percent(detail?.stats?.conversion_rate ?? 0) },
        ].map(m => (
          <div key={m.label} style={{ background: '#fff', padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{m.value}</div>
            <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      {isLoading
        ? <div style={{ padding: 16 }}><Skeleton style={{ height: 140 }} /></div>
        : steps.length === 0
          ? <Empty icon={<Workflow size={28} />} message="No funnel data yet" sub="Traffic data will appear once events are tracked" />
          : (
            <div style={{ padding: '16px 8px 0' }}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: t.muted }} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} tick={{ fill: t.muted }} tickFormatter={v => fmt.number(v)} width={36} />
                  <Tooltip
                    formatter={(v: number, name: string) => [fmt.number(v), name === 'entries' ? 'Entries' : 'Conversion']}
                    contentStyle={{ borderRadius: 8, border: `1px solid ${t.border}`, fontSize: 12 }}
                  />
                  <Bar dataKey="entries" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={`${t.primary}${Math.round(255 - (i / Math.max(chartData.length - 1, 1)) * 150).toString(16).padStart(2, '0')}`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Step list */}
              <div style={{ padding: '8px 8px 0' }}>
                {steps.map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 8px', borderBottom: i < steps.length - 1 ? `1px solid ${t.border}` : 'none' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: t.primary, color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 10 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>{step.name}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                        <div style={{ height: 4, flex: 1, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(step.entries / max) * 100}%`, background: t.primary, borderRadius: 2, transition: 'width 0.4s' }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', marginLeft: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{fmt.number(step.entries)}</div>
                      <div style={{ fontSize: 11, color: step.conversion < 50 ? t.rose : t.emerald }}>{fmt.percent(step.conversion)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
      }
    </div>
  );
}

export function FunnelChart({ siteId, funnelId, days = 30, className, style }: FunnelChartProps) {
  const { client } = useSeentics();
  const [selected, setSelected] = useState<string | undefined>(funnelId);
  const [open, setOpen] = useState(false);

  const { data: funnelsData, isLoading } = useQuery({
    queryKey: ['snc-funnels', siteId],
    queryFn:  () => client.getFunnels(siteId),
    enabled:  !!siteId,
    onSuccess: (d) => { if (!selected && d.funnels[0]) setSelected(d.funnels[0].id); },
  } as any);

  const funnels     = (funnelsData as any)?.funnels ?? [];
  const activeFunnel = funnels.find((f: Funnel) => f.id === selected);

  return (
    <Card className={className} style={style}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Workflow size={15} color={t.muted} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Funnel Analysis</span>
        </div>

        {/* Funnel picker */}
        {funnels.length > 1 && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.04)',
                border: `1px solid ${t.border}`, borderRadius: 6, padding: '4px 10px',
                fontSize: 12, cursor: 'pointer', color: '#111827',
              }}
            >
              {activeFunnel?.name ?? 'Select funnel'}
              <ChevronDown size={12} />
            </button>
            {open && (
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: 4, background: '#fff',
                border: `1px solid ${t.border}`, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                zIndex: 10, minWidth: 160, overflow: 'hidden',
              }}>
                {funnels.map((f: Funnel) => (
                  <button key={f.id} onClick={() => { setSelected(f.id); setOpen(false); }} style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px',
                    background: f.id === selected ? `${t.primary}10` : 'transparent',
                    border: 'none', cursor: 'pointer', fontSize: 12, color: '#111827',
                  }}>
                    {f.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {isLoading
        ? <div style={{ padding: 16 }}><Skeleton style={{ height: 200 }} /></div>
        : funnels.length === 0
          ? <Empty icon={<Workflow size={32} />} message="No funnels configured" sub="Create funnels in your Seentics dashboard" />
          : activeFunnel
            ? <FunnelDetail funnel={activeFunnel} days={days} siteId={siteId} />
            : null
      }
    </Card>
  );
}
