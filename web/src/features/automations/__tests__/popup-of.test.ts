import { describe, expect, it } from 'vitest';
import { popupOf } from '@/features/automations/popup-of';
import type { Automation } from '@/features/automations/types';

const auto = (over: Partial<Automation>): Automation => ({
  id: 'a', websiteId: 'w', userId: 'u', name: 'A', description: '', triggerType: 'page_view', triggerConfig: {},
  isActive: true, createdAt: '', updatedAt: '', actions: [], ...over,
});

describe('popupOf', () => {
  it('finds the first modal or banner in the builder graph', () => {
    const a = auto({
      definition: { graph: { nodes: [
        { id: 'n0', kind: 'action', action: { type: 'webhook', url: 'x' } },
        { id: 'n1', kind: 'action', action: { type: 'show_modal', title: 'Spin', layout: 'spin_wheel' } },
      ] } },
    });
    expect(popupOf(a)).toMatchObject({ type: 'show_modal', title: 'Spin', layout: 'spin_wheel' });
  });

  it('falls back to the summary action, and has nothing for automations without a popup', () => {
    expect(popupOf(auto({ actions: [{ actionType: 'modal', actionConfig: { title: 'Wait!' } }] }))).toMatchObject({ type: 'show_modal', title: 'Wait!' });
    expect(popupOf(auto({ actions: [{ actionType: 'banner', actionConfig: { message: 'Sale' } }] }))).toMatchObject({ type: 'show_banner', message: 'Sale' });
    expect(popupOf(auto({ actions: [{ actionType: 'webhook', actionConfig: {} }] }))).toBeNull();
  });
});
