/**
 * The automation graph, as the builder sees it.
 *
 * Mirrors `core/modules/automations/services/automation-graph*.ts`. The duplication is
 * deliberate and narrow: the builder has to refuse a graph *before* saving it, next to
 * the node that is wrong, and a round trip to find that out is a worse experience than
 * two copies of a rule list. The messages are kept identical so the two never disagree
 * about what is wrong, only about when it is said.
 *
 * Layout lives here too, because it is a property of the graph rather than of the
 * canvas: the same graph must draw the same way every time it is opened.
 */

export type NodeId = string;

export type AutomationAction = { type: string; [k: string]: unknown };

export interface ConditionRule {
  fact: string;
  operator: string;
  value?: unknown;
}

export interface ConditionGroup {
  operator: 'AND' | 'OR' | 'NOT';
  rules: Array<ConditionRule | ConditionGroup>;
}

export type SwitchCase = { id: string; label?: string; group: ConditionGroup };

export type GraphNode =
  | { id: NodeId; kind: 'action'; action: AutomationAction }
  | { id: NodeId; kind: 'delay'; seconds: number }
  | { id: NodeId; kind: 'if'; group: ConditionGroup }
  | { id: NodeId; kind: 'switch'; cases: SwitchCase[] }
  | { id: NodeId; kind: 'wait_until'; group: ConditionGroup; timeoutSeconds: number };

export type GraphNodeKind = GraphNode['kind'];

/** `branch` names which outlet of `from` this edge leaves by. Absent for a single outlet. */
export type GraphEdge = { from: NodeId; to: NodeId; branch?: string };

export type AutomationGraph = {
  entry: NodeId;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export const MAX_DELAY_SECONDS = 300;
export const MAX_NODES = 100;
export const MAX_SWITCH_CASES = 10;

/** The branch labels a node may leave by. `null` means one unlabelled outlet. */
export function outletsFor(node: GraphNode): string[] | null {
  switch (node.kind) {
    case 'if':
      return ['true', 'false'];
    case 'wait_until':
      return ['met', 'timeout'];
    case 'switch':
      return [...node.cases.map(c => c.id), 'default'];
    default:
      return null;
  }
}

export function isBranchNode(node: GraphNode): boolean {
  return outletsFor(node) !== null;
}

/** How an outlet is labelled on the canvas. Case ids are opaque, so cases carry a label. */
export function outletLabel(node: GraphNode, outlet: string): string {
  if (node.kind === 'switch') {
    if (outlet === 'default') return 'Otherwise';
    return node.cases.find(c => c.id === outlet)?.label || outlet;
  }
  if (node.kind === 'wait_until') return outlet === 'met' ? 'When true' : 'On timeout';
  return outlet === 'true' ? 'Yes' : 'No';
}

export function indexGraph(graph: AutomationGraph) {
  const byId = new Map<NodeId, GraphNode>();
  for (const node of graph.nodes) byId.set(node.id, node);

  const outgoing = new Map<NodeId, GraphEdge[]>();
  const incoming = new Map<NodeId, GraphEdge[]>();
  for (const e of graph.edges) {
    (outgoing.get(e.from) ?? outgoing.set(e.from, []).get(e.from)!).push(e);
    (incoming.get(e.to) ?? incoming.set(e.to, []).get(e.to)!).push(e);
  }
  return { byId, outgoing, incoming };
}

export function edgeFor(
  outgoing: Map<NodeId, GraphEdge[]>,
  from: NodeId,
  branch?: string,
): GraphEdge | undefined {
  const edges = outgoing.get(from);
  if (!edges) return undefined;
  return branch === undefined
    ? edges.find(e => e.branch === undefined)
    : edges.find(e => e.branch === branch);
}

// ─── Structure ────────────────────────────────────────────────────────────────

export function reachableFrom(graph: AutomationGraph, entry: NodeId): Set<NodeId> {
  const { outgoing } = indexGraph(graph);
  const seen = new Set<NodeId>();
  const stack = [entry];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const e of outgoing.get(id) ?? []) stack.push(e.to);
  }
  return seen;
}

