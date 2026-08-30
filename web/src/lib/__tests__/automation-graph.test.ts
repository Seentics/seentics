import { describe, expect, it } from 'vitest';
import {
  MAX_DELAY_SECONDS,
  NODE_HEIGHT,
  applyLayout,
  connectNode,
  connectNodes,
  disconnect,
  edgeFor,
  findCycle,
  indexGraph,
  isBranchNode,
  layoutGraph,
  moveNode,
  outletLabel,
  outletsFor,
  removeNode,
  resolvePositions,
  validateGraph,
  type AutomationGraph,
  type GraphNode,
} from '@/lib/automation-graph';

/**
 * The builder's copy of the graph model.
 *
 * Two things are load-bearing. The validation has to agree with the server's, message
 * for message, or the canvas will happily save something the API rejects. And the layout
 * has to rank by *longest* path, or a node two branches converge on floats up beside the
 * shorter branch and its edges run backwards.
 */

const group = (fact = 'page', value: unknown = '/x') => ({
  operator: 'AND' as const,
  rules: [{ fact, operator: 'equals', value }],
});

const action = (id: string, type = 'show_banner'): GraphNode => ({ id, kind: 'action', action: { type } });
const webhook = (id: string): GraphNode => ({ id, kind: 'action', action: { type: 'webhook', url: 'https://x.test' } });
const delay = (id: string, seconds = 5): GraphNode => ({ id, kind: 'delay', seconds });
const ifNode = (id: string): GraphNode => ({ id, kind: 'if', group: group() });
const waitNode = (id: string, timeoutSeconds = 30): GraphNode => ({ id, kind: 'wait_until', group: group(), timeoutSeconds });
const switchNode = (id: string, cases = 2): GraphNode => ({
  id,
  kind: 'switch',
  cases: Array.from({ length: cases }, (_, i) => ({ id: `c${i}`, label: `Case ${i}`, group: group() })),
});
const edge = (from: string, to: string, branch?: string) => ({ from, to, branch });

/** if/else whose branches converge on a shared tail. */
function diamond(): AutomationGraph {
  return {
    entry: 'if1',
    nodes: [ifNode('if1'), action('yes', 'show_toast'), action('no', 'show_banner'), action('tail', 'redirect')],
    edges: [edge('if1', 'yes', 'true'), edge('if1', 'no', 'false'), edge('yes', 'tail'), edge('no', 'tail')],
  };
}

// -- Outlets -----------------------------------------------------------------

describe('outlets', () => {
  it('gives each branch kind its outlets', () => {
    expect(outletsFor(ifNode('x'))).toEqual(['true', 'false']);
    expect(outletsFor(waitNode('x'))).toEqual(['met', 'timeout']);
    expect(outletsFor(switchNode('x', 3))).toEqual(['c0', 'c1', 'c2', 'default']);
    expect(outletsFor(action('x'))).toBeNull();
  });

  it('identifies which kinds branch', () => {
    expect(isBranchNode(ifNode('x'))).toBe(true);
    expect(isBranchNode(switchNode('x'))).toBe(true);
    expect(isBranchNode(waitNode('x'))).toBe(true);
    expect(isBranchNode(delay('x'))).toBe(false);
  });

  it('labels outlets in the language the canvas shows', () => {
    expect(outletLabel(ifNode('x'), 'true')).toBe('Yes');
    expect(outletLabel(ifNode('x'), 'false')).toBe('No');
    expect(outletLabel(waitNode('x'), 'met')).toBe('When true');
    expect(outletLabel(waitNode('x'), 'timeout')).toBe('On timeout');
  });

  it('labels a switch case by its name, not its opaque id', () => {
    const s = switchNode('x', 2);
    expect(outletLabel(s, 'c0')).toBe('Case 0');
    expect(outletLabel(s, 'default')).toBe('Otherwise');
  });

  it('falls back to the case id when a case has no label', () => {
    const s: GraphNode = { id: 'x', kind: 'switch', cases: [{ id: 'raw', group: group() }] };
    expect(outletLabel(s, 'raw')).toBe('raw');
  });
});

