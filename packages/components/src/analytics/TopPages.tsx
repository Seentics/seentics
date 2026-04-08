import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Globe, Home, FileText, ShoppingCart, Settings, LogIn, BarChart3, DollarSign, Info, Phone } from 'lucide-react';
import { useSeentics } from '../context';
import { Skeleton, Card, Empty, Tabs, BarRow } from '../lib/ui';
import { fmt, t, getPathFromUrl, getPageName } from '../lib/utils';

export interface TopPagesProps {
  siteId:     string;
  days?:      number;
  limit?:     number;
  className?: string;
  style?:     React.CSSProperties;
}

function pageIcon(url: string) {
  const path = getPathFromUrl(url).toLowerCase();
  const sz = 14;
  if (path === '/')                               return <Home        size={sz} color="#6366f1" />;
  if (path.includes('/blog') || path.includes('/post')) return <FileText   size={sz} color="#10b981" />;
  if (path.includes('/about'))                    return <Info        size={sz} color="#6366f1" />;
  if (path.includes('/contact'))                  return <Phone       size={sz} color="#f59e0b" />;
  if (path.includes('/pricing'))                  return <DollarSign  size={sz} color="#f59e0b" />;
  if (path.includes('/analytics'))               return <BarChart3   size={sz} color="#6366f1" />;
  if (path.includes('/auth') || path.includes('/login')) return <LogIn  size={sz} color="#6b7280" />;
  if (path.includes('/settings'))                 return <Settings    size={sz} color="#6b7280" />;
  if (path.includes('/cart'))                     return <ShoppingCart size={sz} color="#6366f1" />;
  return <Globe size={sz} color="#6366f1" />;
}

export function TopPages({ siteId, days = 7, limit = 10, className, style }: TopPagesProps) {
  const { client } = useSeentics();
  const [tab, setTab] = useState('Top Pages');

  const { data, isLoading } = useQuery({
    queryKey: ['snc-top-pages', siteId, days],
    queryFn:  () => client.getTopPages(siteId, days),
    enabled:  !!siteId,
  });

  const pages = (data?.top_pages ?? []).slice(0, limit);
  const max   = pages[0]?.views ?? 1;

  return (
    <Card className={className} style={style}>
      <div style={{ padding: '14px 16px 0', borderBottom: `1px solid ${t.border}` }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', display: 'block', marginBottom: 10 }}>Top Pages</span>
        <Tabs tabs={['Top Pages', 'Entry Pages', 'Exit Pages']} active={tab} onChange={setTab} />
      </div>

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', background: 'rgba(0,0,0,0.02)' }}>
        <span style={{ fontSize: 11, color: t.muted, fontWeight: 500 }}>Page</span>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ fontSize: 11, color: t.muted, fontWeight: 500, minWidth: 40, textAlign: 'right' }}>Views</span>
          <span style={{ fontSize: 11, color: t.muted, fontWeight: 500, minWidth: 48, textAlign: 'right' }}>Bounce</span>
        </div>
      </div>

      <div className="snc-scrollbar" style={{ maxHeight: 320, overflowY: 'auto' }}>
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ padding: '10px 12px', borderBottom: `1px solid ${t.border}`, display: 'flex', gap: 8, alignItems: 'center' }}>
                <Skeleton style={{ width: 24, height: 24, borderRadius: 6 }} />
                <Skeleton style={{ flex: 1, height: 12 }} />
                <Skeleton style={{ width: 40, height: 12 }} />
              </div>
            ))
          : pages.length === 0
            ? <Empty icon={<Globe size={28} />} message="No page data yet" />
            : pages.map((page, i) => (
                <BarRow
                  key={i}
                  value={page.views}
                  max={max}
                  label={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {pageIcon(page.page)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getPageName(page.page)}</div>
                        <div style={{ fontSize: 11, color: t.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getPathFromUrl(page.page)}</div>
                      </div>
                    </div>
                  }
                  right={
                    <>
                      <span style={{ fontSize: 12, fontWeight: 600, minWidth: 40, textAlign: 'right' }}>{fmt.number(page.views)}</span>
                      <span style={{ fontSize: 12, color: t.muted, minWidth: 48, textAlign: 'right' }}>{page.bounce_rate != null ? fmt.percent(page.bounce_rate) : '—'}</span>
                    </>
                  }
                />
              ))
        }
      </div>
    </Card>
  );
}
