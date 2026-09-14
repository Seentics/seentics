import { Card, CardContent } from '@/components/ui/card';
import { ChartErrorBoundary } from '@/components/analytics/ChartErrorBoundary';
import { GeolocationOverview } from '@/components/analytics/GeolocationOverview';
import { TopDevicesChart } from '@/components/analytics/TopDevicesChart';
import { TopPagesChart } from '@/components/analytics/TopPagesChart';
import { TopSourcesChart } from '@/components/analytics/TopSourcesChart';
import { UtmBreakdownCard, type UtmTab } from '@/components/analytics/UtmBreakdownCard';
import { cn } from '@/lib/utils';

/** One panel's data plus whether it is still arriving. Each loads independently. */
interface Panel<T> {
  data: T;
  isLoading?: boolean;
}

export interface AudienceSectionProps {
  pages: Panel<unknown> & {
    entryPages?: unknown;
    exitPages?: unknown;
  };
  sources: Panel<unknown>;
  geolocation: Panel<unknown>;
  devices: Panel<unknown> & { osData: unknown; browserData: unknown };
  utm: Panel<unknown> & { tab: UtmTab; onTabChange: (tab: UtmTab) => void };
  /** Rendered below the grid — the overview passes its goals section here. */
  footer?: React.ReactNode;
  className?: string;
}

/**
 * The audience half of the overview: pages, sources, geography, devices and UTM.
 *
 * The grid and the card chrome were a hundred lines inline in the page, with
 * `<Card><CardContent className="p-5">` repeated around every chart. They belong
 * together — this is one section with one layout — and pulling it out is what lets the
 * same arrangement appear on a shared report or a demo route.
 *
 * Each panel takes its own `isLoading` rather than one flag for the section, because the
 * queries behind them resolve separately and a single spinner would hold finished charts
 * back until the slowest one landed.
 */
export function AudienceSection({
  pages, sources, geolocation, devices, utm, footer, className,
}: AudienceSectionProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="border border-border bg-card">
          <CardContent className="p-5">
            <ChartErrorBoundary label="Top Pages">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <TopPagesChart
                data={pages.data as any}
                entryPages={pages.entryPages as any}
                exitPages={pages.exitPages as any}
                isLoading={pages.isLoading ?? false}
              />
            </ChartErrorBoundary>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardContent className="p-5">
            <ChartErrorBoundary label="Top Sources">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <TopSourcesChart data={sources.data as any} isLoading={sources.isLoading ?? false} />
            </ChartErrorBoundary>
          </CardContent>
        </Card>
      </div>

      <ChartErrorBoundary label="Geographic Intelligence">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <GeolocationOverview data={geolocation.data as any} isLoading={geolocation.isLoading ?? false} />
      </ChartErrorBoundary>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="border border-border bg-card">
          <CardContent className="p-5">
            <ChartErrorBoundary label="Top Devices">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <TopDevicesChart
                data={devices.data as any}
                osData={devices.osData as any}
                browserData={devices.browserData as any}
                isLoading={devices.isLoading ?? false}
              />
            </ChartErrorBoundary>
          </CardContent>
        </Card>

        <UtmBreakdownCard
          data={utm.data}
          tab={utm.tab}
          onTabChange={utm.onTabChange}
          isLoading={utm.isLoading}
        />
      </div>

      {footer}
    </div>
  );
}
