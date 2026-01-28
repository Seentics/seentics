'use client';

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  Panel,
  ConnectionMode,
  MarkerType,
  NodeChange,
  EdgeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useParams, useSearchParams } from 'next/navigation';

import { TriggerNode } from './TriggerNode';
import { ActionNode } from './ActionNode';
import { ConditionNode } from './ConditionNode';
import { AdvancedConditionNode } from './AdvancedConditionNode';
import { EnhancedBuilderSidebar } from './EnhancedBuilderSidebar';
import { BuilderToolbar } from './BuilderToolbar';
import { NodeConfigPanel } from './NodeConfigPanel';
import { useAutomationStore } from '@/stores/automationStore';

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'triggerNode',
    data: { label: 'Page View', config: { triggerType: 'pageView' } },
    position: { x: 250, y: 150 },
  },
];

const initialEdges: Edge[] = [];

const nodeTypes = {
  triggerNode: TriggerNode,
  actionNode: ActionNode,
  conditionNode: ConditionNode,
  advancedConditionNode: AdvancedConditionNode,
};

let id = 0;
const getId = () => `node_${id++}`;

export const WorkflowBuilder = ({ 
  websiteId, 
  automationId 
}: { 
  websiteId: string; 
  automationId?: string | null;
}) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [showExecutionPreview, setShowExecutionPreview] = useState(false);

  const { 
    nodes, 
    edges, 
    setNodes, 
    onNodesChange, 
    setEdges, 
    onEdgesChange, 
    loadAutomation, 
    resetWorkflow,
    updateNode,
    selectedNodeId,
    setSelectedNodeId
  } = useAutomationStore();

  // Load animation effect
  useEffect(() => {
    if (automationId) {
      loadAutomation(websiteId, automationId);
    } else {
      resetWorkflow();
    }
  }, [automationId, websiteId, loadAutomation, resetWorkflow]);

  const onConnect = useCallback(
    (params: Connection | Edge) =>
      setEdges(
        addEdge(
          {
            ...params,
            type: 'smoothstep',
            animated: true,
            style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: 'hsl(var(--primary))',
            },
          },
          edges
        )
      ),
    [edges, setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      const label = event.dataTransfer.getData('application/reactflow-label');
      const subtype = event.dataTransfer.getData('application/reactflow-subtype');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - (reactFlowBounds?.left || 0),
        y: event.clientY - (reactFlowBounds?.top || 0),
      });

      const initialConfig: any = {};
      if (type === 'triggerNode' && subtype) initialConfig.triggerType = subtype;
      if (type === 'actionNode' && subtype) initialConfig.actionType = subtype;
      if (type.includes('conditionNode') && subtype) initialConfig.conditionType = subtype;

      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: { label: `${label}`, config: initialConfig },
      };

      setNodes([...nodes, newNode]);
    },
    [reactFlowInstance, nodes, setNodes]
  );

  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setShowConfigPanel(true);
  };

  const handleCloseConfigPanel = () => {
    setShowConfigPanel(false);
    setSelectedNodeId(null);
  };

  const selectedNode = useMemo(() => 
    nodes.find(n => n.id === selectedNodeId) || null
  , [nodes, selectedNodeId]);

  return (
    <div className="flex h-screen w-full bg-slate-950 overflow-hidden flex-col text-slate-200">
      <BuilderToolbar 
        websiteId={websiteId}
        automationId={automationId}
        onTestClick={() => setShowExecutionPreview(true)} 
      />
      <div className="flex flex-1 overflow-hidden" ref={reactFlowWrapper}>
        <div className="flex-1 h-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            fitView
            className=""
          >
            <Background color="#334155" gap={24} size={1} />
            <Controls className="!bg-white dark:!bg-slate-800 !border-0 !shadow-xl !rounded" />

            {/* Stats Panel */}
            {/* <Panel position="top-left" className="!border-0 !shadow-lg !rounded bg-white dark:bg-slate-800 p-4 space-y-2 hidden md:block">
              <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest opacity-50">
                📊 Workflow Stats
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded p-2 min-w-[70px]">
                  <div className="text-sm font-black text-primary">{nodes.length}</div>
                  <div className="text-[10px] text-muted-foreground font-bold uppercase">Nodes</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded p-2 min-w-[70px]">
                  <div className="text-sm font-black text-primary">{edges.length}</div>
                  <div className="text-[10px] text-muted-foreground font-bold uppercase">Edges</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded p-2 min-w-[70px]">
                  <div className="text-sm font-black text-green-600">0%</div>
                  <div className="text-[10px] text-muted-foreground font-bold uppercase">Health</div>
                </div>
              </div>
            </Panel> */}
          </ReactFlow>
        </div>
        <EnhancedBuilderSidebar />
      </div>

      {showConfigPanel && selectedNode && (
        <NodeConfigPanel 
          node={selectedNode} 
          onClose={handleCloseConfigPanel}
        />
      )}
    </div>
  );
};

export default function AutomationBuilderContainer() {
  const params = useParams();
  const searchParams = useSearchParams();
  const websiteId = params?.websiteId as string;
  const automationId = searchParams.get('id');

  return (
    <ReactFlowProvider>
      <WorkflowBuilder websiteId={websiteId} automationId={automationId} />
    </ReactFlowProvider>
  );
}
