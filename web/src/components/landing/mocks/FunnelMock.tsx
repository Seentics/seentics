'use client';

import { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { demoFunnelAnalytics, demoFunnels } from '@/lib/demo';
import { buildStepRows } from '@/features/funnels/format';
import { FunnelReport } from '@/components/funnels/FunnelReport';
import { MOCK_FRAME, MockSidebar, useMockContentProps } from './MockSidebar';

/**
 * A funnel's page, as the live demo serves it: the page's own report component
 * (components/funnels/FunnelReport) fed the demo funnel, so the shot is the page people
 * get rather than a copy of it. The header is drawn here because the real one reads the
 * router and the signed-in account.
 */
export function FunnelMock() {
  const contentProps = useMockContentProps();
  const { funnel, analytics, rows } = useMemo(() => {
    const f = demoFunnels().funnels[0]!;
    const a = demoFunnelAnalytics(f.id).analytics[0]!;
    return { funnel: f, analytics: a, rows: buildStepRows(f.steps, a.step_metrics, a.total_starts) };
  }, []);

  return (
    <div className="flex h-full w-full bg-sidebar text-foreground">
      <MockSidebar active="Funnels" />

      <main {...contentProps} className={`min-w-0 flex-1 overflow-hidden ${MOCK_FRAME}`}>
        <div className="mx-auto w-full max-w-[1200px] px-6 py-5">
          <span className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            All funnels
          </span>
          <div className="mb-4">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">{funnel.name}</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{funnel.description}</p>
          </div>
          <FunnelReport
            rows={rows}
            totalStarts={analytics.total_starts}
            conversions={analytics.total_conversions}
            conversionRate={analytics.conversion_rate}
            dropOffRate={analytics.drop_off_rate ?? 0}
            avgTimeToConvert={analytics.avg_time_to_convert}
            rangeLabel="Last 31 days"
            fixedLayout
          />
        </div>
      </main>
    </div>
  );
}
