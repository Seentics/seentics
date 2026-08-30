import { describe, expect, it } from 'vitest';
import { buildCanvasEdges } from '@/components/automations/canvas/AutomationCanvas';
import type { AutomationGraph, GraphNode } from '@/lib/automation-graph';

/**
 * The edges the canvas draws.
 *
 * Extracted from the component because this is where the trigger connection went
 * missing: dragging from a trigger repointed `entry` and drew nothing, so triggers
 * looked unconnectable. Nothing in the jsdom render tests could see that — an SVG path
 * inside a ReactFlow tree is not something to assert on — but a function returning a
 * list is.
 */

const action = (id: string, type = 'show_banner'): GraphNode => ({ id, kind: 'action', action: { type } });
const ifNode = (id: string): GraphNode => ({
  id,
  kind: 'if',
  group: { operator: 'AND', rules: [{ fact: 'page', operator: 'equals', value: '/x' }] },
});
const switchNode = (id: string): GraphNode => ({
  id,
  kind: 'switch',
  cases: [{ id: 'c0', label: 'Pro users', group: { operator: 'AND', rules: [] } }],
});
const edge = (from: string, to: string, branch?: string) => ({ from, to, branch });

const linear = (): AutomationGraph => ({
  entry: 'a',
  nodes: [action('a'), action('b', 'show_toast')],
  edges: [edge('a', 'b')],
});

const branching = (): AutomationGraph => ({
  entry: 'if1',
  nodes: [ifNode('if1'), action('y', 'show_toast'), action('n', 'show_banner')],
  edges: [edge('if1', 'y', 'true'), edge('if1', 'n', 'false')],
});

describe('trigger connections', () => {
  it('draws an edge from the trigger to the entry node', () => {
    // Without this the trigger sits on the canvas attached to nothing, and dragging
    // from it appears to do nothing at all.
    const edges = buildCanvasEdges(linear(), 1);
    const fromTrigger = edges.filter(e => e.source.startsWith('trigger:'));

    expect(fromTrigger).toHaveLength(1);
    expect(fromTrigger[0]!.target).toBe('a');
  });

  it('draws one from every trigger, since any of them starts it', () => {
    const edges = buildCanvasEdges(linear(), 3);
    const fromTriggers = edges.filter(e => e.source.startsWith('trigger:'));

    expect(fromTriggers.map(e => e.source)).toEqual(['trigger:0', 'trigger:1', 'trigger:2']);
    expect(new Set(fromTriggers.map(e => e.target))).toEqual(new Set(['a']));
  });

  it('follows the entry when it moves', () => {
    const edges = buildCanvasEdges({ ...linear(), entry: 'b' }, 1);
    expect(edges.find(e => e.source === 'trigger:0')!.target).toBe('b');
  });

  it('draws none when there is no entry to point at', () => {
    const edges = buildCanvasEdges({ entry: '', nodes: [action('a')], edges: [] }, 2);
    expect(edges.filter(e => e.source.startsWith('trigger:'))).toEqual([]);
  });

  it('draws none when the entry names a node that is gone', () => {
    const edges = buildCanvasEdges({ entry: 'ghost', nodes: [action('a')], edges: [] }, 1);
    expect(edges.filter(e => e.source.startsWith('trigger:'))).toEqual([]);
  });

  it('draws none when there are no triggers yet', () => {
    expect(buildCanvasEdges(linear(), 0).filter(e => e.source.startsWith('trigger:'))).toEqual([]);
  });

  it('makes the entry edge undeletable', () => {
    // The way to change where an automation starts is to drag a trigger onto a
    // different node, not to leave it starting nowhere.
    const entryEdge = buildCanvasEdges(linear(), 1).find(e => e.source === 'trigger:0')!;
    expect(entryEdge.deletable).toBe(false);
  });
});

describe('graph edges', () => {
  it('draws one per stored edge, alongside the trigger edges', () => {
    const edges = buildCanvasEdges(branching(), 1);
    expect(edges).toHaveLength(3);
    expect(edges.filter(e => !e.source.startsWith('trigger:'))).toHaveLength(2);
  });

  it('labels a branch with the outlet name a person recognises', () => {
    const edges = buildCanvasEdges(branching(), 0);
    expect(edges.map(e => e.label)).toEqual(['Yes', 'No']);
  });

  it('names a switch case rather than its opaque id', () => {
    const g: AutomationGraph = {
      entry: 's',
      nodes: [switchNode('s'), action('a'), action('d', 'redirect')],
      edges: [edge('s', 'a', 'c0'), edge('s', 'd', 'default')],
    };
    expect(buildCanvasEdges(g, 0).map(e => e.label)).toEqual(['Pro users', 'Otherwise']);
  });

  it('leaves an unlabelled edge unlabelled', () => {
    expect(buildCanvasEdges(linear(), 0)[0]!.label).toBeUndefined();
  });

  it('carries the branch as the source handle, so it leaves the right outlet', () => {
    const edges = buildCanvasEdges(branching(), 0);
    expect(edges.map(e => e.sourceHandle)).toEqual(['true', 'false']);
  });

  it('uses no source handle for a node with one outlet', () => {
    expect(buildCanvasEdges(linear(), 0)[0]!.sourceHandle).toBeNull();
  });

  it('animates every edge, so flow direction is readable without tracing arrowheads', () => {
    expect(buildCanvasEdges(branching(), 2).every(e => e.animated)).toBe(true);
  });

  it('gives each edge a stable id derived from what it connects', () => {
    // Re-rendering must not reshuffle identities, or ReactFlow re-mounts every edge.
    const a = buildCanvasEdges(branching(), 1).map(e => e.id);
    const b = buildCanvasEdges(branching(), 1).map(e => e.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });

  it('draws two edges between the same pair when they leave different branches', () => {
    const g: AutomationGraph = {
      entry: 'if1',
      nodes: [ifNode('if1'), action('both')],
      edges: [edge('if1', 'both', 'true'), edge('if1', 'both', 'false')],
    };
    const ids = buildCanvasEdges(g, 0).map(e => e.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('returns nothing for an empty graph', () => {
    expect(buildCanvasEdges({ entry: '', nodes: [], edges: [] }, 0)).toEqual([]);
  });
});
