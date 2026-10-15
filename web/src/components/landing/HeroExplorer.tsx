'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { DashboardMock } from './mocks/DashboardMock';
import { MockNavContext, MockSidebar, useMockContentProps, type MockNavLabel } from './mocks/MockSidebar';
import { LazyAutomationBuilderMock, LazyFunnelMock, LazyHeatmapMock, LazyReplayMock } from './mocks/lazy';
import { ProductWindow } from './ProductWindow';

/** The automation builder has no sidebar of its own; in the explorer it gets one. */
function AutomationsScreen() {
  const contentProps = useMockContentProps();
  return (
    <div className="flex h-full w-full overflow-hidden bg-background text-foreground">
      <MockSidebar active="Automations" />
      <div {...contentProps} className="min-w-0 flex-1">
        <LazyAutomationBuilderMock />
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
};
const VIEWS = Object.keys(SCREENS) as MockNavLabel[];

/**
 * The hero's dashboard, explorable: the sidebar switches between the real screens, the way
 * linear.app lets a visitor click around its app. Opens on the overview, which is
 * server-rendered (it is the page's largest paint); the others load once the page is idle.
 */
export function HeroExplorer() {
  const [view, setView] = useState<MockNavLabel>('Overview');
  const reduce = useReducedMotion();

  useEffect(() => {
    // Warm the other screens so the first click does not wait on a chunk.
    const load = () => {
      void import('./mocks/ReplayMock');
      void import('./mocks/HeatmapMock');
      void import('./mocks/FunnelMock');
      void import('./mocks/AutomationBuilderMock');
    };
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (idle) idle(load);
    else setTimeout(load, 1500);
  }, []);

  const Screen = SCREENS[view];

  return (
    <MockNavContext.Provider value={{ views: VIEWS, onSelect: setView }}>
      <ProductWindow
        designWidth={1440}
        designHeight={1010}
        crop={0.78}
        interactiveLabel="Seentics dashboard preview. Use the sidebar to switch screens."
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            className="flex h-full w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
          >
            <Screen />
          </motion.div>
        </AnimatePresence>
      </ProductWindow>
    </MockNavContext.Provider>
  );
}