describe('edgeFor', () => {
  it('finds labelled and unlabelled edges without confusing them', () => {
    const { outgoing } = indexGraph(diamond());
    expect(edgeFor(outgoing, 'if1', 'true')?.to).toBe('yes');
    expect(edgeFor(outgoing, 'yes')?.to).toBe('tail');
    expect(edgeFor(outgoing, 'if1')).toBeUndefined();
  });
});

describe('findCycle', () => {
  it('treats convergence as acyclic', () => {
    expect(findCycle(diamond())).toBeNull();
  });

  it('finds a loop and names the nodes on it', () => {
    const g: AutomationGraph = {
      entry: 'a',
      nodes: [action('a'), action('b')],
      edges: [edge('a', 'b'), edge('b', 'a')],
    };
    expect(findCycle(g)).toEqual(['a', 'b', 'a']);
  });
});

// -- Layout ------------------------------------------------------------------

describe('layoutGraph', () => {
  it('places a lone node at the top', () => {
    const { positions } = layoutGraph({ entry: 'a', nodes: [action('a')], edges: [] });
    expect(positions.get('a')!.rank).toBe(0);
    expect(positions.get('a')!.y).toBe(0);
  });

  it('stacks a linear graph downwards, one rank per node', () => {
    const g: AutomationGraph = {
      entry: 'a',
      nodes: [action('a'), action('b'), action('c')],
      edges: [edge('a', 'b'), edge('b', 'c')],
    };
    const { positions } = layoutGraph(g);
    expect([positions.get('a')!.rank, positions.get('b')!.rank, positions.get('c')!.rank]).toEqual([0, 1, 2]);
  });

  it('puts both branches of an if on the same rank', () => {
    const { positions } = layoutGraph(diamond());
    expect(positions.get('yes')!.rank).toBe(positions.get('no')!.rank);
  });

  it('separates the two branches horizontally', () => {
    const { positions } = layoutGraph(diamond());
    expect(positions.get('yes')!.x).not.toBe(positions.get('no')!.x);
  });

  it('places a convergence node below both branches', () => {
    // The reason ranking is longest-path: shortest-path would float the tail up beside
    // the shorter branch and draw its incoming edges backwards.
    const { positions } = layoutGraph(diamond());
    const tail = positions.get('tail')!;
    expect(tail.rank).toBeGreaterThan(positions.get('yes')!.rank);
    expect(tail.rank).toBeGreaterThan(positions.get('no')!.rank);
  });

  it('ranks a convergence node below its longest predecessor, not its shortest', () => {
    // One branch is two nodes long, the other one. The tail must clear both.
    const g: AutomationGraph = {
      entry: 'if1',
      nodes: [ifNode('if1'), action('long1'), action('long2'), action('short'), action('tail')],
      edges: [
        edge('if1', 'long1', 'true'),
        edge('if1', 'short', 'false'),
        edge('long1', 'long2'),
        edge('long2', 'tail'),
        edge('short', 'tail'),
      ],
    };
    const { positions } = layoutGraph(g);
    expect(positions.get('tail')!.rank).toBe(positions.get('long2')!.rank + 1);
  });

  it('lays out every node exactly once', () => {
    const { positions } = layoutGraph(diamond());
    expect(positions.size).toBe(4);
  });

  it('places orphans below everything else rather than hiding them', () => {
    // An unreachable node is a mistake the user has to be able to see and delete.
    const g = diamond();
    g.nodes.push(action('orphan', 'show_toast'));
    const { positions } = layoutGraph(g);
    expect(positions.get('orphan')!.rank).toBeGreaterThan(positions.get('tail')!.rank);
  });

  it('reports a canvas size that contains every node', () => {
    const { positions, width, height } = layoutGraph(diamond());
    for (const p of positions.values()) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y + NODE_HEIGHT).toBeLessThanOrEqual(height);
    }
    expect(width).toBeGreaterThan(0);
  });

  it('is deterministic, so a graph draws the same way every time it is opened', () => {
    const a = layoutGraph(diamond());
    const b = layoutGraph(diamond());
    expect([...a.positions.entries()]).toEqual([...b.positions.entries()]);
  });

  it('still lays out a cyclic graph rather than hanging', () => {
    // Cycles are refused on save, but the canvas has to draw one so it can be fixed.
    const g: AutomationGraph = {
      entry: 'a',
      nodes: [action('a'), action('b')],
      edges: [edge('a', 'b'), edge('b', 'a')],
    };
    expect(() => layoutGraph(g)).not.toThrow();
    expect(layoutGraph(g).positions.size).toBe(2);
  });

  it('returns an empty layout for an empty graph', () => {
    expect(layoutGraph({ entry: '', nodes: [], edges: [] }).positions.size).toBe(0);
  });
});

