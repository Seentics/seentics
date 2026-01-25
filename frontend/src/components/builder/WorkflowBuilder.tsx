'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
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
  Panel,
  ConnectionMode,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

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

export const WorkflowBuilder = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [showExecutionPreview, setShowExecutionPreview] = useState(false);

  const { setNodes: storeSetNodes, setEdges: storeSetEdges } = useAutomationStore();

  const onConnect = useCallback(
    (params: Connection | Edge) =>
      setEdges((eds) =>
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
          eds
        )
      ),
    [setEdges]
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

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - (reactFlowBounds?.left || 0),
        y: event.clientY - (reactFlowBounds?.top || 0),
      });

      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: { label: `${label}`, config: {} },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setShowConfigPanel(true);
  };

  const handleCloseConfigPanel = () => {
    setShowConfigPanel(false);
    setSelectedNode(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex h-screen w-full bg-slate-50 dark:bg-slate-900 overflow-hidden flex-col">
      <BuilderToolbar onTestClick={() => setShowExecutionPreview(true)} />
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
            nodeTypes={nodeTypes}
            connectionMode={ConnectionMode.Loose}
            fitView
            className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950"
          >
            <Background color="#ccc" gap={20} size={1} />
            <Controls className="!bg-white dark:!bg-slate-800 !border-0 !shadow-xl !rounded-xl" />

            {/* Stats Panel */}
            <Panel position="top-left" className="!border-0 !shadow-lg !rounded-xl bg-white dark:bg-slate-800 p-4 space-y-2">
              <div className="text-xs font-black text-slate-900 dark:text-white">
                📊 Workflow Stats
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2">
                  <div className="text-sm font-black text-primary">{nodes.length}</div>
                  <div className="text-[10px] text-muted-foreground">Nodes</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2">
                  <div className="text-sm font-black text-primary">{edges.length}</div>
                  <div className="text-[10px] text-muted-foreground">Connections</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2">
                  <div className="text-sm font-black text-green-600">0</div>
                  <div className="text-[10px] text-muted-foreground">Executions</div>
                </div>
              </div>
            </Panel>
          </ReactFlow>
        </div>
        <EnhancedBuilderSidebar />
      </div>

      {/* Config Panel Modal */}
      {showConfigPanel && (
        <NodeConfigPanel node={selectedNode} onClose={handleCloseConfigPanel} />
      )}

    </div>
  );
};

export default function AutomationBuilderPage() {
  return (
    <ReactFlowProvider>
      <WorkflowBuilder />
    </ReactFlowProvider>
  );
}
