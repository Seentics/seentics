
import { formatMoney, type RevenueByRow } from '@/lib/revenue-analytics';

/**
 * A ranked breakdown table — the same shape for products, channels, countries and
 * coupons, which is why the revenue page rendered it four times.
 */
export function DimTable({ rows, currency, emptyMessage }: {
  rows: RevenueByRow[]; currency: string; emptyMessage: string;
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
              <td className="py-2.5 pr-4 font-medium text-foreground max-w-[180px] truncate" title={r.name}>{r.name}</td>
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
