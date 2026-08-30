import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The automations data layer.
 *
 * Its job is the boundary between the definition document the builder edits and the
 * flattened rows the list and detail views render. The definition has to travel through
 * untouched - it is executable, and a field dropped here is configuration silently lost
 * on the next save - while the flattened projection is derived from the step chain
 * rather than stored beside it.
 */

const { get, post, put, del } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ default: { get, post, put, delete: del } }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));

import {
  createAutomation,
  fetchAutomation,
  fetchAutomations,
  updateAutomation,
} from '@/lib/automations-api';

const SITE = 'ab12cd34';

/** A stored row as the API returns it. */
function row(over: Record<string, unknown> = {}) {
  return {
    id: 'auto_1',
    website_id: SITE,
    user_id: 'user_1',
    name: 'Exit banner',
    is_active: true,
    created_at: '2026-03-01T10:00:00.000Z',
    updated_at: '2026-03-01T10:00:00.000Z',
    definition: {
      triggers: [{ type: 'exit_intent' }],
      steps: [{ kind: 'action', action: { type: 'show_banner', text: '10% off' } }],
    },
    ...over,
  };
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  put.mockReset();
  del.mockReset();
});

// -- Reading -----------------------------------------------------------------

describe('fetchAutomations', () => {
  it('unwraps the `data` envelope', async () => {
    get.mockResolvedValue({ data: { data: [row()] } });
    const out = await fetchAutomations(SITE);
    expect(out.automations).toHaveLength(1);
    expect(out.automations[0]!.name).toBe('Exit banner');
  });

  it('accepts a bare array as well as an envelope', async () => {
    get.mockResolvedValue({ data: [row()] });
    expect((await fetchAutomations(SITE)).automations).toHaveLength(1);
  });

  it('returns an empty list for an unexpected payload rather than throwing', async () => {
    get.mockResolvedValue({ data: { nope: true } });
    expect((await fetchAutomations(SITE)).automations).toEqual([]);
  });

  it('serves demo data without touching the network', async () => {
    await fetchAutomations('demo');
    expect(get).not.toHaveBeenCalled();
  });
});

describe('normalisation', () => {
  it('carries the definition through untouched', async () => {
    // The builder edits this document; anything reshaped here is configuration lost on
    // the next save.
    const definition = {
      triggers: [{ type: 'exit_intent' }, { type: 'page_view', path: '/pricing' }],
      steps: [
        { kind: 'condition', group: { operator: 'AND', rules: [{ fact: 'a', operator: 'isSet' }] } },
        { kind: 'action', action: { type: 'show_banner', text: 'Hi' } },
        { kind: 'delay', seconds: 5 },
        { kind: 'action', action: { type: 'show_toast', message: 'Bye' } },
      ],
      frequency: { maxPerSession: 1 },
      abTest: { enabled: true, variants: [{ id: 'a', weight: 1 }] },
      priority: 20,
    };
    get.mockResolvedValue({ data: { data: row({ definition }) } });

    expect((await fetchAutomation(SITE, 'auto_1'))!.definition).toEqual(definition);
  });

  it('takes the row badge from the first trigger', async () => {
    get.mockResolvedValue({
      data: { data: row({ definition: { triggers: [{ type: 'click' }, { type: 'page_view' }], steps: [] } }) },
    });
    expect((await fetchAutomation(SITE, 'auto_1'))!.triggerType).toBe('click');
  });

  it('leaves the badge blank for a definition with no trigger', async () => {
    // Mid-edit, not broken - the row still has to render.
    get.mockResolvedValue({ data: { data: row({ definition: { triggers: [], steps: [] } }) } });
    expect((await fetchAutomation(SITE, 'auto_1'))!.triggerType).toBe('');
  });

  it('projects action steps into the flattened action list, in order', async () => {
    get.mockResolvedValue({
      data: {
        data: row({
          definition: {
            triggers: [{ type: 'exit_intent' }],
            steps: [
              { kind: 'action', action: { type: 'show_banner', text: 'first' } },
              { kind: 'delay', seconds: 3 },
              { kind: 'action', action: { type: 'show_toast', message: 'second' } },
            ],
          },
        }),
      },
    });
    const out = await fetchAutomation(SITE, 'auto_1');

    expect(out!.actions.map(a => a.actionType)).toEqual(['show_banner', 'show_toast']);
    expect(out!.actions[0]!.actionConfig).toEqual({ text: 'first' });
    expect(out!.actions.map(a => a.orderIndex)).toEqual([0, 1]);
  });

  it('excludes conditions and delays from the action list', async () => {
    get.mockResolvedValue({
      data: {
        data: row({
          definition: {
            triggers: [{ type: 'exit_intent' }],
            steps: [
              { kind: 'condition', group: { operator: 'OR', rules: [] } },
              { kind: 'delay', seconds: 3 },
            ],
          },
        }),
      },
    });
    expect((await fetchAutomation(SITE, 'auto_1'))!.actions).toEqual([]);
  });

  it('projects condition steps separately, keeping their group', async () => {
    const group = { operator: 'OR', rules: [{ fact: 'a', operator: 'isSet' }] };
    get.mockResolvedValue({
      data: {
        data: row({
          definition: { triggers: [{ type: 'exit_intent' }], steps: [{ kind: 'condition', group }] },
        }),
      },
    });
    const out = await fetchAutomation(SITE, 'auto_1');

    expect(out!.conditions).toHaveLength(1);
    expect(out!.conditions![0]!.conditionType).toBe('OR');
    expect(out!.conditions![0]!.conditionConfig).toEqual(group);
  });

  it('strips only `type` from an action, leaving the rest as its config', async () => {
    get.mockResolvedValue({
      data: {
        data: row({
          definition: {
            triggers: [{ type: 'exit_intent' }],
            steps: [{ kind: 'action', action: { type: 'show_modal', title: 'T', body: 'B' } }],
          },
        }),
      },
    });
    const action = (await fetchAutomation(SITE, 'auto_1'))!.actions[0]!;
    expect(action.actionType).toBe('show_modal');
    expect(action.actionConfig).toEqual({ title: 'T', body: 'B' });
  });

  it('reads both snake_case and camelCase row fields', async () => {
    get.mockResolvedValue({
      data: { data: { id: 'a1', websiteId: SITE, userId: 'u1', isActive: true, definition: { triggers: [], steps: [] } } },
    });
    const out = await fetchAutomation(SITE, 'a1');
    expect(out!.websiteId).toBe(SITE);
    expect(out!.isActive).toBe(true);
  });

  it('survives a row with no definition at all', async () => {
    get.mockResolvedValue({ data: { data: { id: 'a1' } } });
    const out = await fetchAutomation(SITE, 'a1');
    expect(out!.actions).toEqual([]);
    expect(out!.triggerType).toBe('');
  });

  it('returns null when the request fails', async () => {
    get.mockRejectedValue(new Error('404'));
    expect(await fetchAutomation(SITE, 'missing')).toBeNull();
  });

  it('maps stats when present and leaves them undefined otherwise', async () => {
    get.mockResolvedValue({
      data: { data: row({ stats: { totalExecutions: 10, successCount: 9, failureCount: 1, successRate: 90, last30Days: 4 } }) },
    });
    expect((await fetchAutomation(SITE, 'auto_1'))!.stats).toEqual({
      totalExecutions: 10, successCount: 9, failureCount: 1, successRate: 90, last30Days: 4,
    });

    get.mockResolvedValue({ data: { data: row() } });
    expect((await fetchAutomation(SITE, 'auto_1'))!.stats).toBeUndefined();
  });
});

