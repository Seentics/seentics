'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Panel,
  BackgroundVariant,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { TriggerNode, ActionNode, ConditionNode } from './nodes/CustomNodes';
import { 
  Zap, Mail, Webhook, Bell, Trash2, Save, Play, ChevronRight, Settings2,
  Globe, Clock, AlertTriangle, Target, MousePointer, MessageSquare, Eye, Code2, GitBranch
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// --- Default Node Setup ---
const nodeTypes = {
  triggerNode: TriggerNode,
  actionNode: ActionNode,
  conditionNode: ConditionNode,
};

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'triggerNode',
    data: { label: 'Page View', triggerType: 'page_view' },
    position: { x: 250, y: 50 },
  },
];

const initialEdges: Edge[] = [];

// --- Sidebar Configuration ---
const SIDEBAR_ITEMS = [
  {
    title: 'Triggers',
    items: [
      { id: 'page_view',    label: 'Page View',    type: 'triggerNode', icon: Globe, color: 'text-primary' },
      { id: 'custom_event', label: 'Custom Event', type: 'triggerNode', icon: Zap,    color: 'text-primary' },
      { id: 'exit_intent',  label: 'Exit Intent',  type: 'triggerNode', icon: MousePointer, color: 'text-primary' },
      { id: 'goal_reached', label: 'Goal Reached', type: 'triggerNode', icon: Target,  color: 'text-primary' },
    ]
  },
  {
    title: 'Flow Control',
    items: [
      { id: 'condition',    label: 'Condition',    type: 'conditionNode', icon: GitBranch, color: 'text-amber-500' },
    ]
  },
  {
    title: 'Actions',
    items: [
      { id: 'email',        label: 'Send Email',      type: 'actionNode', icon: Mail,      color: 'text-indigo-500' },
      { id: 'webhook',      label: 'Trigger Webhook',  type: 'actionNode', icon: Webhook,   color: 'text-indigo-500' },
      { id: 'banner',       label: 'Show Banner',     type: 'actionNode', icon: Bell,      color: 'text-indigo-500' },
      { id: 'modal',        label: 'Show Modal',      type: 'actionNode', icon: MessageSquare,   color: 'text-indigo-500' },
      { id: 'redirect',     label: 'Redirect User',   type: 'actionNode', icon: MousePointer, color: 'text-indigo-500' },
      { id: 'script',       label: 'Execute Script',   type: 'actionNode', icon: Code2,     color: 'text-indigo-500' },
    ]
  }
];

