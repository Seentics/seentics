'use client';

import React, { useState, useCallback, useRef, useMemo, useEffect, MutableRefObject } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
} from 'reactflow';
import type { ReactFlowInstance } from 'reactflow';
import 'reactflow/dist/style.css';

import { TriggerNode, ActionNode, ConditionNode } from './nodes/CustomNodes';
import {
  Zap,
  Mail,
  Webhook,
  Bell,
  Trash2,
  Play,
  ChevronLeft,
  Search,
  Globe,
  Target,
  MousePointer,
  MessageSquare,
  Code2,
  Maximize2,
  ChevronDown,
  GripVertical,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// --- Default Node Setup ---
const nodeTypes = {
  triggerNode: TriggerNode,
  actionNode: ActionNode,
  conditionNode: ConditionNode,
};

const defaultTriggerNode = (): Node => ({
  id: '1',
  type: 'triggerNode',
  data: { label: 'Page View', triggerType: 'page_view' },
  position: { x: 380, y: 120 },
});

const initialNodes: Node[] = [defaultTriggerNode()];

const initialEdges: Edge[] = [];

type PaletteItem = {
  id: string;
  label: string;
  type: 'triggerNode' | 'actionNode';
  icon: LucideIcon;
  hint?: string;
};

const TRIGGER_ITEMS: PaletteItem[] = [
  { id: 'page_view', label: 'Page view', type: 'triggerNode', icon: Globe, hint: 'URL or path rules' },
  { id: 'custom_event', label: 'Custom event', type: 'triggerNode', icon: Zap, hint: 'Named tracker event' },
  { id: 'exit_intent', label: 'Exit intent', type: 'triggerNode', icon: MousePointer, hint: 'Cursor leaves viewport' },
  { id: 'goal_reached', label: 'Goal reached', type: 'triggerNode', icon: Target, hint: 'Conversion / goal hit' },
];

const ACTION_ITEMS: PaletteItem[] = [
  { id: 'email', label: 'Send email', type: 'actionNode', icon: Mail, hint: 'Email notification' },
  { id: 'webhook', label: 'Call webhook', type: 'actionNode', icon: Webhook, hint: 'HTTP POST' },
  { id: 'banner', label: 'Show banner', type: 'actionNode', icon: Bell, hint: 'On-site banner' },
  { id: 'modal', label: 'Show modal', type: 'actionNode', icon: MessageSquare, hint: 'Modal dialog' },
  { id: 'redirect', label: 'Redirect', type: 'actionNode', icon: MousePointer, hint: 'Send user to URL' },
  { id: 'script', label: 'Run script', type: 'actionNode', icon: Code2, hint: 'Custom JS snippet' },
];

type PaletteSectionKey = 'Triggers' | 'Actions';

type PanelDraft = {
  pageUrlMatch: string;
  rateLimitSec: string;
  configPayload: string;
};

const emptyPanelDraft = (): PanelDraft => ({
  pageUrlMatch: '',
  rateLimitSec: '60',
  configPayload: '',
});

/** Serialise nodes + edges into the definition JSONB stored by the backend. */
function serializeDefinition(nodes: Node[], edges: Edge[]): Record<string, unknown> {
  const triggerNode = nodes.find((n) => n.type === 'triggerNode');
  const actionNodes = nodes.filter((n) => n.type === 'actionNode');
  return {
    trigger: {
      event:        triggerNode?.data?.triggerType ?? 'page_view',
      pageUrlMatch: triggerNode?.data?.pageUrlMatch ?? undefined,
      rateLimitSec: triggerNode?.data?.rateLimitSec ?? undefined,
    },
    actions: actionNodes.map((n, i) => ({
      id:           n.id,
      type:         n.data?.actionType ?? 'webhook',
      actionType:   n.data?.actionType ?? 'webhook',
      label:        n.data?.label      ?? '',
      configPayload: n.data?.configPayload ?? '',
      orderIndex:   i,
    })),
    nodes,
    edges,
  };
}

function WorkflowBuilderInner({
  className,
  saveRef,
}: {
  className?: string;
  saveRef?: MutableRefObject<(() => Record<string, unknown>) | null>;
}) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [sectionOpen, setSectionOpen] = useState<Record<PaletteSectionKey, boolean>>({
    Triggers: true,
    Actions: true,
  });
  const [canvasDragActive, setCanvasDragActive] = useState(false);
  const [panelDraft, setPanelDraft] = useState<PanelDraft>(emptyPanelDraft);

  useEffect(() => {
    if (!selectedNode) {
      setPanelDraft(emptyPanelDraft());
      return;
    }
    const d = selectedNode.data as Record<string, unknown>;
    setPanelDraft({
      pageUrlMatch: typeof d.pageUrlMatch === 'string' ? d.pageUrlMatch : '',
      rateLimitSec:
        d.rateLimitSec != null && String(d.rateLimitSec).trim() !== ''
          ? String(d.rateLimitSec)
          : '60',
      configPayload: typeof d.configPayload === 'string' ? d.configPayload : '',
    });
  }, [selectedNode?.id]);

  // Keep saveRef up-to-date with latest nodes/edges so the parent can call it anytime.
  useEffect(() => {
    if (!saveRef) return;
    saveRef.current = () => serializeDefinition(nodes, edges);
    return () => { if (saveRef) saveRef.current = null; };
  }, [nodes, edges, saveRef]);

  const filteredSections = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    const match = (item: PaletteItem) =>
      !q ||
      item.label.toLowerCase().includes(q) ||
      item.id.replace(/_/g, ' ').toLowerCase().includes(q) ||
      (item.hint?.toLowerCase().includes(q) ?? false);

    return [
      { key: 'Triggers' as const, items: TRIGGER_ITEMS.filter(match) },
      { key: 'Actions' as const, items: ACTION_ITEMS.filter(match) },
    ].filter((s) => s.items.length > 0);
  }, [paletteQuery]);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: { strokeWidth: 2, stroke: 'hsl(var(--primary))' },
            markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))' },
          },
          eds,
        ),
      ),
    [setEdges],
  );

  const onDragStart = (event: React.DragEvent, nodeType: string, label: string, variant: string) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ nodeType, label, variant }));
    event.dataTransfer.effectAllowed = 'copy';
  };

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setCanvasDragActive(false);

      if (!reactFlowInstance) return;

      let nodeData: { nodeType: string; label: string; variant: string };
      try {
        nodeData = JSON.parse(event.dataTransfer.getData('application/reactflow'));
      } catch {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: nodeData.nodeType,
        position,
        data: {
          label: nodeData.label,
          triggerType: nodeData.nodeType === 'triggerNode' ? nodeData.variant : undefined,
          actionType: nodeData.nodeType === 'actionNode' ? nodeData.variant : undefined,
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(nodes.find((n) => n.id === node.id) ?? node);
    },
    [nodes],
  );

  const onPaneClick = () => setSelectedNode(null);

  const removeNodeById = useCallback(
    (id: string) => {
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setSelectedNode((cur) => (cur?.id === id ? null : cur));
    },
    [setEdges, setNodes],
  );

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      const ids = new Set(deleted.map((n) => n.id));
      setEdges((eds) => eds.filter((e) => !ids.has(e.source) && !ids.has(e.target)));
      setSelectedNode((cur) => (cur && ids.has(cur.id) ? null : cur));
    },
    [setEdges],
  );

  const applyParameters = useCallback(() => {
    if (!selectedNode) return;
    const id = selectedNode.id;
    const next = nodes.map((n) => {
      if (n.id !== id) return n;
      if (n.type === 'triggerNode') {
        const rateRaw = panelDraft.rateLimitSec.trim();
        return {
          ...n,
          data: {
            ...n.data,
            pageUrlMatch: panelDraft.pageUrlMatch.trim() || undefined,
            rateLimitSec:
              rateRaw === '' ? undefined : Math.max(0, Number.parseInt(rateRaw, 10) || 0),
          },
        };
      }
      if (n.type === 'actionNode') {
        return {
          ...n,
          data: {
            ...n.data,
            configPayload: panelDraft.configPayload.trim() || undefined,
          },
        };
      }
      return n;
    });
    const withoutSelection = next.map((n) => ({ ...n, selected: false }));
    setNodes(withoutSelection);
    setSelectedNode(null);
  }, [selectedNode, panelDraft, nodes, setNodes]);

  const resetCanvas = useCallback(() => {
    setEdges([]);
    setNodes([defaultTriggerNode()]);
    setSelectedNode(null);
    requestAnimationFrame(() => {
      reactFlowInstance?.fitView({ padding: 0.35, duration: 200 });
    });
  }, [reactFlowInstance, setEdges, setNodes]);

  return (
    <div
      className={cn(
        'flex h-full w-full min-h-0 overflow-hidden border border-border/40 bg-muted/30 dark:bg-[hsl(220_16%_8%)]',
        className,
      )}
    >
      <div
        ref={reactFlowWrapper}
        className={cn(
          'relative min-h-0 min-w-0 flex-1 bg-[hsl(var(--background))] transition-shadow duration-150 dark:bg-[hsl(218_20%_6%)]',
          canvasDragActive && 'ring-2 ring-primary/40 ring-inset',
        )}
        onDragEnter={(e) => {
          if (Array.from(e.dataTransfer.types).includes('application/reactflow')) setCanvasDragActive(true);
        }}
        onDragLeave={(e) => {
          const cur = e.currentTarget;
          const rel = e.relatedTarget;
          if (rel instanceof Element && cur.contains(rel)) return;
          setCanvasDragActive(false);
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={(c) => setNodes((applied) => applyNodeChanges(c, applied))}
          onEdgesChange={(c) => setEdges((applied) => applyEdgeChanges(c, applied))}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onNodesDelete={onNodesDelete}
          nodeTypes={nodeTypes}
          snapToGrid
          snapGrid={[16, 16]}
          defaultViewport={{ x: 40, y: 24, zoom: 0.88 }}
          minZoom={0.12}
          maxZoom={1.65}
          panOnScroll
          selectionOnDrag
          panActivationKeyCode="Space"
          selectionKeyCode="Shift"
          proOptions={{ hideAttribution: true }}
          deleteKeyCode={['Backspace', 'Delete']}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1.1}
            color="hsl(var(--muted-foreground) / 0.14)"
          />
          <Controls
            showInteractive={false}
            className="m-4 overflow-hidden rounded-lg border border-border/60 bg-card/95 shadow-lg backdrop-blur-sm [&_button]:border-0 [&_button]:bg-transparent [&_button:hover]:bg-muted"
          />
        </ReactFlow>

        <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 gap-2 rounded-lg border border-border/60 bg-card/90 p-1.5 shadow-xl backdrop-blur-md">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-2 rounded-lg px-3 text-xs font-semibold"
            type="button"
            onClick={resetCanvas}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-2 rounded-lg px-3 text-xs font-semibold"
            type="button"
            onClick={() => reactFlowInstance?.fitView({ padding: 0.35, duration: 260 })}
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Fit view
          </Button>
          <Button variant="ghost" size="sm" className="h-9 gap-2 rounded-lg px-3 text-xs font-semibold" type="button">
            <Play className="h-3.5 w-3.5" />
            Test
          </Button>
        </div>

        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="absolute bottom-24 left-4 top-4 z-[5] flex w-[20rem] flex-col overflow-hidden rounded-lg border border-border/60 bg-card/95 shadow-2xl backdrop-blur-md sm:w-[22rem]"
            >
              <div className="border-b border-border/50 bg-muted/25 px-4 py-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Parameters</h3>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      type="button"
                      onClick={() => removeNodeById(selectedNode.id)}
                      aria-label="Remove node from canvas"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      type="button"
                      onClick={() => setSelectedNode(null)}
                      aria-label="Close panel"
                    >
                      <ChevronLeft size={18} />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Zap size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">{selectedNode.data.label}</p>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {selectedNode.id}
                    </p>
                  </div>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
                {selectedNode.type === 'triggerNode' && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Page URL match</label>
                      <input
                        value={panelDraft.pageUrlMatch}
                        onChange={(e) =>
                          setPanelDraft((p) => ({ ...p, pageUrlMatch: e.target.value }))
                        }
                        className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        placeholder="e.g. /pricing"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">
                        Rate limit (sec)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={panelDraft.rateLimitSec}
                        onChange={(e) =>
                          setPanelDraft((p) => ({ ...p, rateLimitSec: e.target.value }))
                        }
                        className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                )}

                {selectedNode.type === 'actionNode' && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Configuration</label>
                      <p className="text-xs text-muted-foreground">
                        Parameters for {String(selectedNode.data.label).toLowerCase()}…
                      </p>
                    </div>
                    <textarea
                      value={panelDraft.configPayload}
                      onChange={(e) =>
                        setPanelDraft((p) => ({ ...p, configPayload: e.target.value }))
                      }
                      className="min-h-[7.5rem] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="JSON or payload…"
                    />
                  </div>
                )}

                {selectedNode.type !== 'triggerNode' && selectedNode.type !== 'actionNode' && (
                  <p className="text-xs text-muted-foreground">
                    This node has no extra fields. You can delete it from the canvas if you don&apos;t need it.
                  </p>
                )}
              </div>
              <div className="border-t border-border/50 bg-muted/20 p-3">
                <Button
                  className="h-10 w-full font-semibold"
                  type="button"
                  variant="secondary"
                  disabled={selectedNode.type !== 'triggerNode' && selectedNode.type !== 'actionNode'}
                  onClick={applyParameters}
                >
                  Apply
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <aside className="flex w-[272px] shrink-0 flex-col border-l border-border bg-muted/30">
        <div className="shrink-0 space-y-3 border-b border-border px-3 py-3">
          <div>
            <p className="text-xs font-medium text-foreground">Nodes</p>
            <p className="text-[11px] text-muted-foreground">Drag onto the canvas</p>
          </div>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={paletteQuery}
              onChange={(e) => setPaletteQuery(e.target.value)}
              placeholder="Search…"
              className="h-8 rounded-lg border border-input bg-background pl-8 text-xs shadow-sm"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]">
          {filteredSections.length === 0 ? (
            <div className="mx-3 mt-3 rounded-lg border border-dashed border-border px-3 py-8 text-center">
              <p className="text-sm text-foreground">No matches</p>
              <p className="mt-1 text-xs text-muted-foreground">Try another search.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredSections.map((section) => {
                const open = sectionOpen[section.key];
                return (
                  <div key={section.key} className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() =>
                        setSectionOpen((prev) => ({ ...prev, [section.key]: !prev[section.key] }))
                      }
                      className="flex w-full items-center gap-2 rounded-lg-sm px-2 py-2 text-left text-xs font-medium text-foreground hover:bg-muted/50"
                    >
                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                          !open && '-rotate-90',
                        )}
                      />
                      <span className="min-w-0 flex-1">{section.key}</span>
                      <span className="tabular-nums text-muted-foreground">{section.items.length}</span>
                    </button>
                    {open ? (
                      <div className="space-y-0.5 pb-2 pl-1 pr-1 pt-0">
                        {section.items.map((item) => (
                          <div
                            key={item.id}
                            draggable
                            title={item.hint}
                            onDragStart={(e) => onDragStart(e, item.type, item.label, item.id)}
                            className="group flex cursor-grab select-none items-start gap-2 rounded-lg border border-transparent px-2 py-2 hover:border-border hover:bg-background active:cursor-grabbing"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                              <item.icon className="h-3.5 w-3.5" strokeWidth={2} />
                            </div>
                            <div className="min-w-0 flex-1 pt-0.5">
                              <p className="text-xs font-medium leading-snug text-foreground">{item.label}</p>
                              {item.hint ? (
                                <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{item.hint}</p>
                              ) : null}
                            </div>
                            <GripVertical className="mt-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-40 group-hover:opacity-70" strokeWidth={2} />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export function WorkflowEditor({
  className,
  saveRef,
}: {
  className?: string;
  saveRef?: MutableRefObject<(() => Record<string, unknown>) | null>;
}) {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderInner className={className} saveRef={saveRef} />
    </ReactFlowProvider>
  );
}
