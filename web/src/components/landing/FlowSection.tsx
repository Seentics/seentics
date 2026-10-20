'use client';

import { MockNavContext } from './mocks/MockSidebar';
import { ConversionsPage, RealPage } from './HeroExplorer';
import { FeatureRow } from './FeatureRows';

/**
 * Server-side tracking, right after the hero, laid out as the feature rows are: the area, a
 * two-line title, the body and a link, the real Conversions page in a window, three details.
 */
const noop = () => {};

function ConversionsScreen() {
  return (
    <MockNavContext.Provider value={{ views: ['Conversions'], onSelect: noop }}>
      <RealPage label="Conversions" path="/websites/demo/conversions"><ConversionsPage /></RealPage>
    </MockNavContext.Provider>
  );
}

export default function FlowSection() {
  return (
    <div className="lx-container">
      <FeatureRow row={{ id: 'conversions', href: '/docs/conversions', Mock: ConversionsScreen }} />
    </div>
  );
}
