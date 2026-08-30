'use client';

import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
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
  type NodeChange,
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

  const nodes: Node[] = useMemo(() => {
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

  const edges: Edge[] = useMemo(() => {
    const byId = new Map(graph.nodes.map(n => [n.id, n]));

    return graph.edges.map(e => {
      const from = byId.get(e.from);
      return {
        id: `${e.from}:${e.branch ?? ''}:${e.to}`,
        source: e.from,
        target: e.to,
        sourceHandle: e.branch ?? null,
        // Animated in the direction of flow — the cheapest way to make a branching
        // graph readable without tracing arrowheads.
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
  }, [graph]);

  /**
   * Persist a node's new home when a drag ends.
   *
   * Only on `dragging === false`: writing every intermediate position would put a
   * hundred entries through the definition for one gesture, and re-render the whole
   * graph on each.
   */
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      let next = graph;
      let touched = false;

      for (const change of changes) {
        if (change.type !== 'position' || change.dragging || !change.position) continue;
        if (change.id.startsWith('trigger:')) continue;

        next = moveNode(next, change.id, {
          x: change.position.x,
          y: change.position.y - GRAPH_OFFSET_Y,
        });
        touched = true;
      }

      if (touched) onGraphChange(next);
    },
    [graph, onGraphChange],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      let next = graph;
      let touched = false;

      for (const change of changes) {
        if (change.type !== 'remove') continue;
        const [from, branch, to] = change.id.split(':');
        next = disconnect(next, from!, to!, branch || undefined);
        touched = true;
      }

      if (touched) onGraphChange(next);
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

      if (source.startsWith('trigger:')) {
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
      onEdgesChange={onEdgesChange}
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