// -- Validation --------------------------------------------------------------

describe('validateGraph', () => {
  it('accepts a single action', () => {
    expect(validateGraph({ entry: 'a', nodes: [action('a')], edges: [] })).toEqual([]);
  });

  it('accepts a diamond, so branches may converge', () => {
    expect(validateGraph(diamond())).toEqual([]);
  });

  it('rejects an empty graph', () => {
    expect(validateGraph({ entry: 'a', nodes: [], edges: [] })).toEqual(['Add at least one action.']);
  });

  it('rejects a loop and names the nodes on it', () => {
    const g: AutomationGraph = {
      entry: 'a',
      nodes: [action('a'), action('b')],
      edges: [edge('a', 'b'), edge('b', 'a')],
    };
    expect(validateGraph(g).join(' ')).toContain('a → b → a');
  });

  it('rejects an orphan', () => {
    const g = diamond();
    g.nodes.push(action('orphan', 'show_toast'));
    expect(validateGraph(g).join(' ')).toContain('not connected to anything');
  });

  it('reports a branch wired to nothing', () => {
    const g: AutomationGraph = {
      entry: 'if1',
      nodes: [ifNode('if1'), action('a')],
      edges: [edge('if1', 'a', 'true')],
    };
    expect(validateGraph(g).join(' ')).toContain('nothing connected to its "false" branch');
  });

  it('requires a reachable action', () => {
    const g: AutomationGraph = {
      entry: 'if1',
      nodes: [ifNode('if1'), delay('d')],
      edges: [edge('if1', 'd', 'true')],
    };
    expect(validateGraph(g).join(' ')).toContain('at least one action it can reach');
  });

  it('budgets delays per route rather than across the graph', () => {
    const half = MAX_DELAY_SECONDS - 100;
    const g: AutomationGraph = {
      entry: 'if1',
      nodes: [ifNode('if1'), delay('d1', half), delay('d2', half), action('a'), action('b', 'show_toast')],
      edges: [edge('if1', 'd1', 'true'), edge('if1', 'd2', 'false'), edge('d1', 'a'), edge('d2', 'b')],
    };
    expect(validateGraph(g)).toEqual([]);
  });

  it('rejects one route that waits past the budget', () => {
    const g: AutomationGraph = {
      entry: 'd1',
      nodes: [delay('d1', 200), delay('d2', 200), action('a')],
      edges: [edge('d1', 'd2'), edge('d2', 'a')],
    };
    expect(validateGraph(g).join(' ')).toContain('the limit is');
  });

  it('rejects a webhook after a wait, matching the server', () => {
    // Same rule, same wording. The point of duplicating it here is that the user finds
    // out next to the node rather than as a 400.
    const g: AutomationGraph = {
      entry: 'w',
      nodes: [waitNode('w'), webhook('h'), action('b', 'show_toast')],
      edges: [edge('w', 'h', 'met'), edge('w', 'b', 'timeout')],
    };
    expect(validateGraph(g).join(' ')).toContain('cannot come after a wait');
  });

  it('allows a webhook before a wait', () => {
    const g: AutomationGraph = {
      entry: 'h',
      nodes: [webhook('h'), waitNode('w'), action('a'), action('b', 'show_toast')],
      edges: [edge('h', 'w'), edge('w', 'a', 'met'), edge('w', 'b', 'timeout')],
    };
    expect(validateGraph(g)).toEqual([]);
  });

  it('rejects a non-positive delay or timeout', () => {
    const g: AutomationGraph = {
      entry: 'd',
      nodes: [delay('d', 0), action('a')],
      edges: [edge('d', 'a')],
    };
    expect(validateGraph(g).join(' ')).toContain('positive number of seconds');
  });

  it('does not repeat the same message', () => {
    const g: AutomationGraph = {
      entry: 'w',
      nodes: [waitNode('w'), webhook('h'), webhook('h2')],
      edges: [edge('w', 'h', 'met'), edge('w', 'h2', 'timeout')],
    };
    const errors = validateGraph(g);
    expect(new Set(errors).size).toBe(errors.length);
  });
});

