import { cn } from '@/lib/utils';
import { formatValue } from '@/features/ai/format';
import type { DisplayBlock } from '@/features/ai/types';

type Props = { block: Extract<DisplayBlock, { kind: 'table' }>; className?: string };

/** A ranked table. Scrolls inside its own box so a wide result never widens the chat. */
export function TableBlock({ block, className }: Props) {
  if (!block.rows.length) return null;
  return (
    <div className={cn('overflow-x-auto rounded-xl border border-border', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {block.columns.map((c) => (
              <th key={c.key} className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {block.columns.map((c) => (
                <td key={c.key} className="whitespace-nowrap px-3 py-2 text-foreground">
                  {formatValue(row[c.key], c.format)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
