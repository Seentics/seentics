import React from 'react';
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
 * The graph itself — layout, validation, connecting, moving — is settled in
 * `lib/__tests__/automation-graph.test.ts`, and the canvas interactions belong to
 * ReactFlow. What is left for this file is what the component adds on top: that every
 * node kind can be placed and edited, that editing reports back a definition the server
 * would accept, and that a graph the server would reject is reported as unsaveable.
 *
 * Save now lives in the page's header rather than over the canvas, so "can this be
 * saved" is asserted through the `onChange` report the header renders from, which is
 * exactly what the page sees.
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

/**
 * Render, capturing what the builder reports out.
 *
 * `latest()` is what the page's header would render Save from, so asserting on it is
 * asserting on the thing that actually reaches the API.
 */
function setup(def: AutomationDefinition = definition()) {
  const reports: Array<{ definition: AutomationDefinition; errors: string[] }> = [];
  const onSave = vi.fn();

  const utils = render(
    <AutomationBuilder
      initialDefinition={def}
      onSave={onSave}
      onChange={(definition, errors) => reports.push({ definition, errors })}
    />,
  );

  const latest = () => reports[reports.length - 1]!;
  return { onSave, latest, reports, ...utils };
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
    // A trigger and a blank canvas looks the same as a broken canvas without this.
    setup(definition({ graph: { entry: '', nodes: [], edges: [] } }));
    expect(screen.getByText('Add an action, condition or delay')).toBeInTheDocument();
  });

  it('tells you how nodes are connected, since it is no longer automatic', () => {
    setup(definition({ graph: { entry: '', nodes: [], edges: [] } }));
    expect(screen.getByText(/drag between the handles on each node/i)).toBeInTheDocument();
  });

  it('renders a card per node', () => {
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

  it('names each outlet beneath its handle, so you know which one you are dragging', () => {
    setup(definition({
      graph: {
        entry: 'if1',
        nodes: [ifNode('if1'), action('a'), action('b', 'show_toast')],
        edges: [edge('if1', 'a', 'true'), edge('if1', 'b', 'false')],
      },
    }));
    expect(screen.getAllByText('Yes').length).toBeGreaterThan(0);
    expect(screen.getAllByText('No').length).toBeGreaterThan(0);
  });

  it('names a switch case rather than showing its opaque id', () => {
    setup(definition({
      graph: {
        entry: 's',
        nodes: [switchNode('s'), action('a'), action('b', 'show_toast')],
        edges: [edge('s', 'a', 'c0'), edge('s', 'b', 'default')],
      },
    }));
    expect(screen.getAllByText('Pro users').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Otherwise').length).toBeGreaterThan(0);
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

  it('adds a node of each flow-control kind', () => {
    const kinds: Array<[string, string]> = [
      ['If / else', 'if'],
      ['Switch', 'switch'],
      ['Wait until', 'wait_until'],
      ['Delay', 'delay'],
    ];

    for (const [label, kind] of kinds) {
      const { latest, unmount } = setup(definition({ graph: { entry: '', nodes: [], edges: [] } }));
      fireEvent.click(within(flowTab()).getByText(label));
      expect(latest().definition.graph.nodes[0]!.kind).toBe(kind);
      unmount();
    }
  });

  it('adds an action of the type chosen', () => {
    const { latest } = setup(definition({ graph: { entry: '', nodes: [], edges: [] } }));
    fireEvent.click(screen.getByRole('button', { name: /^actions$/i }));
    fireEvent.click(screen.getByText('Show Toast'));

    const node = latest().definition.graph.nodes[0]!;
    expect(node.kind).toBe('action');
    expect((node as Extract<GraphNode, { kind: 'action' }>).action.type).toBe('show_toast');
  });

  it('makes the first node the entry, since nothing else could be', () => {
    const { latest } = setup(definition({ graph: { entry: '', nodes: [], edges: [] } }));
    fireEvent.click(screen.getByRole('button', { name: /^actions$/i }));
    fireEvent.click(screen.getByText('Show Toast'));

    const g = latest().definition.graph;
    expect(g.entry).toBe(g.nodes[0]!.id);
  });

  it('adds nodes unconnected, leaving the wiring to a deliberate drag', () => {
    // Guessing an attachment point would produce an edge nobody asked for, which then
    // has to be found and deleted.
    const { latest } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^actions$/i }));
    fireEvent.click(screen.getByText('Show Toast'));

    expect(latest().definition.graph.nodes).toHaveLength(2);
    expect(latest().definition.graph.edges).toEqual([]);
  });

  it('does not open the editor when a node is added', () => {
    // Placing a node and configuring it are separate intents.
    setup();
    fireEvent.click(within(flowTab()).getByText('Delay'));
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  it('adds several nodes in a row without interruption', () => {
    const { latest } = setup(definition({ graph: { entry: '', nodes: [], edges: [] } }));
    fireEvent.click(screen.getByRole('button', { name: /^actions$/i }));

    fireEvent.click(screen.getByText('Show Toast'));
    fireEvent.click(screen.getByText('Show Banner'));
    fireEvent.click(screen.getByText('Redirect'));

    expect(latest().definition.graph.nodes.map(n =>
      (n as Extract<GraphNode, { kind: 'action' }>).action.type,
    )).toEqual(['show_toast', 'show_banner', 'redirect']);
  });
});

// -- Editors -----------------------------------------------------------------

describe('node editors', () => {
  function openNode(def: AutomationDefinition, cardLabel: string) {
    const utils = setup(def);
    fireEvent.click(screen.getAllByText(cardLabel)[0]!);
    return utils;
  }

  const branching = (node: GraphNode, a = 'true', b = 'false'): AutomationDefinition =>
    definition({
      graph: {
        entry: node.id,
        nodes: [node, action('x'), action('y', 'show_toast')],
        edges: [edge(node.id, 'x', a), edge(node.id, 'y', b)],
      },
    });

  it('edits an if condition', () => {
    const { latest } = openNode(branching(ifNode('if1')), 'If / else');
    fireEvent.change(screen.getByDisplayValue('page'), { target: { value: 'user.plan' } });

    const node = latest().definition.graph.nodes.find(n => n.id === 'if1') as Extract<GraphNode, { kind: 'if' }>;
    expect((node.group.rules[0] as { fact: string }).fact).toBe('user.plan');
  });

  it('explains that if branches can rejoin', () => {
    openNode(branching(ifNode('if1')), 'If / else');
    expect(screen.getByText(/Both branches can rejoin later/)).toBeInTheDocument();
  });

  it('states that switch cases are matched in order', () => {
    openNode(branching(switchNode('s'), 'c0', 'default'), 'Switch');
    expect(screen.getByText(/Cases are checked/)).toBeInTheDocument();
  });

  it('adds a case to a switch, surfacing a branch to wire', () => {
    // A new case is a new outlet with nothing on it, so the graph is deliberately not
    // saveable until it is connected.
    const { latest } = openNode(branching(switchNode('s'), 'c0', 'default'), 'Switch');
    fireEvent.click(screen.getByRole('button', { name: /add case/i }));

    const node = latest().definition.graph.nodes.find(n => n.id === 's') as Extract<GraphNode, { kind: 'switch' }>;
    expect(node.cases).toHaveLength(2);
    expect(latest().errors.join(' ')).toContain('nothing connected');
  });

  it('drops the edge that hung off a removed switch case', () => {
    // Otherwise the edge names a branch the node no longer has, and validation complains
    // about a branch the user just deleted.
    const twoCases: GraphNode = {
      id: 's',
      kind: 'switch',
      cases: [{ id: 'c0', label: 'A', group: group() }, { id: 'c1', label: 'B', group: group() }],
    };
    const { latest } = openNode(
      definition({
        graph: {
          entry: 's',
          nodes: [twoCases, action('a'), action('b', 'show_toast'), action('d', 'redirect')],
          edges: [edge('s', 'a', 'c0'), edge('s', 'b', 'c1'), edge('s', 'd', 'default')],
        },
      }),
      'Switch',
    );

    fireEvent.click(screen.getByRole('button', { name: /remove case 2/i }));
    expect(latest().definition.graph.edges.some(e => e.branch === 'c1')).toBe(false);
    expect(latest().errors.join(' ')).not.toContain('"c1"');
  });

  it('edits a wait timeout and warns about webhooks', () => {
    const { latest } = openNode(branching(waitNode('w'), 'met', 'timeout'), 'Wait until');
    expect(screen.getByText(/a webhook cannot come after it/)).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('30'), { target: { value: '45' } });

    const node = latest().definition.graph.nodes.find(n => n.id === 'w') as Extract<GraphNode, { kind: 'wait_until' }>;
    expect(node.timeoutSeconds).toBe(45);
  });

  it('edits a delay', () => {
    const { latest } = openNode(
      definition({ graph: { entry: 'd', nodes: [delay('d', 5), action('a')], edges: [edge('d', 'a')] } }),
      'Delay',
    );
    fireEvent.change(screen.getByDisplayValue('5'), { target: { value: '12' } });

    const node = latest().definition.graph.nodes.find(n => n.id === 'd') as Extract<GraphNode, { kind: 'delay' }>;
    expect(node.seconds).toBe(12);
  });

  it('deletes a node and every edge touching it', () => {
    const { latest } = openNode(
      definition({ graph: { entry: 'd', nodes: [delay('d', 5), action('a')], edges: [edge('d', 'a')] } }),
      'Delay',
    );
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /delete node/i }));

    const g = latest().definition.graph;
    expect(g.nodes.map(n => n.id)).toEqual(['a']);
    expect(g.edges).toEqual([]);
  });
});