// -- Editing -----------------------------------------------------------------

describe('connectNode', () => {
  it('adds a node and wires it to the given outlet', () => {
    const g = connectNode({ entry: 'a', nodes: [action('a')], edges: [] }, action('b', 'show_toast'), 'a');
    expect(g.nodes).toHaveLength(2);
    expect(g.edges).toEqual([{ from: 'a', to: 'b' }]);
  });

  it('labels the edge when a branch is given', () => {
    const g = connectNode({ entry: 'if1', nodes: [ifNode('if1')], edges: [] }, action('a'), 'if1', 'true');
    expect(g.edges).toEqual([{ from: 'if1', to: 'a', branch: 'true' }]);
  });

  it('replaces whatever was already on that outlet', () => {
    // An outlet holds one connection; adding a second silently would make the run
    // ambiguous and fail validation with a confusing message.
    const start: AutomationGraph = {
      entry: 'if1',
      nodes: [ifNode('if1'), action('old')],
      edges: [edge('if1', 'old', 'true')],
    };
    const g = connectNode(start, action('new', 'show_toast'), 'if1', 'true');
    expect(g.edges.filter(e => e.from === 'if1' && e.branch === 'true')).toHaveLength(1);
    expect(g.edges[0]!.to).toBe('new');
  });

  it('adds an unattached node when there is nothing to connect to', () => {
    const g = connectNode({ entry: '', nodes: [], edges: [] }, action('a'), null);
    expect(g.entry).toBe('a');
    expect(g.edges).toEqual([]);
  });
});

describe('removeNode', () => {
  it('removes the node and every edge touching it', () => {
    const g = removeNode(diamond(), 'yes');
    expect(g.nodes.map(n => n.id)).toEqual(['if1', 'no', 'tail']);
    expect(g.edges.some(e => e.from === 'yes' || e.to === 'yes')).toBe(false);
  });

  it('promotes a new entry when the entry itself is deleted', () => {
    // Otherwise the graph becomes headless and nothing draws.
    const g = removeNode(diamond(), 'if1');
    expect(g.entry).not.toBe('if1');
    expect(g.nodes.some(n => n.id === g.entry)).toBe(true);
  });

  it('leaves an empty graph when the last node goes', () => {
    const g = removeNode({ entry: 'a', nodes: [action('a')], edges: [] }, 'a');
    expect(g.nodes).toEqual([]);
    expect(g.entry).toBe('');
  });
});

// -- Positions ---------------------------------------------------------------

