
'use client';

import { useState } from 'react';
import { Globe, MousePointerClick } from 'lucide-react';
import { getCountryCode } from '@/components/analytics/TopCountriesChart';
import { getSourceImage } from '@/components/analytics/TopSourcesChart';
import { formatMoney, type RevenueByRow } from '@/lib/revenue-analytics';

/** Which logo a row gets: a source's favicon or a country's flag, as on the overview. */
export type DimIcon = 'source' | 'country';

function iconSrc(kind: DimIcon, name: string): string | null {
  if (kind === 'country') {
    const code = getCountryCode(name);
    return code === 'UN' ? null : `/images/country/${code.toLowerCase()}.png`;
  }
  // "t.co / twitter" → "t.co": the favicon service wants a host.
  const host = name.split(/\s*\/\s*/)[0] ?? name;
  return getSourceImage(name) ?? (host.includes('.') ? `https://www.google.com/s2/favicons?domain=${host}&sz=32` : null);
}

function RowIcon({ kind, name }: { kind: DimIcon; name: string }) {
  const [failed, setFailed] = useState(false);
  const isDirect = kind === 'source' && name.toLowerCase() === 'direct';
  const src = isDirect ? null : iconSrc(kind, name);
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
      {isDirect ? (
        <MousePointerClick className="h-4 w-4 text-[#4285F4]" />
      ) : src && !failed ? (
        <img
          src={src} alt="" width={20} height={20} loading="lazy"
          className={kind === 'country' ? 'h-3.5 w-5 rounded-[2px] object-cover' : 'h-4 w-4 object-contain'}
          onError={() => setFailed(true)}
        />
      ) : (
        <Globe className="h-4 w-4 text-muted-foreground" />
      )}
    </span>
  );
}

/**
 * A ranked breakdown table — the same shape for products, channels, countries and
 * coupons, which is why the revenue page rendered it four times.
 */
export function DimTable({ rows, currency, emptyMessage, icon }: {
  rows: RevenueByRow[]; currency: string; emptyMessage: string; icon?: DimIcon;
}) {
  if (!rows.length) {
    return <div className="py-10 text-center text-sm text-muted-foreground">{emptyMessage}</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-2.5 pr-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Name</th>
            <th className="py-2.5 pr-4 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Revenue</th>
            <th className="py-2.5 pr-4 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Orders</th>
            <th className="py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-[140px]">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
              <td className="py-2.5 pr-4 font-medium text-foreground max-w-[220px]" title={r.name}>
                <div className="flex min-w-0 items-center gap-2.5">
                  {icon && <RowIcon kind={icon} name={r.name} />}
                  <span className="truncate">{r.name}</span>
                </div>
              </td>
              <td className="py-2.5 pr-4 text-right tabular-nums font-semibold text-foreground">{formatMoney(r.revenue, currency)}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">{r.orders.toLocaleString()}</td>
              <td className="py-2.5">
                <div className="flex items-center justify-end gap-2">
                  <span className="text-xs text-muted-foreground w-9 text-right tabular-nums">{r.share_pct.toFixed(1)}%</span>
                  <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary/70 rounded-full" style={{ width: `${Math.min(100, r.share_pct)}%` }} />
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
