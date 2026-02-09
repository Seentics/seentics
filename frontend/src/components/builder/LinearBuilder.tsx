'use client';

import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { 
  Plus, 
  Trash2, 
  Settings2, 
  GripVertical, 
  Zap, 
  ArrowDown, 
  CheckCircle2, 
  AlertCircle,
  Play,
  GitBranch
} from 'lucide-react';
import { useAutomationStore } from '@/stores/automationStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TRIGGER_TYPES, 
  ACTION_TYPES, 
  LOGIC_TYPES 
} from './EnhancedBuilderSidebar'; // I'll need to export these constants

// Helper to get icon for node
const getIcon = (type: string, subtype?: string) => {
  const all = [...TRIGGER_TYPES, ...ACTION_TYPES, ...LOGIC_TYPES];
  const item = all.find(i => (i.type === type && (!subtype || (i as any).subtype === subtype)));
  return item?.icon || Zap;
};

const getColorClass = (type: string, subtype?: string) => {
  const all = [...TRIGGER_TYPES, ...ACTION_TYPES, ...LOGIC_TYPES];
  const item = all.find(i => (i.type === type && (!subtype || (i as any).subtype === subtype)));
  
  const colorMap: Record<string, string> = {
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    lime: 'bg-lime-500/10 text-lime-500 border-lime-500/20',
    green: 'bg-green-500/10 text-green-500 border-green-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    pink: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    rose: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  };
  
  return colorMap[item?.color || 'blue'] || colorMap.blue;
};

export const LinearBuilder = () => {
  const { nodes, setNodes, addNode, deleteNode, setSelectedNodeId } = useAutomationStore();
  
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(nodes);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setNodes(items);
  };

  // Group nodes by type for better visualization
  const getNodeTypeLabel = (node: any) => {
    if (node.type === 'triggerNode') return 'TRIGGER';
    if (node.type === 'conditionNode') return 'CONDITION';
    if (node.type === 'actionNode') return 'ACTION';
    return 'STEP';
  };

  const getNodeTypeBadgeClass = (node: any) => {
    if (node.type === 'triggerNode') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (node.type === 'conditionNode') return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (node.type === 'actionNode') return 'bg-green-500/20 text-green-400 border-green-500/30';
    return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  // Validation
  const triggerCount = nodes.filter(n => n.type === 'triggerNode').length;
  const conditionCount = nodes.filter(n => n.type === 'conditionNode').length;
  const actionCount = nodes.filter(n => n.type === 'actionNode').length;
  const hasMultipleTriggers = triggerCount > 1;
  const needsTrigger = triggerCount === 0 && nodes.length > 0;
  const needsAction = actionCount === 0 && nodes.length > 0;

  // Check if a node is the first in a condition group
  const isFirstConditionInGroup = (index: number) => {
    if (nodes[index]?.type !== 'conditionNode') return false;
    if (index === 0) return true;
    return nodes[index - 1]?.type !== 'conditionNode';
  };

  // Check if a node is the last in a condition group
  const isLastConditionInGroup = (index: number) => {
    if (nodes[index]?.type !== 'conditionNode') return false;
    if (index === nodes.length - 1) return true;
    return nodes[index + 1]?.type !== 'conditionNode';
  };

  // Check if a node is the first in an action group
  const isFirstActionInGroup = (index: number) => {
    if (nodes[index]?.type !== 'actionNode') return false;
    if (index === 0) return true;
    return nodes[index - 1]?.type !== 'actionNode';
  };

  // Check if a node is the last in an action group
  const isLastActionInGroup = (index: number) => {
    if (nodes[index]?.type !== 'actionNode') return false;
    if (index === nodes.length - 1) return true;
    return nodes[index + 1]?.type !== 'actionNode';
  };

  // Count nodes in condition group
  const getConditionGroupCount = (startIndex: number) => {
    let count = 0;
    for (let i = startIndex; i < nodes.length; i++) {
      if (nodes[i].type === 'conditionNode') count++;
      else break;
    }
    return count;
  };

  // Count nodes in action group
  const getActionGroupCount = (startIndex: number) => {
    let count = 0;
    for (let i = startIndex; i < nodes.length; i++) {
      if (nodes[i].type === 'actionNode') count++;
      else break;
    }
    return count;
  };

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col overflow-hidden">
      {/* Validation Messages */}
      {(hasMultipleTriggers || needsTrigger || needsAction) && (
        <div className="border-b border-slate-800 bg-slate-900/50 px-6 py-3 space-y-2">
          {hasMultipleTriggers && (
            <div className="flex items-center gap-2 text-amber-400 text-sm">
              <AlertCircle size={16} />
              <span className="font-medium">Only one trigger is allowed per automation</span>
            </div>
          )}
          {needsTrigger && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle size={16} />
              <span className="font-medium">Trigger is required - Add a trigger to start your automation</span>
            </div>
          )}
          {needsAction && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle size={16} />
              <span className="font-medium">At least one action is required</span>
            </div>
          )}
        </div>
      )}

      {/* Info Banner */}
      {nodes.length === 0 && (
        <div className="border-b border-slate-800 bg-primary/5 px-6 py-3">
          <div className="flex items-start gap-2.5 text-xs text-slate-300">
            <Play size={14} className="text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-white mb-1">Workflow Rules:</p>
              <ul className="space-y-0.5 text-slate-400 mb-2">
                <li>• <strong className="text-slate-300">1 Trigger (Required)</strong> - What starts your automation</li>
                <li>• <strong className="text-slate-300">Conditions (Optional)</strong> - Add logic to control when actions run</li>
                <li>• <strong className="text-slate-300">Actions (Required)</strong> - What happens when triggered</li>
              </ul>
              <div className="flex items-center gap-1.5 text-amber-400 mt-2 pt-2 border-t border-slate-700/50">
                <ArrowDown size={12} />
                <span className="text-[11px] font-medium">Workflows run sequentially from top to bottom</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto pb-20">
          {/* Workflow Path Visualization */}
          <div className="relative">
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="workflow-steps">
                {(provided) => (
                  <div 
                    {...provided.droppableProps} 
                    ref={provided.innerRef}
                    className="space-y-0"
                  >
                    {nodes.length === 0 && (
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 blur-3xl" />
                        <div className="relative border-2 border-dashed border-slate-800 rounded-xl p-12 text-center backdrop-blur-sm bg-slate-900/30">
                          <div className="h-16 w-16 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/10">
                            <Zap size={28} className="text-primary" />
                          </div>
                          <h3 className="text-white font-bold text-lg mb-2">Build Your Automation</h3>
                          <p className="text-slate-400 text-sm mb-1">Drag a trigger from the sidebar to begin</p>
                          <p className="text-slate-500 text-xs">Then add conditions and actions to complete your workflow</p>
                        </div>
                      </div>
                    )}
                    
                    {nodes.map((node, index) => {
                      const Icon = getIcon(node.type || '', node.data.config?.triggerType || node.data.config?.actionType || node.data.config?.conditionType);
                      const colorClass = getColorClass(node.type || '', node.data.config?.triggerType || node.data.config?.actionType || node.data.config?.conditionType);
                      const typeLabel = getNodeTypeLabel(node);
                      const typeBadgeClass = getNodeTypeBadgeClass(node);
                      const isCondition = node.type === 'conditionNode';
                      const isAction = node.type === 'actionNode';
                      const isFirstCondition = isFirstConditionInGroup(index);
                      const isLastCondition = isLastConditionInGroup(index);
                      const isFirstAction = isFirstActionInGroup(index);
                      const isLastAction = isLastActionInGroup(index);
                      const conditionCount = isFirstCondition ? getConditionGroupCount(index) : 0;
                      const actionCount = isFirstAction ? getActionGroupCount(index) : 0;

                      return (
                        <React.Fragment key={node.id}>
                          {/* Conditional Logic Block Header */}
                          {isFirstCondition && (
                            <div className="mb-4">
                              <div className="flex items-center justify-center mb-3">
                                <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg shadow-lg shadow-blue-500/5">
                                  <GitBranch size={16} className="text-blue-400" />
                                  <span className="text-sm font-bold text-blue-400">
                                    Conditional Logic Block
                                  </span>
                                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                                    {conditionCount} condition{conditionCount > 1 ? 's' : ''}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Actions Block Header */}
                          {isFirstAction && (
                            <div className="mb-4">
                              <div className="flex items-center justify-center mb-3">
                                <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg shadow-lg shadow-green-500/5">
                                  <Zap size={16} className="text-green-400" />
                                  <span className="text-sm font-bold text-green-400">
                                    Actions Block
                                  </span>
                                  <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">
                                    {actionCount} action{actionCount > 1 ? 's' : ''}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Connection Line before node */}
                          {index > 0 && !isFirstCondition && !isFirstAction && (
                            <div className="flex justify-center">
                              <div className="w-0.5 h-4 bg-slate-700/50" />
                            </div>
                          )}

                        <Draggable draggableId={node.id} index={index}>
                          {(provided, snapshot) => (
                            <div className="relative">
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`transition-all duration-200 ${snapshot.isDragging ? 'scale-105 z-50' : ''}`}
                              >
                                <div className={`
                                  relative group
                                  ${snapshot.isDragging ? 'shadow-2xl shadow-primary/20' : ''}
                                `}>
                                  {/* Glow effect on hover */}
                                  <div className={`absolute -inset-0.5 bg-gradient-to-r from-primary/0 via-primary/20 to-primary/0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity blur-sm`} />
                                  
                                  <div className={`
                                    relative flex items-center gap-3 p-3.5 rounded-lg backdrop-blur-xl transition-all cursor-pointer
                                    ${snapshot.isDragging 
                                      ? 'bg-slate-800/90 border-2 border-primary shadow-xl' 
                                      : 'bg-slate-900/60 border-2 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80'
                                    }
                                  `} onClick={() => setSelectedNodeId(node.id)}>
                                    {/* Drag Handle */}
                                    <div 
                                      {...provided.dragHandleProps} 
                                      className="flex items-center justify-center w-6 h-10 text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing rounded hover:bg-slate-800/50 transition-colors" 
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <GripVertical size={18} />
                                    </div>

                                    {/* Node Icon */}
                                    <div className={`h-11 w-11 rounded-lg ${colorClass} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                                      <Icon size={22} />
                                    </div>

                                    {/* Node Content */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-0.5">
                                        <Badge variant="outline" className={`text-[9px] font-bold px-1.5 py-0.5 ${typeBadgeClass} border`}>
                                          {typeLabel}
                                        </Badge>
                                        <span className="text-slate-600 text-[10px]">#{index + 1}</span>
                                      </div>
                                      <h4 className="text-sm font-bold text-white mb-0.5 truncate">
                                        {node.data.label}
                                      </h4>
                                      {node.data.description && (
                                        <p className="text-xs text-slate-400 truncate">
                                          {node.data.description}
                                        </p>
                                      )}
                                      
                                      {/* Configuration Preview */}
                                      {node.data.config && Object.keys(node.data.config).length > 1 && (
                                        <div className="flex items-center gap-1 mt-1.5">
                                          <CheckCircle2 size={11} className="text-green-500" />
                                          <span className="text-[10px] text-slate-500">Configured</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-700" 
                                        onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); }}
                                      >
                                        <Settings2 size={16} />
                                      </Button>
                                      <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-500/10" 
                                        onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
                                      >
                                        <Trash2 size={16} />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>

                        {/* Connection between blocks */}
                        {(isLastCondition || isLastAction || (!isCondition && !isAction)) && index < nodes.length - 1 && (
                          <div className="flex justify-center my-4">
                            <div className="w-0.5 h-6 bg-gradient-to-b from-slate-600 to-slate-700 relative">
                              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-600 rounded-full" />
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
          
          {/* Workflow Summary */}
          {nodes.length > 0 && (
            <div className="flex justify-center mt-8 mb-6">
               <div className="flex items-center gap-2.5 py-2.5 px-5 rounded-lg bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/30 shadow-lg shadow-emerald-500/5">
                  <CheckCircle2 size={18} className="text-emerald-400" />
                  <div>
                    <span className="text-sm font-bold text-emerald-400">{nodes.length} Step{nodes.length > 1 ? 's' : ''}</span>
                    <p className="text-[10px] text-emerald-500/70 mt-0.5">
                      {nodes.filter(n => n.type === 'triggerNode').length} Trigger • 
                      {nodes.filter(n => n.type === 'conditionNode').length} Condition • 
                      {nodes.filter(n => n.type === 'actionNode').length} Action
                    </p>
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
