'use client';

import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { AppRouterContext, type AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { PathOverrideProvider } from '@/lib/path-segment';
import { DashboardMock } from './mocks/DashboardMock';
import { MOCK_FRAME, MockNavContext, MockSidebar, useMockContentProps, type MockNavLabel } from './mocks/MockSidebar';
import { LazyAutomationBuilderMock, LazyFunnelMock, LazyHeatmapMock, LazyReplayMock } from './mocks/lazy';
import { ProductWindow } from './ProductWindow';

/** The automation builder has no sidebar of its own; in the explorer it gets one. */
function AutomationsScreen() {
  const contentProps = useMockContentProps();
  return (
    <div className="flex h-full w-full overflow-hidden bg-sidebar text-foreground">
      <MockSidebar active="Automations" />
      <div {...contentProps} className={`min-w-0 flex-1 ${MOCK_FRAME}`}>
        <LazyAutomationBuilderMock />
      </div>
    </div>
  );
}

/**
 * The real pages, as the demo site shows them: rendered beside the mock sidebar, reading
 * `/websites/demo/...` as their path, so they draw their demo data. Loaded on demand.
 */
const loadingPage = () => <div className="h-full w-full bg-background" />;
const ErrorsPage = dynamic(() => import('@/app/websites/[websiteId]/errors/page-client'), { ssr: false, loading: loadingPage });
const RevenuePage = dynamic(() => import('@/app/websites/[websiteId]/revenue/page-client'), { ssr: false, loading: loadingPage });
const AiReportsPage = dynamic(() => import('@/app/websites/[websiteId]/ai-reports/page-client'), { ssr: false, loading: loadingPage });
const DevelopersPage = dynamic(() => import('@/app/websites/[websiteId]/agency/page-client'), { ssr: false, loading: loadingPage });
const SettingsLayout = dynamic(() => import('@/app/websites/[websiteId]/settings/layout'), { ssr: false, loading: loadingPage });
const SettingsPage = dynamic(() => import('@/app/websites/[websiteId]/settings/websites/page-client'), { ssr: false, loading: loadingPage });

/**
 * A router that goes nowhere, for the real pages inside the preview. They navigate on their
 * own (the settings index redirects to its first tab, rows open details), and with the app's
 * router that took the whole landing page with them — to the demo, then to sign-in.
 */
const STAY: AppRouterInstance = {
  back: () => {},
  forward: () => {},
  refresh: () => {},
  push: () => {},
  replace: () => {},
  prefetch: () => {},
};

function RealPage({ label, path, children }: { label: MockNavLabel; path: string; children: ReactNode }) {
  const contentProps = useMockContentProps();
  return (
    <div className="flex h-full w-full overflow-hidden bg-sidebar text-foreground">
      <MockSidebar active={label} />
      <div {...contentProps} className={`min-w-0 flex-1 ${MOCK_FRAME}`}>
        <AppRouterContext.Provider value={STAY}>
          <PathOverrideProvider path={path}>{children}</PathOverrideProvider>
        </AppRouterContext.Provider>
      </div>
    </div>
  );
}

const SCREENS: Record<string, ComponentType> = {
  Overview: DashboardMock,
  Recording: LazyReplayMock,
  Heatmaps: LazyHeatmapMock,
  Funnels: LazyFunnelMock,
  Automations: AutomationsScreen,
  Revenue: () => <RealPage label="Revenue" path="/websites/demo/revenue"><RevenuePage /></RealPage>,
  'AI Reports': () => <RealPage label="AI Reports" path="/websites/demo/ai-reports"><AiReportsPage /></RealPage>,
  Errors: () => <RealPage label="Errors" path="/websites/demo/errors"><ErrorsPage /></RealPage>,
  Developers: () => <RealPage label="Developers" path="/websites/demo/agency"><DevelopersPage /></RealPage>,
  Settings: () => (
    <RealPage label="Settings" path="/websites/demo/settings/websites">
      <SettingsLayout><SettingsPage /></SettingsLayout>
    </RealPage>
  ),
};
const VIEWS = Object.keys(SCREENS) as MockNavLabel[];

/**
 * The hero's dashboard, explorable: the sidebar switches between the real screens, the way
 * linear.app lets a visitor click around its app. Opens on the overview, which is
 * server-rendered (it is the page's largest paint); the others load once the page is idle.
 */
export function HeroExplorer() {
  const [view, setView] = useState<MockNavLabel>('Overview');

  // The other screens mount once the page is idle: they are ready before a click, and
  // their weight stays out of the first paint.
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (idle) idle(() => setWarm(true));
    else setTimeout(() => setWarm(true), 1500);
  }, []);

  return (
    <MockNavContext.Provider value={{ views: VIEWS, onSelect: setView }}>
      <ProductWindow
        // 1280, not the dashboard's 1440: each screen caps its content (the real pages do
        // too), and at 1440 that left an empty band on the right of the window. Here every
        // screen fills it edge to edge.
        designWidth={1280}
        designHeight={900}
        crop={0.8}
        interactiveLabel="Seentics dashboard preview. Use the sidebar to switch screens."
      >
        {/* Every screen stays mounted, stacked, and only the chosen one is shown: switching
            is instant, as in the app. Unmounting on each click re-drew the screen, sidebar
            and all, and replayed its chart animations, which read as a page refresh.
            `invisible` (not `hidden`) keeps the hidden screens laid out at full size, so
            their charts do not collapse and re-measure when shown again. */}
        <div className="relative h-full w-full">
          {VIEWS.map((label) => {
            const Screen = SCREENS[label];
            const shown = label === view;
            if (!shown && !warm) return null;
            return (
              <div
                key={label}
                className={`absolute inset-0 flex ${shown ? '' : 'invisible'}`}
                aria-hidden={shown ? undefined : true}
              >
                <Screen />
              </div>
            );
          })}
        </div>
      </ProductWindow>
    </MockNavContext.Provider>
  );
}