// -- What the page header renders Save from ----------------------------------

describe('reporting to the header', () => {
  it('reports the definition and no errors for a valid graph', () => {
    const { latest } = setup();
    expect(latest().errors).toEqual([]);
    expect(latest().definition.triggers).toEqual([{ type: 'exit_intent' }]);
  });

  it('reports the reason a graph cannot be saved', () => {
    const { latest } = setup(
      definition({ graph: { entry: 'if1', nodes: [ifNode('if1'), action('a')], edges: [edge('if1', 'a', 'true')] } }),
    );
    expect(latest().errors.join(' ')).toContain('nothing connected to its "false" branch');
  });

  it('shows the same reason on the canvas', () => {
    setup(definition({ graph: { entry: 'if1', nodes: [ifNode('if1'), action('a')], edges: [edge('if1', 'a', 'true')] } }));
    expect(screen.getByRole('alert')).toHaveTextContent('nothing connected to its "false" branch');
  });

  it('reports again after every edit, so the header never goes stale', () => {
    const { reports } = setup();
    const before = reports.length;

    fireEvent.click(screen.getByRole('button', { name: /^actions$/i }));
    fireEvent.click(screen.getByText('Show Toast'));

    expect(reports.length).toBeGreaterThan(before);
  });

  it('emits triggers and a graph, and no legacy fields', () => {
    const { latest } = setup();
    const def = latest().definition;

    expect(def.graph.nodes).toHaveLength(1);
    expect(def).not.toHaveProperty('steps');
    expect(def).not.toHaveProperty('actions');
    expect(def).not.toHaveProperty('conditions');
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

// -- The loop this nearly shipped with -------------------------------------

describe('reporting to a parent that stores it', () => {
  /**
   * The real page, in miniature.
   *
   * The earlier tests here pushed to an array in `onChange`, which never re-renders —
   * so they passed while the actual page crashed with "Maximum update depth exceeded"
   * on load. What matters is that the parent *sets state* from the report and passes an
   * inline arrow, because that is what every caller does.
   */
  function Host({ def }: { def: AutomationDefinition }) {
    const [draft, setDraft] = React.useState<AutomationDefinition | null>(null);
    const [errors, setErrors] = React.useState<string[]>([]);

    return (
      <>
        <button type="button" disabled={!draft || errors.length > 0}>
          Save
        </button>
        <span data-testid="error-count">{errors.length}</span>
        <AutomationBuilder
          initialDefinition={def}
          onSave={() => {}}
          onChange={(d, e) => { setDraft(d); setErrors(e); }}
        />
      </>
    );
  }

  it('settles instead of looping when the parent stores what it reports', () => {
    // A new inline `onChange` identity per render, feeding state that causes the next
    // render. With the callback in the effect's dependencies this never terminated.
    expect(() => render(<Host def={definition()} />)).not.toThrow();
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
  });

  it('reports errors to the parent, so the header can disable Save', () => {
    const broken = definition({
      graph: { entry: 'if1', nodes: [ifNode('if1'), action('a')], edges: [edge('if1', 'a', 'true')] },
    });
    render(<Host def={broken} />);

    expect(Number(screen.getByTestId('error-count').textContent)).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('keeps reporting after an edit', () => {
    render(<Host def={definition({ graph: { entry: '', nodes: [], edges: [] } })} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /^actions$/i }));
    fireEvent.click(screen.getByText('Show Toast'));

    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
  });
});

