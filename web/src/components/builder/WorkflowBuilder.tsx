'use client';

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

import { BuilderToolbar } from './BuilderToolbar';
import { NodeConfigModal } from './NodeConfigModal';
import { useAutomationStore } from '@/stores/automationStore';
import { LinearBuilder } from './LinearBuilder';
import { EnhancedBuilderSidebar } from './EnhancedBuilderSidebar';

export const WorkflowBuilder = ({ 
  websiteId, 
  automationId 
}: { 
  websiteId: string; 
  automationId?: string | null;
}) => {
  const { 
    nodes, 
    loadAutomation, 
    loadTemplate,
    resetWorkflow,
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

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      const label = event.dataTransfer.getData('application/reactflow-label');
      const description = event.dataTransfer.getData('application/reactflow-description');
      const subtype = event.dataTransfer.getData('application/reactflow-subtype');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const initialConfig: any = {};
      if (type === 'triggerNode' && subtype) initialConfig.triggerType = subtype;
      if (type === 'actionNode' && subtype) initialConfig.actionType = subtype;
      if (type.includes('conditionNode') && subtype) initialConfig.conditionType = subtype;

      const newNode: any = {
        id: `node_${Date.now()}`,
        type,
        position: { x: 0, y: 0 },
        data: { label: `${label}`, description: `${description}`, config: initialConfig },
      };

      addNode(newNode);
    },
    [addNode, nodes]
  );

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="fixed inset-0 flex flex-col w-full h-full bg-zinc-950 overflow-hidden z-[50]">
      <BuilderToolbar 
        websiteId={websiteId} 
        automationId={automationId} 
      />
      
      <div 
        className="relative flex-1 flex overflow-hidden" 
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        {/* List-Based Builder */}
        <LinearBuilder />
        
        {/* Sidebar */}
        <div className="w-[320px] h-full border-l border-white/[0.06] bg-zinc-900/80 backdrop-blur-xl">
           <EnhancedBuilderSidebar />
        </div>

        {/* Configuration Modal */}
        {selectedNode && (
          <NodeConfigModal 
            node={selectedNode} 
            onClose={() => setSelectedNodeId(null)}
          />
        )}
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
    <WorkflowBuilder websiteId={websiteId} automationId={automationId} />
  );
}
