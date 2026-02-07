'use client';

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
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

const reactFlowStyle = `
`;

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
    loadTemplate,
    resetWorkflow,
    updateNode,
    addNode,
    selectedNodeId,
    setSelectedNodeId
  } = useAutomationStore();

  const searchParams = useSearchParams();
  const templateId = searchParams?.get('template');

  // Load animation effect
  useEffect(() => {
    if (automationId) {
      loadAutomation(websiteId, automationId);
    } else if (templateId) {
      loadTemplate(templateId);
    } else {
      resetWorkflow();
    }
  }, [automationId, templateId, websiteId, loadAutomation, loadTemplate, resetWorkflow]);

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

      addNode(newNode);
    },
    [reactFlowInstance, addNode]
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
    <div className="fixed inset-0 bg-[#020617] overflow-hidden flex flex-col text-slate-200 z-[50]">
      <BuilderToolbar 
        websiteId={websiteId}
        automationId={automationId}
        onTestClick={() => setShowExecutionPreview(true)} 
      />
      
      <style dangerouslySetInnerHTML={{ __html: reactFlowStyle }} />
      
      <div className="relative flex-1" ref={reactFlowWrapper}>
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
          className="bg-transparent"
          connectionMode={ConnectionMode.Loose}
        >
          <Background color="#1e293b" gap={20} size={1} variant={BackgroundVariant.Dots} />
          <Controls className="!bg-slate-900 !border-slate-800 !shadow-2xl !rounded-xl overflow-hidden" />
          
          {/* Main Sidebar - Positioned Absolutely */}
          <Panel position="top-right" className="!m-0 h-full pointer-events-none">
            <div className="h-[calc(100vh-64px)] pointer-events-auto">
              <EnhancedBuilderSidebar />
            </div>
          </Panel>

          {/* Configuration Panel - Overlay */}
          {showConfigPanel && selectedNode && (
            <div className="absolute inset-y-0 left-0 w-96 z-50 animate-in slide-in-from-left duration-300">
              <NodeConfigPanel 
                node={selectedNode} 
                onClose={handleCloseConfigPanel}
              />
            </div>
          )}
        </ReactFlow>
      </div>
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