/** The first cycle found, as the node ids on it, so the canvas can highlight them. */
export function findCycle(graph: AutomationGraph): NodeId[] | null {
  const { outgoing } = indexGraph(graph);
  const state = new Map<NodeId, 'visiting' | 'done'>();
  const path: NodeId[] = [];

  function visit(id: NodeId): NodeId[] | null {
    const seen = state.get(id);
    if (seen === 'done') return null;
    if (seen === 'visiting') return [...path.slice(path.indexOf(id)), id];

    state.set(id, 'visiting');
    path.push(id);
    for (const e of outgoing.get(id) ?? []) {
      const cycle = visit(e.to);
      if (cycle) return cycle;
    }
    path.pop();
    state.set(id, 'done');
    return null;
  }

  for (const node of graph.nodes) {
    const cycle = visit(node.id);
    if (cycle) return cycle;
  }
  return null;
}

/** Every route from `entry` to a leaf. Only safe on an acyclic graph. */
export function pathsFrom(graph: AutomationGraph, entry: NodeId): NodeId[][] {
  const { outgoing } = indexGraph(graph);
  const paths: NodeId[][] = [];

  function walk(id: NodeId, sofar: NodeId[]): void {
    const next = outgoing.get(id) ?? [];
    if (next.length === 0) {
      paths.push([...sofar, id]);
      return;
    }
    for (const e of next) walk(e.to, [...sofar, id]);
  }

  walk(entry, []);
  return paths;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export const NODE_WIDTH = 264;
export const NODE_HEIGHT = 92;
export const COLUMN_GAP = 40;
export const ROW_GAP = 88;

export type NodeLayout = { id: NodeId; x: number; y: number; rank: number };
export type GraphLayout = {
  positions: Map<NodeId, NodeLayout>;
  width: number;
  height: number;
};

/**
 * Where each node sits on the canvas.
 *
 * Rank is the *longest* path from the entry, not the shortest. That is the whole trick
 * for a DAG: a node two branches converge on must be drawn below both of them, and
 * shortest-path ranking would float it up beside the shorter branch with its edges
 * running backwards.
 *
 * Within a rank, nodes are ordered by a depth-first walk from the entry, which keeps a
 * branch's descendants adjacent instead of interleaving them with the other branch's.
 */
export function layoutGraph(graph: AutomationGraph): GraphLayout {
  const positions = new Map<NodeId, NodeLayout>();
  if (!graph.nodes.length) return { positions, width: 0, height: 0 };

  const { byId, outgoing, incoming } = indexGraph(graph);
  const reachable = reachableFrom(graph, graph.entry);

  // Longest-path rank, computed with memoised recursion over predecessors. A cycle
  // would not terminate, so the visiting set makes a malformed graph still draw.
  const rank = new Map<NodeId, number>();
  const visiting = new Set<NodeId>();

  function rankOf(id: NodeId): number {
    const cached = rank.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;

    visiting.add(id);
    const parents = (incoming.get(id) ?? []).filter(e => reachable.has(e.from));
    const value = parents.length === 0 ? 0 : Math.max(...parents.map(e => rankOf(e.from) + 1));
    visiting.delete(id);

    rank.set(id, value);
    return value;
  }

  // Orphans are laid out below everything else rather than hidden — an unreachable node
  // is a mistake the user has to be able to see and delete.
  const orphans = graph.nodes.filter(n => !reachable.has(n.id));
  for (const node of graph.nodes) rankOf(node.id);

  // Depth-first order from the entry gives a stable, branch-adjacent ordering.
  const order: NodeId[] = [];
  const seen = new Set<NodeId>();
  (function walk(id: NodeId) {
    if (seen.has(id)) return;
    seen.add(id);
    order.push(id);
    for (const e of outgoing.get(id) ?? []) walk(e.to);
  })(graph.entry);

  const byRank = new Map<number, NodeId[]>();
  for (const id of order) {
    if (!byId.has(id)) continue;
    const r = rank.get(id) ?? 0;
    (byRank.get(r) ?? byRank.set(r, []).get(r)!).push(id);
  }

  const maxRank = byRank.size ? Math.max(...byRank.keys()) : 0;
  if (orphans.length) byRank.set(maxRank + 1, orphans.map(n => n.id));

  const widest = Math.max(1, ...[...byRank.values()].map(ids => ids.length));
  const step = NODE_WIDTH + COLUMN_GAP;
  const width = widest * step;

  for (const [r, ids] of byRank) {
    // Centre each rank against the widest one, so the graph reads as a tree rather than
    // drifting left as branches close.
    const rowWidth = ids.length * step;
    const offset = (width - rowWidth) / 2;
    ids.forEach((id, i) => {
      positions.set(id, {
        id,
        x: offset + i * step,
        y: r * (NODE_HEIGHT + ROW_GAP),
        rank: r,
      });
    });
  }

  const maxY = Math.max(0, ...[...positions.values()].map(p => p.y));
  return { positions, width, height: maxY + NODE_HEIGHT };
}

// ─── Validation ───────────────────────────────────────────────────────────────

function label(node: GraphNode | undefined, id: NodeId): string {
  if (!node) return `"${id}"`;
  if (node.kind === 'action') return `the ${node.action.type} action`;
  if (node.kind === 'if') return 'the if/else';
  if (node.kind === 'switch') return 'the switch';
  if (node.kind === 'delay') return 'the delay';
  return 'the wait';
}

/**
 * Everything wrong with a graph, as messages the canvas can show at once.
 *
 * Mirrors the server's `validateGraph`, message for message. See the note at the top of
 * this file on why the rules are duplicated rather than fetched.
 */
export function validateGraph(graph: AutomationGraph): string[] {
  const errors: string[] = [];

  if (!Array.isArray(graph?.nodes) || !Array.isArray(graph?.edges)) {
    return ['The automation graph is malformed.'];
  }
  if (graph.nodes.length === 0) return ['Add at least one action.'];
  if (graph.nodes.length > MAX_NODES) errors.push(`An automation cannot exceed ${MAX_NODES} nodes.`);

  const seenIds = new Set<NodeId>();
  for (const node of graph.nodes) {
    if (seenIds.has(node.id)) errors.push(`Two nodes share the id "${node.id}".`);
    seenIds.add(node.id);
  }

  const { byId, outgoing } = indexGraph(graph);
  if (!byId.has(graph.entry)) {
    errors.push('The automation has no starting node.');
    return errors;
  }

  let dangling = false;
  for (const e of graph.edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) dangling = true;
  }
  if (dangling) {
    errors.push('A connection points at a node that does not exist.');
    return errors;
  }

  for (const node of graph.nodes) {
    const outlets = outletsFor(node);
    const edges = outgoing.get(node.id) ?? [];

    if (outlets === null) {
      if (edges.length > 1) errors.push(`${label(node, node.id)} has more than one outgoing connection.`);
      continue;
    }

    const used = new Set<string>();
    for (const e of edges) {
      if (e.branch === undefined) {
        errors.push(`${label(node, node.id)} has an unlabelled connection; every branch must be named.`);
        continue;
      }
      if (!outlets.includes(e.branch)) errors.push(`${label(node, node.id)} has no "${e.branch}" branch.`);
      if (used.has(e.branch)) {
        errors.push(`${label(node, node.id)} has two connections on its "${e.branch}" branch.`);
      }
      used.add(e.branch);
    }
  }

  for (const node of graph.nodes) {
    if (node.kind === 'switch') {
      if (node.cases.length === 0) errors.push('A switch needs at least one case.');
      if (node.cases.length > MAX_SWITCH_CASES) {
        errors.push(`A switch cannot have more than ${MAX_SWITCH_CASES} cases.`);
      }
    }
    if (node.kind === 'wait_until') {
      if (!Number.isFinite(node.timeoutSeconds) || node.timeoutSeconds <= 0) {
        errors.push('A wait needs a positive timeout.');
      } else if (node.timeoutSeconds > MAX_DELAY_SECONDS) {
        errors.push(`A wait cannot exceed ${MAX_DELAY_SECONDS} seconds.`);
      }
    }
    if (node.kind === 'delay') {
      if (!Number.isFinite(node.seconds) || node.seconds <= 0) {
        errors.push('A delay must be a positive number of seconds.');
      } else if (node.seconds > MAX_DELAY_SECONDS) {
        errors.push(`A delay cannot exceed ${MAX_DELAY_SECONDS} seconds.`);
      }
    }
  }

  const cycle = findCycle(graph);
  if (cycle) {
    errors.push(`The connections form a loop (${cycle.join(' → ')}). Automations must flow forwards.`);
    return [...new Set(errors)];
  }

  const reachable = reachableFrom(graph, graph.entry);
  for (const node of graph.nodes) {
    if (!reachable.has(node.id)) {
      errors.push(`${label(node, node.id)} is not connected to anything and will never run.`);
    }
  }
  if (!graph.nodes.some(n => n.kind === 'action' && reachable.has(n.id))) {
    errors.push('An automation needs at least one action it can reach.');
  }

  for (const path of pathsFrom(graph, graph.entry)) {
    let budget = 0;
    let waited = false;
    for (const id of path) {
      const node = byId.get(id);
      if (!node) continue;
      if (node.kind === 'delay') budget += node.seconds;
      if (node.kind === 'wait_until') {
        budget += node.timeoutSeconds;
        waited = true;
      }
      if (waited && node.kind === 'action' && node.action.type === 'webhook') {
        errors.push(
          'A webhook cannot come after a wait — the server has already responded by then. Move it before the wait.',
        );
      }
    }
    if (budget > MAX_DELAY_SECONDS) {
      errors.push(`One route waits ${budget}s in total; the limit is ${MAX_DELAY_SECONDS}s.`);
    }
  }

  for (const node of graph.nodes) {
    const outlets = outletsFor(node);
    if (!outlets || !reachable.has(node.id)) continue;
    for (const outlet of outlets) {
      if (!edgeFor(outgoing, node.id, outlet)) {
        errors.push(`${label(node, node.id)} has nothing connected to its "${outlet}" branch.`);
      }
    }
  }

  return [...new Set(errors)];
}

