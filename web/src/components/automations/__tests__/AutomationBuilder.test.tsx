import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import {
  AutomationBuilder,
  FREQUENCY_MODES,
  MAX_DELAY_SECONDS,
  frequencyMode,
  frequencyToCaps,
  validateDefinition,
  type AutomationDefinition,
} from '@/components/automations/AutomationBuilder';
import type { AutomationGraph, GraphNode } from '@/lib/automation-graph';

/**
 * The automation builder.
 *
 * Layout and graph rules are settled in `lib/__tests__/automation-graph.test.ts`; this
 * file covers what the component adds on top — that every node kind can be placed and
 * edited, that a branch's "+" wires the next node to that branch rather than somewhere
 * arbitrary, and that a graph the server would reject cannot be saved.
 */

vi.mock('framer-motion', async () => {
  const React = await import('react');
  return {
    motion: new Proxy({}, {
      get: () => ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
        React.createElement('div', props as never, children),
    }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

const group = () => ({ operator: 'AND' as const, rules: [{ fact: 'page', operator: 'equals', value: '/x' }] });

const action = (id: string, type = 'show_modal'): GraphNode => ({ id, kind: 'action', action: { type } });
const webhook = (id: string): GraphNode => ({ id, kind: 'action', action: { type: 'webhook', url: 'https://x.test' } });
const delay = (id: string, seconds = 5): GraphNode => ({ id, kind: 'delay', seconds });
const ifNode = (id: string): GraphNode => ({ id, kind: 'if', group: group() });
const waitNode = (id: string, timeoutSeconds = 30): GraphNode => ({ id, kind: 'wait_until', group: group(), timeoutSeconds });
const switchNode = (id: string): GraphNode => ({
  id,
  kind: 'switch',
  cases: [{ id: 'c0', label: 'Pro users', group: group() }],
});
const edge = (from: string, to: string, branch?: string) => ({ from, to, branch });

const oneAction = (): AutomationGraph => ({ entry: 'a', nodes: [action('a')], edges: [] });

function definition(over: Partial<AutomationDefinition> = {}): AutomationDefinition {
  return {
    triggers: [{ type: 'exit_intent' }],
    graph: oneAction(),
    frequency: {},
    abTest: { enabled: false, variants: [] },
    priority: 50,
    ...over,
  };
}

function setup(def: AutomationDefinition = definition()) {
  const onSave = vi.fn();
  const utils = render(<AutomationBuilder initialDefinition={def} onSave={onSave} />);
  return { onSave, ...utils };
}

function saved(onSave: ReturnType<typeof vi.fn>): AutomationDefinition {
  return onSave.mock.calls.at(-1)![0] as AutomationDefinition;
}

/** Open the Conditions tab and return it as a query scope. */
function flowTab(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: /^conditions$/i }));
  return screen.getByText(/Branches can rejoin/).closest('div')!;
}

// -- validateDefinition ------------------------------------------------------

describe('validateDefinition', () => {
  it('accepts a trigger plus a one-action graph', () => {
    expect(validateDefinition(definition())).toEqual([]);
  });

  it('requires a trigger', () => {
    expect(validateDefinition(definition({ triggers: [] }))).toContain('Add at least one trigger.');
  });

  it('requires a reachable action', () => {
    const def = definition({
      graph: { entry: 'if1', nodes: [ifNode('if1'), delay('d')], edges: [edge('if1', 'd', 'true')] },
    });
    expect(validateDefinition(def).join(' ')).toContain('at least one action it can reach');
  });

  it('reports a branch wired to nothing', () => {
    const def = definition({
      graph: { entry: 'if1', nodes: [ifNode('if1'), action('a')], edges: [edge('if1', 'a', 'true')] },
    });
    expect(validateDefinition(def).join(' ')).toContain('nothing connected to its "false" branch');
  });

  it('rejects a loop', () => {
    const def = definition({
      graph: {
        entry: 'a',
        nodes: [action('a'), action('b', 'show_toast')],
        edges: [edge('a', 'b'), edge('b', 'a')],
      },
    });
    expect(validateDefinition(def).join(' ')).toContain('form a loop');
  });

  it('rejects a webhook after a wait, matching the server', () => {
    const def = definition({
      graph: {
        entry: 'w',
        nodes: [waitNode('w'), webhook('h'), action('b', 'show_toast')],
        edges: [edge('w', 'h', 'met'), edge('w', 'b', 'timeout')],
      },
    });
    expect(validateDefinition(def).join(' ')).toContain('cannot come after a wait');
  });

  it('accepts a diamond, so branches may converge', () => {
    const def = definition({
      graph: {
        entry: 'if1',
        nodes: [ifNode('if1'), action('y', 'show_toast'), action('n', 'show_banner'), action('t', 'redirect')],
        edges: [edge('if1', 'y', 'true'), edge('if1', 'n', 'false'), edge('y', 't'), edge('n', 't')],
      },
    });
    expect(validateDefinition(def)).toEqual([]);
  });
});

// -- Canvas ------------------------------------------------------------------

describe('canvas', () => {
  it('prompts for a trigger when there is none', () => {
    setup(definition({ triggers: [], graph: { entry: '', nodes: [], edges: [] } }));
    expect(screen.getByText('Start with a trigger')).toBeInTheDocument();
  });

  it('prompts for a node when the graph is empty', () => {
    setup(definition({ graph: { entry: '', nodes: [], edges: [] } }));
    expect(screen.getByText('Add an action, condition or delay')).toBeInTheDocument();
  });

  it('labels each node kind distinctly', () => {
    setup(definition({
      graph: {
        entry: 'if1',
        nodes: [ifNode('if1'), action('a'), delay('d'), waitNode('w'), switchNode('s')],
        edges: [edge('if1', 'a', 'true'), edge('if1', 'd', 'false'), edge('d', 'w'), edge('w', 's', 'met')],
      },
    }));
    expect(screen.getAllByText('If / else').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Delay').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Wait until').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Switch').length).toBeGreaterThan(0);
  });

  it('summarises each kind on its card', () => {
    setup(definition({
      graph: {
        entry: 'd',
        nodes: [delay('d', 5), ifNode('if1'), action('a'), action('b', 'show_toast')],
        edges: [edge('d', 'if1'), edge('if1', 'a', 'true'), edge('if1', 'b', 'false')],
      },
    }));
    expect(screen.getByText('Wait 5 seconds')).toBeInTheDocument();
    expect(screen.getByText('1 rule · AND')).toBeInTheDocument();
  });

  it('draws a labelled edge per branch', () => {
    setup(definition({
      graph: {
        entry: 'if1',
        nodes: [ifNode('if1'), action('a'), action('b', 'show_toast')],
        edges: [edge('if1', 'a', 'true'), edge('if1', 'b', 'false')],
      },
    }));
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('names a switch case on its edge rather than showing the opaque id', () => {
    setup(definition({
      graph: {
        entry: 's',
        nodes: [switchNode('s'), action('a'), action('b', 'show_toast')],
        edges: [edge('s', 'a', 'c0'), edge('s', 'b', 'default')],
      },
    }));
    expect(screen.getByText('Pro users')).toBeInTheDocument();
    expect(screen.getByText('Otherwise')).toBeInTheDocument();
  });

  it('counts triggers and nodes together', () => {
    setup(definition({
      triggers: [{ type: 'exit_intent' }, { type: 'page_view' }],
      graph: { entry: 'if1', nodes: [ifNode('if1'), action('a'), action('b', 'show_toast')], edges: [edge('if1', 'a', 'true'), edge('if1', 'b', 'false')] },
    }));
    expect(screen.getByText('5 nodes')).toBeInTheDocument();
  });
});

// -- Wiring ------------------------------------------------------------------

describe('connecting nodes', () => {
  it('offers a + for each unconnected branch, named after it', () => {
    setup(definition({ graph: { entry: 'if1', nodes: [ifNode('if1'), action('a')], edges: [edge('if1', 'a', 'true')] } }));
    expect(screen.getByRole('button', { name: /Add to the No branch/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add to the Yes branch/i })).not.toBeInTheDocument();
  });

  it('tells the palette which branch it is connecting to', () => {
    // Without it, clicking a palette row after pressing a branch "+" looks like it
    // appended somewhere arbitrary.
    setup(definition({ graph: { entry: 'if1', nodes: [ifNode('if1'), action('a')], edges: [edge('if1', 'a', 'true')] } }));
    fireEvent.click(screen.getByRole('button', { name: /Add to the No branch/i }));
    expect(screen.getByText(/Connecting to the No branch/)).toBeInTheDocument();
  });

  it('wires the next node to the branch its + was pressed on', () => {
    const { onSave } = setup(
      definition({ graph: { entry: 'if1', nodes: [ifNode('if1'), action('a')], edges: [edge('if1', 'a', 'true')] } }),
    );
    fireEvent.click(screen.getByRole('button', { name: /Add to the No branch/i }));
    fireEvent.click(screen.getByRole('button', { name: /^actions$/i }));
    fireEvent.click(screen.getByText('Show Toast'));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const g = saved(onSave).graph;
    const falseEdge = g.edges.find(e => e.from === 'if1' && e.branch === 'false');
    expect(falseEdge).toBeDefined();
    expect(g.nodes.find(n => n.id === falseEdge!.to)).toMatchObject({ kind: 'action' });
  });

  it('appends to the end of a linear graph when no branch was chosen', () => {
    const { onSave } = setup(definition());
    fireEvent.click(screen.getByRole('button', { name: /^actions$/i }));
    fireEvent.click(screen.getByText('Show Toast'));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const g = saved(onSave).graph;
    expect(g.nodes).toHaveLength(2);
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0]!.from).toBe('a');
  });

  it('can cancel a pending connection', () => {
    setup(definition({ graph: { entry: 'if1', nodes: [ifNode('if1'), action('a')], edges: [edge('if1', 'a', 'true')] } }));
    fireEvent.click(screen.getByRole('button', { name: /Add to the No branch/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel connection/i }));
    expect(screen.queryByText(/Connecting to/)).not.toBeInTheDocument();
  });

  it('does not open the editor when a node is added', () => {
    setup(definition());
    fireEvent.click(within(flowTab()).getByText('Delay'));
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });
});

// -- Palette -----------------------------------------------------------------

describe('palette', () => {
  it('offers all four flow-control kinds under the conditions tab', () => {
    setup();
    const tab = flowTab();
    for (const label of ['If / else', 'Switch', 'Wait until', 'Delay']) {
      expect(within(tab).getByText(label)).toBeInTheDocument();
    }
  });

  it('adds an if with both branches ready to wire', () => {
    setup(definition({ graph: { entry: '', nodes: [], edges: [] } }));
    fireEvent.click(within(flowTab()).getByText('If / else'));

    expect(screen.getByRole('button', { name: /Add to the Yes branch/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add to the No branch/i })).toBeInTheDocument();
  });

  it('adds a switch with a case and an otherwise branch', () => {
    setup(definition({ graph: { entry: '', nodes: [], edges: [] } }));
    fireEvent.click(within(flowTab()).getByText('Switch'));

    expect(screen.getByRole('button', { name: /Add to the Otherwise branch/i })).toBeInTheDocument();
  });

  it('adds a wait with met and timeout branches', () => {
    setup(definition({ graph: { entry: '', nodes: [], edges: [] } }));
    fireEvent.click(within(flowTab()).getByText('Wait until'));

    expect(screen.getByRole('button', { name: /Add to the When true branch/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add to the On timeout branch/i })).toBeInTheDocument();
  });
});

// -- Editors -----------------------------------------------------------------

describe('node editors', () => {
  function openFirstNode(def: AutomationDefinition, cardLabel: string) {
    const utils = setup(def);
    fireEvent.click(screen.getAllByText(cardLabel)[0]!);
    return utils;
  }

  it('edits an if condition', () => {
    const { onSave } = openFirstNode(
      definition({ graph: { entry: 'if1', nodes: [ifNode('if1'), action('a'), action('b', 'show_toast')], edges: [edge('if1', 'a', 'true'), edge('if1', 'b', 'false')] } }),
      'If / else',
    );
    fireEvent.change(screen.getByDisplayValue('page'), { target: { value: 'user.plan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const node = saved(onSave).graph.nodes.find(n => n.id === 'if1') as Extract<GraphNode, { kind: 'if' }>;
    expect((node.group.rules[0] as { fact: string }).fact).toBe('user.plan');
  });

  it('explains that both if branches can rejoin', () => {
    openFirstNode(
      definition({ graph: { entry: 'if1', nodes: [ifNode('if1'), action('a'), action('b', 'show_toast')], edges: [edge('if1', 'a', 'true'), edge('if1', 'b', 'false')] } }),
      'If / else',
    );
    expect(screen.getByText(/Both branches can rejoin later/)).toBeInTheDocument();
  });

  it('adds a case to a switch, surfacing a branch to wire', () => {
    // A new case is a new outlet with nothing on it, so the graph is deliberately not
    // saveable until it is connected — that is the validator doing its job.
    openFirstNode(
      definition({ graph: { entry: 's', nodes: [switchNode('s'), action('a'), action('b', 'show_toast')], edges: [edge('s', 'a', 'c0'), edge('s', 'b', 'default')] } }),
      'Switch',
    );
    fireEvent.click(screen.getByRole('button', { name: /add case/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.getByRole('button', { name: /Add to the Case 2 branch/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('removes a switch case and the edge that hung off it', () => {
    // Whatever was on that branch is now orphaned rather than silently deleted — the
    // user may want to rewire it — and the alert says exactly that.
    setup(
      definition({
        graph: {
          entry: 's',
          nodes: [
            { id: 's', kind: 'switch', cases: [{ id: 'c0', label: 'A', group: group() }, { id: 'c1', label: 'B', group: group() }] },
            action('a'),
            action('b', 'show_toast'),
            action('d', 'redirect'),
          ],
          edges: [edge('s', 'a', 'c0'), edge('s', 'b', 'c1'), edge('s', 'd', 'default')],
        },
      }),
    );
    fireEvent.click(screen.getAllByText('Switch')[0]!);
    fireEvent.click(screen.getByRole('button', { name: /remove case 2/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    // The branch label is gone from the canvas, and no error mentions a "c1" branch.
    expect(screen.queryByText('B')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).not.toHaveTextContent('c1');
    expect(screen.getByRole('alert')).toHaveTextContent('not connected to anything');
  });

  it('edits a wait timeout and warns about webhooks', () => {
    const { onSave } = openFirstNode(
      definition({ graph: { entry: 'w', nodes: [waitNode('w'), action('a'), action('b', 'show_toast')], edges: [edge('w', 'a', 'met'), edge('w', 'b', 'timeout')] } }),
      'Wait until',
    );
    expect(screen.getByText(/a webhook cannot come after it/)).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('30'), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const node = saved(onSave).graph.nodes.find(n => n.id === 'w') as Extract<GraphNode, { kind: 'wait_until' }>;
    expect(node.timeoutSeconds).toBe(45);
  });

  it('edits a delay', () => {
    const { onSave } = openFirstNode(
      definition({ graph: { entry: 'd', nodes: [delay('d', 5), action('a')], edges: [edge('d', 'a')] } }),
      'Delay',
    );
    fireEvent.change(screen.getByDisplayValue('5'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const node = saved(onSave).graph.nodes.find(n => n.id === 'd') as Extract<GraphNode, { kind: 'delay' }>;
    expect(node.seconds).toBe(12);
  });

  it('deletes a node and every edge touching it', () => {
    const { onSave } = openFirstNode(
      definition({ graph: { entry: 'd', nodes: [delay('d', 5), action('a')], edges: [edge('d', 'a')] } }),
      'Delay',
    );
    // Scoped to the editor: the card carries its own remove button, named after the kind.
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /delete node/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const g = saved(onSave).graph;
    expect(g.nodes.map(n => n.id)).toEqual(['a']);
    expect(g.edges).toEqual([]);
  });
});

// -- Saving ------------------------------------------------------------------

describe('saving', () => {
  it('emits triggers and a graph, and no legacy fields', () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const def = saved(onSave);
    expect(def.triggers).toEqual([{ type: 'exit_intent' }]);
    expect(def.graph.nodes).toHaveLength(1);
    expect(def).not.toHaveProperty('steps');
    expect(def).not.toHaveProperty('actions');
    expect(def).not.toHaveProperty('conditions');
  });

  it('refuses to save a graph the server would reject', () => {
    const { onSave } = setup(
      definition({ graph: { entry: 'if1', nodes: [ifNode('if1'), action('a')], edges: [edge('if1', 'a', 'true')] } }),
    );
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('disables the save button and says why', () => {
    setup(definition({ graph: { entry: 'if1', nodes: [ifNode('if1'), action('a')], edges: [edge('if1', 'a', 'true')] } }));
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('nothing connected to its "false" branch');
  });

  it('marks the offending node on the canvas, not only in the alert', () => {
    // A message listing forty nodes is not actionable; the ring says which one.
    const { container } = setup(
      definition({ graph: { entry: 'if1', nodes: [ifNode('if1'), action('a')], edges: [edge('if1', 'a', 'true')] } }),
    );
    expect(container.querySelector('[data-node-id="if1"]')!.className).toContain('amber');
  });

  it('enables the save button for a valid graph and shows no alert', () => {
    setup(definition());
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// -- Frequency ---------------------------------------------------------------

describe('frequency', () => {
  it('maps each mode to exactly one cap', () => {
    expect(frequencyToCaps('every_trigger')).toEqual({});
    expect(frequencyToCaps('once_per_session')).toEqual({ maxPerSession: 1 });
    expect(frequencyToCaps('once_every', 3)).toEqual({ cooldownDays: 3 });
  });

  it('clamps the cooldown to a sane range', () => {
    expect(frequencyToCaps('once_every', 0)).toEqual({ cooldownDays: 1 });
    expect(frequencyToCaps('once_every', 9999)).toEqual({ cooldownDays: 365 });
  });

  it('reads the mode back from stored caps', () => {
    expect(frequencyMode({})).toBe('every_trigger');
    expect(frequencyMode({ maxPerSession: 1 })).toBe('once_per_session');
    expect(frequencyMode({ cooldownDays: 7 })).toBe('once_every');
  });

  it('treats a cooldown as the stricter rule when both are set', () => {
    expect(frequencyMode({ maxPerSession: 1, cooldownDays: 7 })).toBe('once_every');
  });

  it('round-trips every mode', () => {
    for (const { value } of FREQUENCY_MODES) {
      expect(frequencyMode(frequencyToCaps(value, 3))).toBe(value);
    }
  });

  it('exposes the delay ceiling the server enforces', () => {
    expect(MAX_DELAY_SECONDS).toBe(300);
  });
});