// -- Writing -----------------------------------------------------------------

describe('createAutomation', () => {
  it('posts the definition verbatim', async () => {
    const definition = {
      triggers: [{ type: 'exit_intent' }],
      steps: [{ kind: 'action', action: { type: 'show_banner' } }],
    };
    post.mockResolvedValue({ data: { data: row() } });

    await createAutomation(SITE, { name: 'New', definition });

    expect(post).toHaveBeenCalledWith(`/automations/${SITE}`, {
      name: 'New',
      description: '',
      definition,
      is_active: true,
    });
  });

  it('does not reshape a chain on the way out', async () => {
    // The server validates the chain; anything reordered or flattened here would be
    // rejected as a different automation than the one on screen.
    const definition = {
      triggers: [{ type: 'page_view' }],
      steps: [
        { kind: 'condition', group: { operator: 'AND', rules: [] } },
        { kind: 'action', action: { type: 'show_toast' } },
        { kind: 'delay', seconds: 5 },
        { kind: 'action', action: { type: 'redirect', url: 'https://x.test' } },
      ],
    };
    post.mockResolvedValue({ data: { data: row() } });

    await createAutomation(SITE, { name: 'Chain', definition });
    expect((post.mock.calls[0]![1] as { definition: unknown }).definition).toEqual(definition);
  });

  it('skips the request entirely in demo mode', async () => {
    await createAutomation('demo', { name: 'x', definition: { triggers: [], steps: [] } });
    expect(post).not.toHaveBeenCalled();
  });
});

describe('updateAutomation', () => {
  it('sends only the fields supplied', async () => {
    put.mockResolvedValue({ data: { data: row() } });
    await updateAutomation(SITE, 'auto_1', { name: 'Renamed' });

    expect(put).toHaveBeenCalledWith(`/automations/${SITE}/auto_1`, { name: 'Renamed' });
  });

  it('sends the definition when it is the thing that changed', async () => {
    const definition = { triggers: [{ type: 'click' }], steps: [{ kind: 'action', action: { type: 'show_toast' } }] };
    put.mockResolvedValue({ data: { data: row() } });

    await updateAutomation(SITE, 'auto_1', { definition });
    expect(put).toHaveBeenCalledWith(`/automations/${SITE}/auto_1`, { definition });
  });

  it('sends an empty body when nothing was supplied', async () => {
    put.mockResolvedValue({ data: { data: row() } });
    await updateAutomation(SITE, 'auto_1', {});
    expect(put).toHaveBeenCalledWith(`/automations/${SITE}/auto_1`, {});
  });

  it('skips the request entirely in demo mode', async () => {
    await updateAutomation('demo', 'auto_1', { name: 'x' });
    expect(put).not.toHaveBeenCalled();
  });
});