describe('node positions', () => {
  it('keeps a position a node already has', () => {
    // Arrangement carries meaning the graph does not — which branch reads as the main
    // path, what sits beside what — so layout must not overrule a deliberate placement.
    const g: AutomationGraph = {
      entry: 'a',
      nodes: [{ ...action('a'), position: { x: 400, y: 250 } }],
      edges: [],
    };
    expect(resolvePositions(g).get('a')).toEqual({ x: 400, y: 250 });
  });

  it('lays out a node that has never been placed', () => {
    const positions = resolvePositions(diamond());
    expect(positions.size).toBe(4);
    for (const p of positions.values()) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it('mixes the two, so a new node lands sensibly in an arranged graph', () => {
    const g = diamond();
    g.nodes[0] = { ...g.nodes[0]!, position: { x: 999, y: 111 } };
    const positions = resolvePositions(g);

    expect(positions.get(g.nodes[0]!.id)).toEqual({ x: 999, y: 111 });
    expect(positions.get('tail')).not.toEqual({ x: 999, y: 111 });
  });

  it('moves one node and leaves the rest alone', () => {
    // What a drag persists. Without it the node snapped back to its laid-out position
    // the moment the graph re-rendered.
    const before = diamond();
    const after = moveNode(before, 'yes', { x: 120, y: 340 });

    expect(after.nodes.find(n => n.id === 'yes')!.position).toEqual({ x: 120, y: 340 });
    expect(after.nodes.find(n => n.id === 'no')!.position).toBeUndefined();
    expect(after.edges).toEqual(before.edges);
  });

  it('ignores a move for a node that is not there', () => {
    const g = diamond();
    expect(moveNode(g, 'ghost', { x: 1, y: 1 }).nodes).toEqual(g.nodes);
  });

  it('writes every position down when tidying up', () => {
    const tidied = applyLayout(diamond());
    expect(tidied.nodes.every(n => n.position !== undefined)).toBe(true);
  });

  it('overrules a hand placement when tidying, which is the point of the button', () => {
    const g = diamond();
    g.nodes[1] = { ...g.nodes[1]!, position: { x: 9999, y: 9999 } };
    expect(applyLayout(g).nodes[1]!.position).not.toEqual({ x: 9999, y: 9999 });
  });
});

describe('connectNodes', () => {
  it('adds an edge between two nodes', () => {
    const g = connectNodes(diamond(), 'tail', 'yes');
    expect(g.edges.some(e => e.from === 'tail' && e.to === 'yes')).toBe(true);
  });

  it('labels the edge with the outlet it left by', () => {
    const g: AutomationGraph = { entry: 'if1', nodes: [ifNode('if1'), action('a')], edges: [] };
    expect(connectNodes(g, 'if1', 'a', 'true').edges).toEqual([{ from: 'if1', to: 'a', branch: 'true' }]);
  });

  it('replaces whatever was on that outlet, since an outlet holds one connection', () => {
    // Two edges on one outlet would make the run ambiguous.
    const g = connectNodes(diamond(), 'if1', 'tail', 'true');
    expect(g.edges.filter(e => e.from === 'if1' && e.branch === 'true')).toHaveLength(1);
    expect(g.edges.find(e => e.from === 'if1' && e.branch === 'true')!.to).toBe('tail');
  });

  it('refuses to connect a node to itself', () => {
    // The drag that produced it was a slip; an error message would be noise.
    const g = diamond();
    expect(connectNodes(g, 'yes', 'yes').edges).toEqual(g.edges);
  });
});

describe('disconnect', () => {
  it('removes exactly the edge addressed', () => {
    const g = disconnect(diamond(), 'if1', 'yes', 'true');
    expect(g.edges.some(e => e.from === 'if1' && e.branch === 'true')).toBe(false);
    expect(g.edges.some(e => e.from === 'if1' && e.branch === 'false')).toBe(true);
  });

  it('leaves the graph alone when the edge is not there', () => {
    const g = diamond();
    expect(disconnect(g, 'if1', 'nowhere', 'true').edges).toEqual(g.edges);
  });

  it('keeps the nodes', () => {
    const g = diamond();
    expect(disconnect(g, 'yes', 'tail').nodes).toEqual(g.nodes);
  });
});