// ─── Editing ──────────────────────────────────────────────────────────────────

let idCounter = 0;

/** A short unique id. Sequential rather than random so a saved graph diffs readably. */
export function newNodeId(kind: GraphNodeKind): NodeId {
  idCounter += 1;
  return `${kind}_${idCounter}_${Date.now().toString(36).slice(-4)}`;
}

/** Remove a node and every edge touching it, keeping the graph connected-ish. */
export function removeNode(graph: AutomationGraph, id: NodeId): AutomationGraph {
  const nodes = graph.nodes.filter(n => n.id !== id);
  const edges = graph.edges.filter(e => e.from !== id && e.to !== id);
  // Deleting the entry promotes whatever is left, so the graph never becomes headless.
  const entry = graph.entry === id ? (nodes[0]?.id ?? '') : graph.entry;
  return { entry, nodes, edges };
}

/** Attach `node` to `from`'s `branch` outlet, replacing anything already on it. */
export function connectNode(
  graph: AutomationGraph,
  node: GraphNode,
  from: NodeId | null,
  branch?: string,
): AutomationGraph {
  const nodes = [...graph.nodes, node];
  if (!from) return { entry: graph.entry || node.id, nodes, edges: graph.edges };

  const edges = graph.edges.filter(e => !(e.from === from && e.branch === branch));
  edges.push({ from, to: node.id, ...(branch !== undefined ? { branch } : {}) });
  return { entry: graph.entry || node.id, nodes, edges };
}
