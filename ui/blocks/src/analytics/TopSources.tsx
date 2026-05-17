import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Globe, Search, Share2, Link } from 'lucide-react';
import { useSeentics } from '../context';
import { Skeleton, Card, Empty, Tabs, BarRow } from '../lib/ui';
import { fmt, t } from '../lib/utils';

export interface TopSourcesProps {
  siteId:     string;
  days?:      number;
  limit?:     number;
  className?: string;
  style?:     React.CSSProperties;
}

const SOCIAL_DOMAINS = new Set(['facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'linkedin.com', 'reddit.com', 'tiktok.com', 'youtube.com', 'pinterest.com']);
const SEARCH_DOMAINS = new Set(['google.com', 'bing.com', 'yahoo.com', 'duckduckgo.com', 'baidu.com', 'yandex.com']);

function classify(referrer: string): 'search' | 'social' | 'direct' | 'other' {
  if (!referrer || referrer === 'direct') return 'direct';
  try {
    const host = new URL(referrer.startsWith('http') ? referrer : 'https://' + referrer).hostname.replace('www.', '');
    if (SEARCH_DOMAINS.has(host)) return 'search';
    if (SOCIAL_DOMAINS.has(host)) return 'social';
  } catch { /* ignore */ }
  return 'other';
}

function canonicalize(referrer: string): string {
  if (!referrer || referrer === 'direct') return 'Direct';
  try {
    return new URL(referrer.startsWith('http') ? referrer : 'https://' + referrer).hostname.replace('www.', '');
  } catch { return referrer; }
}

const TABS = ['All', 'Search', 'Social', 'Direct'];

export function TopSources({ siteId, days = 7, limit = 10, className, style }: TopSourcesProps) {
  const { client } = useSeentics();
  const [tab, setTab] = useState('All');

  const { data, isLoading } = useQuery({
    queryKey: ['snc-sources', siteId, days],
    queryFn:  () => client.getSources(siteId, days),
    enabled:  !!siteId,
  });

  const all     = data?.top_referrers ?? [];
  const filtered = tab === 'All'    ? all
    : tab === 'Search' ? all.filter(r => classify(r.referrer) === 'search')
    : tab === 'Social' ? all.filter(r => classify(r.referrer) === 'social')
    : all.filter(r => classify(r.referrer) === 'direct');

  const sliced = filtered.slice(0, limit);
  const max    = sliced[0]?.views ?? 1;

  const tabIcon = (cls: string) => {
    if (cls === 'search') return <Search size={13} color={t.primary} />;
    if (cls === 'social') return <Share2 size={13} color={t.orange} />;
    if (cls === 'direct') return <Link size={13} color={t.muted} />;
    return <Globe size={13} color={t.muted} />;
  };

  return (
    <Card className={className} style={style}>
      <div style={{ padding: '14px 16px 0', borderBottom: `1px solid ${t.border}` }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', display: 'block', marginBottom: 10 }}>Traffic Sources</span>
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', background: 'rgba(0,0,0,0.02)' }}>
        <span style={{ fontSize: 11, color: t.muted, fontWeight: 500 }}>Source</span>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ fontSize: 11, color: t.muted, fontWeight: 500, minWidth: 40, textAlign: 'right' }}>Visitors</span>
          <span style={{ fontSize: 11, color: t.muted, fontWeight: 500, minWidth: 40, textAlign: 'right' }}>Views</span>
        </div>
      </div>

      <div className="snc-scrollbar" style={{ maxHeight: 320, overflowY: 'auto' }}>
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ padding: '10px 12px', borderBottom: `1px solid ${t.border}`, display: 'flex', gap: 8, alignItems: 'center' }}>
                <Skeleton style={{ width: 28, height: 28, borderRadius: 6 }} />
                <Skeleton style={{ flex: 1, height: 12 }} />
                <Skeleton style={{ width: 60, height: 12 }} />
              </div>
            ))
          : sliced.length === 0
            ? <Empty icon={<Globe size={28} />} message="No source data yet" />
            : sliced.map((ref, i) => {
                const cls  = classify(ref.referrer);
                const name = canonicalize(ref.referrer);
                return (
                  <BarRow
                    key={i}
                    value={ref.views}
                    max={max}
                    label={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {tabIcon(cls)}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>{name}</span>
                      </div>
                    }
                    right={
                      <>
                        <span style={{ fontSize: 12, fontWeight: 600, minWidth: 40, textAlign: 'right' }}>{fmt.number(ref.unique)}</span>
                        <span style={{ fontSize: 12, color: t.muted,  minWidth: 40, textAlign: 'right' }}>{fmt.number(ref.views)}</span>
                      </>
                    }
                  />
                );
              })
        }
      </div>
    </Card>
  );
}
