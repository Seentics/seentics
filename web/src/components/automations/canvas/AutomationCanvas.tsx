'use client';

import React, { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  useEdgesState,
  useNodesState,
  useReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeDragHandler,
  type NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';

import {
  connectNodes,
  disconnect,
  moveNode,
  outletLabel,
  outletsFor,
  resolvePositions,
  type AutomationGraph,
  type GraphNode,
  type NodeId,
} from '@/lib/automation-graph';
import { nodeTypes, type NodeVisual } from './AutomationNodes';

/**
 * The graph canvas.
 *
 * Built on ReactFlow rather than hand-rolled, because what makes this feel like a graph
 * editor rather than a list builder is a pile of interaction detail — a live edge that
 * follows the cursor mid-drag, handles that highlight when they can accept it, nodes you
 * can place where you like, edges you can select and delete — and every one of those is
 * a thing ReactFlow already does well.
 *
 * Positions live in the definition, so an arrangement survives a reload. Edges animate
 * in the direction of flow, which is the cheapest way to make a branch readable: you can
 * see which way the automation runs without tracing arrowheads.
 */

/**
 * Every edge the canvas draws, for a graph and a number of triggers.
 *
 * Pure and exported because this is where the trigger connection went missing: the
 * canvas repointed `entry` on a drag from a trigger but drew nothing, so triggers looked
 * unconnectable. A function returning a list is something a test can check; an inline
 * `useMemo` inside a ReactFlow tree is not.
 */
export function buildCanvasEdges(graph: AutomationGraph, triggerCount: number): Edge[] {
  const byId = new Map(graph.nodes.map(n => [n.id, n]));

  // Triggers connect to the graph's entry, and that connection has to be visible: it is
  // the one edge whose meaning is immediate — "this is where the automation starts".
  // Synthesised rather than stored, because `entry` is a single node and every trigger
  // leads to it; storing one edge per trigger would be the same fact written several
  // times, and the copies could then disagree.
  const entryEdges: Edge[] =
    graph.entry && byId.has(graph.entry)
      ? Array.from({ length: triggerCount }, (_unused, i) => ({
          id: `trigger:${i}->${graph.entry}`,
          source: `trigger:${i}`,
          target: graph.entry,
          animated: true,
          // Not deletable: the way to change where an automation starts is to drag a
          // trigger onto a different node, not to leave it starting nowhere.
          deletable: false,
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
          style: { strokeWidth: 2, stroke: 'hsl(var(--muted-foreground))' },
        }))
      : [];

  const graphEdges: Edge[] = graph.edges.map(e => {
    const from = byId.get(e.from);
    return {
      id: `${e.from}:${e.branch ?? ''}:${e.to}`,
      source: e.from,
      target: e.to,
      sourceHandle: e.branch ?? null,
      // Animated in the direction of flow — the cheapest way to read a branching graph
      // without tracing arrowheads.
      animated: true,
      label: from && e.branch ? outletLabel(from, e.branch) : undefined,
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 8,
      labelBgStyle: { fill: 'hsl(var(--background))', stroke: 'hsl(var(--border))' },
      labelStyle: { fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 600 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      style: { strokeWidth: 2 },
    };
  });

  return entryEdges.concat(graphEdges);
}

export type AutomationCanvasProps = {
  graph: AutomationGraph;
  onGraphChange: (graph: AutomationGraph) => void;

  triggers: Array<{ type: string }>;
  triggerMeta: (type: string) => { label: string; description: string; icon: React.ElementType };
  onDeleteTrigger: (index: number) => void;
  onSelectTrigger: (index: number) => void;

  nodeVisual: (node: GraphNode) => NodeVisual;
  nodeSummary: (node: GraphNode) => string;
  invalidNodes: Set<NodeId>;
  onSelectNode: (id: NodeId) => void;
  onDeleteNode: (id: NodeId) => void;

  /**
   * A node dragged in from the palette, with the canvas position it was dropped at.
   *
   * The position matters: a node that always lands in the same place turns dragging
   * into a slower click, and on a graph of any size it lands on top of something.
   */
  onPaletteDrop: (payload: { kind: string; type: string }, position: { x: number; y: number }) => void;
  paletteMime: string;
};

/** Where the trigger stack sits, so the graph starts clear of it. */
const TRIGGER_X = 40;
const TRIGGER_Y = 0;
const TRIGGER_STEP = 120;
const GRAPH_OFFSET_Y = 60;

function AutomationCanvasInner({
  graph,
  onGraphChange,
  triggers,
  triggerMeta,
  onDeleteTrigger,
  onSelectTrigger,
  nodeVisual,
  nodeSummary,
  invalidNodes,
  onSelectNode,
  onDeleteNode,
  onPaletteDrop,
  paletteMime,
}: AutomationCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();
  const positions = useMemo(() => resolvePositions(graph), [graph]);

  const builtNodes: Node[] = useMemo(() => {
    const triggerNodes: Node[] = triggers.map((t, i) => {
      const meta = triggerMeta(t.type);
      return {
        id: `trigger:${i}`,
        type: 'trigger',
        position: { x: TRIGGER_X, y: TRIGGER_Y + i * TRIGGER_STEP },
        data: {
          label: meta.label,
          description: meta.description,
          icon: meta.icon,
          index: i,
          canDelete: triggers.length > 1,
          onDelete: onDeleteTrigger,
        },
        // Triggers are a stack above the graph, not part of it; dragging one would
        // suggest it participates in the layout when it does not.
        draggable: false,
      };
    });

    const graphNodes: Node[] = graph.nodes.map(n => {
      const p = positions.get(n.id) ?? { x: 0, y: 0 };
      return {
        id: n.id,
        type: 'automation',
        position: { x: p.x, y: p.y + GRAPH_OFFSET_Y },
        data: {
          node: n,
          visual: nodeVisual(n),
          summary: nodeSummary(n),
          invalid: invalidNodes.has(n.id),
          onDelete: onDeleteNode,
        },
      };
    });

    return [...triggerNodes, ...graphNodes];
  }, [graph, positions, triggers, triggerMeta, onDeleteTrigger, nodeVisual, nodeSummary, invalidNodes, onDeleteNode]);

  /**
   * ReactFlow owns node positions while a drag is in flight.
   *
   * They were derived straight from the graph before, and the graph was only written on
   * drag *end* — so throughout the gesture the node re-rendered at its old position and
   * simply would not move. Local state lets ReactFlow apply each intermediate change;
   * `onNodeDragStop` is where the result becomes part of the definition.
   */
  const [nodes, setNodes, onNodesChange] = useNodesState(builtNodes);

  // Re-seed whenever the graph itself changes — a node added, deleted, or edited
  // elsewhere. Position changes flow the other way, through `onNodeDragStop`.
  useEffect(() => {
    setNodes(builtNodes);
  }, [builtNodes, setNodes]);

  const onNodeDragStop: NodeDragHandler = useCallback(
    (_event, node) => {
      if (node.id.startsWith('trigger:')) return;
      onGraphChange(
        moveNode(graph, node.id, { x: node.position.x, y: node.position.y - GRAPH_OFFSET_Y }),
      );
    },
    [graph, onGraphChange],
  );

  const builtEdges = useMemo(() => buildCanvasEdges(graph, triggers.length), [graph, triggers.length]);

  /**
   * ReactFlow owns edge selection, for the same reason it owns node positions.
   *
   * A fully controlled edge list threw away the selection on every render, so clicking
   * an edge never made it look selected and Delete had nothing to act on — the
   * connection could not be removed at all. Local state keeps the selection; removals
   * are persisted to the graph below.
   */
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(builtEdges);

  useEffect(() => {
    setEdges(builtEdges);
  }, [builtEdges, setEdges]);


  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // Selection, hover and the rest are ReactFlow's to track.
      onEdgesChangeInternal(changes);

      let next = graph;
      let touched = false;

      for (const change of changes) {
        if (change.type !== 'remove') continue;
        // Trigger edges are synthesised and marked undeletable, so they never appear
        // here; their id shape would not survive this split anyway.
        if (change.id.startsWith('trigger:')) continue;

        const [from, branch, to] = change.id.split(':');
        next = disconnect(next, from!, to!, branch || undefined);
        touched = true;
      }

      if (touched) onGraphChange(next);
    },
    [graph, onGraphChange, onEdgesChangeInternal],
  );

  /**
   * Double-click to remove a connection.
   *
   * Select-then-Delete works, but it is not discoverable — nothing on the canvas says
   * an edge can be selected. A double-click is deliberate enough not to fire by
   * accident and needs no keyboard, which select-and-Delete does.
   */
  const onEdgeDoubleClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (edge.source.startsWith('trigger:')) return;
      const [from, branch, to] = edge.id.split(':');
      onGraphChange(disconnect(graph, from!, to!, branch || undefined));
    },
    [graph, onGraphChange],
  );

  /**
   * A completed drag between two handles.
   *
   * A trigger source is ignored: triggers start the automation, and the graph's entry is
   * what they lead to. Connecting the first node instead sets the entry, which is what
   * someone dragging from a trigger actually means.
   */
  const onConnect = useCallback(
    (connection: Connection) => {
      const { source, target, sourceHandle } = connection;
      if (!source || !target) return;

      // Dragging from a trigger repoints where the automation starts. Every trigger
      // leads to the same entry, so this moves all of them at once — which is what
      // "any of these triggers starts it" means.
      if (source.startsWith('trigger:')) {
        if (target.startsWith('trigger:')) return;
        onGraphChange({ ...graph, entry: target });
        return;
      }

      onGraphChange(connectNodes(graph, source, target, sourceHandle ?? undefined));
    },
    [graph, onGraphChange],
  );

  /**
   * Which connections are allowed, checked while the edge is still following the cursor.
   *
   * Refusing here rather than on drop is what makes an invalid target *look* invalid —
   * ReactFlow greys the handle — instead of silently swallowing the gesture.
   */
  const isValidConnection = useCallback(
    (connection: Connection) => {
      const { source, target } = connection;
      if (!source || !target || source === target) return false;
      // Nothing flows into a trigger.
      if (target.startsWith('trigger:')) return false;
      return true;
    },
    [],
  );

  const onDragOver = useCallback(
    (event: React.DragEvent) => {
      if (!Array.from(event.dataTransfer.types).includes(paletteMime)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    [paletteMime],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      const raw = event.dataTransfer.getData(paletteMime);
      if (!raw) return;
      event.preventDefault();

      try {
        const payload = JSON.parse(raw) as { kind: string; type: string };
        // Screen coordinates mean nothing to a canvas that pans and zooms; this is the
        // point under the cursor in the graph's own space.
        const flow = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        onPaletteDrop(payload, { x: flow.x, y: flow.y - GRAPH_OFFSET_Y });
      } catch {
        /* a malformed payload is not worth an error */
      }
    },
    [paletteMime, screenToFlowPosition, onPaletteDrop],
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.id.startsWith('trigger:')) {
        onSelectTrigger((node.data as { index: number }).index);
        return;
      }
      onSelectNode(node.id);
    },
    [onSelectNode, onSelectTrigger],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onNodeDragStop={onNodeDragStop}
      onEdgesChange={onEdgesChange}
      onEdgeDoubleClick={onEdgeDoubleClick}
      edgesFocusable
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      onNodeClick={onNodeClick}
      onDragOver={onDragOver}
      onDrop={onDrop}
      // The graph is authored top-down, so a new edge should leave the bottom.
      connectionRadius={30}
      defaultEdgeOptions={{ animated: true }}
      fitView
      fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
      minZoom={0.2}
      maxZoom={1.75}
      proOptions={{ hideAttribution: true }}
      deleteKeyCode={['Backspace', 'Delete']}
      className="bg-muted/20"
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} className="!bg-transparent" />
      {/* Zoom and fit live here rather than in a bar over the canvas. */}
      <Controls showInteractive={false} className="!bottom-4 !left-4 !shadow-lg" />
    </ReactFlow>
  );
}

export function AutomationCanvas(props: AutomationCanvasProps) {
  return (
    <ReactFlowProvider>
      <AutomationCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
