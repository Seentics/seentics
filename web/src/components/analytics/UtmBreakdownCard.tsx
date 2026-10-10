import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartErrorBoundary } from '@/components/analytics/ChartErrorBoundary';
import { UTMPerformanceChart } from '@/components/analytics/UTMPerformanceChart';
import { cn } from '@/lib/utils';

export type UtmTab = 'sources' | 'mediums' | 'campaigns' | 'terms' | 'content';

const TABS: { value: UtmTab; label: string }[] = [
  { value: 'sources',   label: 'Sources' },
  { value: 'mediums',   label: 'Mediums' },
  { value: 'campaigns', label: 'Campaigns' },
];

export interface UtmBreakdownCardProps {
  /** `utm_performance` from the custom-events payload. */
  data: unknown;
  tab: UtmTab;
  onTabChange: (tab: UtmTab) => void;
  isLoading?: boolean;
  title?: string;
  className?: string;
}

/**
 * UTM breakdown, with its own tab strip.
 *
 * The tab list was built inline with the same forty-character class string repeated on
 * each of the three triggers, so adding a fourth meant copying it again. It is a map
 * now, and `TABS` is the only place a tab is declared.
 *
 * The selected tab stays controlled from outside: the overview keeps it in the URL, and
 * a component that owned it privately could not be driven that way.
 */
export function UtmBreakdownCard({
  data,
  tab,
  onTabChange,
  isLoading,
  title = 'UTM breakdown',
  className,
}: UtmBreakdownCardProps) {
  return (
    <Card className={cn('overflow-hidden border border-border bg-card', className)}>
      <CardHeader className="border-b border-border p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3 className="min-w-0 shrink-0 whitespace-nowrap text-sm font-semibold tracking-tight">{title}</h3>
          <Tabs
            value={tab}
            onValueChange={(v) => onTabChange(v as UtmTab)}
            className="w-full shrink-0 md:w-auto"
          >
            <TabsList className="grid h-8 w-full grid-cols-3 rounded-lg bg-muted p-0.5">
              {TABS.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="h-7 rounded-lg text-xs font-medium data-[state=active]:bg-card data-[state=inactive]:bg-transparent data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground data-[state=active]:shadow-sm"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <ChartErrorBoundary label="UTM breakdown">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <UTMPerformanceChart data={data as any} isLoading={isLoading} controlledTab={tab} />
        </ChartErrorBoundary>
      </CardContent>
    </Card>
  );
}