export function WorkflowBuilder() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({
      ...params,
      animated: true,
      style: { strokeWidth: 2, stroke: 'hsl(var(--primary))' },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))' }
    }, eds)),
    [setEdges]
  );

  const onDragStart = (event: React.DragEvent, nodeType: string, label: string, variant: string) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ nodeType, label, variant }));
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const nodeData = JSON.parse(event.dataTransfer.getData('application/reactflow'));
      
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNode: Node = {
        id: `node_${Date.now()}`,
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
    [reactFlowInstance, setNodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onNodeClick = (_: any, node: Node) => setSelectedNode(node);
  const onPaneClick = () => setSelectedNode(null);

  return (
    <div className="flex h-[calc(100vh-140px)] w-full overflow-hidden border border-border/60 bg-card/50 rounded-2xl shadow-xl backdrop-blur-sm animate-in fade-in zoom-in-95 duration-700">
      
      {/* Sidebar Toolset */}
      <div className="w-64 flex flex-col border-r border-border/40 bg-muted/20">
        <div className="p-5 border-b border-border/40">
           <h3 className="text-sm font-bold tracking-tight mb-1 flex items-center gap-2">
             <Settings2 size={16} className="text-primary" />
             Nodes Library
           </h3>
           <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest leading-none">Drag to canvas</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {SIDEBAR_ITEMS.map(section => (
            <div key={section.title} className="space-y-3">
              <h4 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest pl-1">{section.title}</h4>
              <div className="space-y-2">
                {section.items.map(item => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, item.type, item.label, item.id)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card hover:border-primary/40 hover:bg-muted/40 transition-all cursor-grab active:cursor-grabbing group"
                  >
                    <div className={cn("h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0", item.color)}>
                      <item.icon size={14} />
                    </div>
                    <span className="text-xs font-semibold group-hover:text-foreground transition-colors">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Canvas */}
      <div ref={reactFlowWrapper} className="flex-1 h-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={(nds) => setNodes((nds_applied) => applyNodeChanges(nds, nds_applied))}
          onEdgesChange={(eds) => setEdges((eds_applied) => applyEdgeChanges(eds, eds_applied))}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
        >
          <Background variant={BackgroundVariant.Dots} gap={30} size={1} color="hsl(var(--muted-foreground)/0.2)" />
          <Controls className="bg-card border-border/60 shadow-lg rounded-xl overflow-hidden" />
          <MiniMap 
            nodeColor={(n) => {
              if (n.type === 'triggerNode') return 'hsl(var(--primary))';
              if (n.type === 'actionNode') return '#6366f1';
              if (n.type === 'conditionNode') return '#f59e0b';
              return 'hsl(var(--muted))';
            }}
            maskColor="hsl(var(--primary)/0.02)"
            className="rounded-lg border border-border/60 overflow-hidden shadow-xl"
            style={{ height: 120, width: 200, bottom: 20, right: 20 }}
          />

          <Panel position="top-right" className="flex items-center gap-2 p-1 bg-background/60 backdrop-blur-md rounded-xl border border-border/60 shadow-lg m-4">
            <Button variant="ghost" size="sm" className="h-9 px-3 gap-2 font-bold text-xs">
              <Trash2 className="h-4 w-4" /> Clear
            </Button>
            <div className="w-px h-6 bg-border/40" />
            <Button variant="ghost" size="sm" className="h-9 px-3 gap-2 font-bold text-xs">
                 <Play className="h-4 w-4" /> Test Flow
            </Button>
            <Button size="sm" className="h-9 px-4 gap-2 font-black text-xs shadow-lg shadow-primary/20">
              <Save className="h-4 w-4" /> Save Automation
            </Button>
          </Panel>
        </ReactFlow>

        {/* Properties Panel (Drawer-like) */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              className="absolute top-4 right-4 bottom-4 w-80 bg-card border border-border/60 shadow-2xl rounded-2xl overflow-hidden z-[4]"
            >
              <div className="p-5 border-b border-border/40 bg-muted/30">
                <div className="flex items-center justify-between mb-4">
                   <h3 className="text-sm font-bold">Node Properties</h3>
                   <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setSelectedNode(null)}>
                      <ChevronRight size={18} />
                   </Button>
                </div>
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <Zap size={20} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-foreground">{selectedNode.data.label}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">ID: {selectedNode.id}</p>
                    </div>
                </div>
              </div>
              <div className="p-5 space-y-6">
                 {selectedNode.type === 'triggerNode' && (
                     <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Page URL Match</label>
                            <input
                              className="w-full flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                              placeholder="e.g. /pricing"
                            />
                        </div>
                        <div className="space-y-1.5">
                             <label className="text-[10px] font-bold text-muted-foreground uppercase">Rate Limit (sec)</label>
                             <input type="number" className="w-full flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" defaultValue={60} />
                        </div>
                     </div>
                 )}
                 
                 {selectedNode.type === 'actionNode' && (
                     <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Configuration</label>
                            <p className="text-xs text-muted-foreground">Define parameters for {selectedNode.data.label.toLowerCase()}...</p>
                        </div>
                        <textarea className="w-full h-32 rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="JSON payload or markdown content..." />
                     </div>
                 )}
                 
                 {selectedNode.type === 'conditionNode' && (
                     <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Select Attribute</label>
                            <select className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-xs">
                                <option>Country</option>
                                <option>Device</option>
                                <option>Browser</option>
                                <option>Current Page</option>
                                <option>Session Duration</option>
                            </select>
                        </div>
                        <div className="space-y-1.5 flex gap-2">
                             <select className="w-20 h-9 rounded-md border border-input bg-transparent px-2 text-xs shrink-0">
                                <option>is</option>
                                <option>is not</option>
                                <option>contains</option>
                            </select>
                             <input className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 text-xs" placeholder="value" />
                        </div>
                     </div>
                 )}
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-muted/30 border-t border-border/40">
                  <Button className="w-full h-10 font-bold text-sm bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20">Update Node</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function WorkflowEditor() {
    return (
        <ReactFlowProvider>
            <WorkflowBuilder />
        </ReactFlowProvider>
    );
}
