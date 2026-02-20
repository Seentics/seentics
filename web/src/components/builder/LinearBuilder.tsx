'use client';

import React from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
  Trash2,
  Settings2,
  GripVertical,
  Zap,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  GitBranch,
} from 'lucide-react';
import { useAutomationStore } from '@/stores/automationStore';
import { Button } from '@/components/ui/button';
import {
  TRIGGER_TYPES,
  ACTION_TYPES,
  LOGIC_TYPES,
} from './EnhancedBuilderSidebar';

const getIcon = (type: string, subtype?: string) => {
  const all = [...TRIGGER_TYPES, ...ACTION_TYPES, ...LOGIC_TYPES];
  const item = all.find(i => i.type === type && (!subtype || (i as any).subtype === subtype));
  return item?.icon || Zap;
};

const getColorClass = (type: string, subtype?: string) => {
  const all = [...TRIGGER_TYPES, ...ACTION_TYPES, ...LOGIC_TYPES];
  const item = all.find(i => i.type === type && (!subtype || (i as any).subtype === subtype));

  const colorMap: Record<string, string> = {
    amber: 'bg-amber-500/10 text-amber-500',
    orange: 'bg-orange-500/10 text-orange-500',
    lime: 'bg-lime-500/10 text-lime-500',
    green: 'bg-green-500/10 text-green-500',
    yellow: 'bg-yellow-500/10 text-yellow-500',
    blue: 'bg-blue-500/10 text-blue-500',
    purple: 'bg-purple-500/10 text-purple-500',
    cyan: 'bg-cyan-500/10 text-cyan-500',
    pink: 'bg-pink-500/10 text-pink-500',
    rose: 'bg-rose-500/10 text-rose-500',
  };

  return colorMap[item?.color || 'blue'] || colorMap.blue;
};

const nodeTypeConfig: Record<string, { label: string; dotColor: string; badgeClass: string }> = {
  triggerNode: { label: 'TRIGGER', dotColor: 'bg-amber-500', badgeClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  conditionNode: { label: 'CONDITION', dotColor: 'bg-blue-500', badgeClass: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  actionNode: { label: 'ACTION', dotColor: 'bg-emerald-500', badgeClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
};

export const LinearBuilder = () => {
  const { nodes, setNodes, deleteNode, setSelectedNodeId } = useAutomationStore();

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(nodes);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setNodes(items);
  };

  const triggerCount = nodes.filter(n => n.type === 'triggerNode').length;
  const actionCount = nodes.filter(n => n.type === 'actionNode').length;
  const hasMultipleTriggers = triggerCount > 1;
  const needsTrigger = triggerCount === 0 && nodes.length > 0;
  const needsAction = actionCount === 0 && nodes.length > 0;

  // Group boundary helpers
  const isFirstInGroup = (index: number, type: string) => {
    if (nodes[index]?.type !== type) return false;
    return index === 0 || nodes[index - 1]?.type !== type;
  };

  const isLastInGroup = (index: number, type: string) => {
    if (nodes[index]?.type !== type) return false;
    return index === nodes.length - 1 || nodes[index + 1]?.type !== type;
  };

  const getGroupCount = (startIndex: number, type: string) => {
    let count = 0;
    for (let i = startIndex; i < nodes.length; i++) {
      if (nodes[i].type === type) count++;
      else break;
    }
    return count;
  };

  return (
    <div className="flex-1 bg-zinc-950 flex flex-col overflow-hidden">
      {/* Validation */}
      {(hasMultipleTriggers || needsTrigger || needsAction) && (
        <div className="border-b border-white/[0.06] bg-zinc-900/50 px-5 py-2.5 space-y-1.5">
          {hasMultipleTriggers && (
            <div className="flex items-center gap-2 text-amber-400 text-xs">
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="font-medium">Only one trigger is allowed per automation</span>
            </div>
          )}
          {needsTrigger && (
            <div className="flex items-center gap-2 text-rose-400 text-xs">
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="font-medium">Add a trigger to start your automation</span>
            </div>
          )}
          {needsAction && (
            <div className="flex items-center gap-2 text-rose-400 text-xs">
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="font-medium">At least one action is required</span>
            </div>
          )}
        </div>
      )}

      {/* Rules banner */}
      {nodes.length === 0 && (
        <div className="border-b border-white/[0.06] bg-white/[0.02] px-5 py-3">
          <div className="flex items-start gap-2.5 text-xs text-zinc-400">
            <ArrowDown className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-zinc-300 font-medium mb-1">Workflow runs top to bottom</p>
              <p>1 Trigger (required) → Conditions (optional) → Actions (required)</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="max-w-2xl mx-auto pb-20">
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="workflow-steps">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-0"
                >
                  {/* Empty state */}
                  {nodes.length === 0 && (
                    <div className="border border-dashed border-white/[0.08] rounded-lg p-10 text-center">
                      <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                        <Zap className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="text-sm font-semibold text-white mb-1">Build Your Automation</h3>
                      <p className="text-xs text-zinc-500">Drag a trigger from the sidebar to begin</p>
                    </div>
                  )}

                  {nodes.map((node, index) => {
                    const Icon = getIcon(node.type || '', node.data.config?.triggerType || node.data.config?.actionType || node.data.config?.conditionType);
                    const colorClass = getColorClass(node.type || '', node.data.config?.triggerType || node.data.config?.actionType || node.data.config?.conditionType);
                    const config = (node.type && nodeTypeConfig[node.type]) || { label: 'STEP', dotColor: 'bg-zinc-500', badgeClass: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20' };

                    const isCondition = node.type === 'conditionNode';
                    const isAction = node.type === 'actionNode';
                    const isFirstCondition = isFirstInGroup(index, 'conditionNode');
                    const isLastCondition = isLastInGroup(index, 'conditionNode');
                    const isFirstAction = isFirstInGroup(index, 'actionNode');
                    const isLastAction = isLastInGroup(index, 'actionNode');
                    const condGroupCount = isFirstCondition ? getGroupCount(index, 'conditionNode') : 0;
                    const actGroupCount = isFirstAction ? getGroupCount(index, 'actionNode') : 0;

                    return (
                      <React.Fragment key={node.id}>
                        {/* Condition group header */}
                        {isFirstCondition && (
                          <div className="flex items-center justify-center my-3">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-md">
                              <GitBranch className="h-3 w-3 text-blue-400" />
                              <span className="text-[11px] font-medium text-blue-400">
                                {condGroupCount} condition{condGroupCount > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Action group header */}
                        {isFirstAction && (
                          <div className="flex items-center justify-center my-3">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                              <Zap className="h-3 w-3 text-emerald-400" />
                              <span className="text-[11px] font-medium text-emerald-400">
                                {actGroupCount} action{actGroupCount > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Connector line */}
                        {index > 0 && !isFirstCondition && !isFirstAction && (
                          <div className="flex justify-center">
                            <div className="w-px h-3 bg-white/[0.08]" />
                          </div>
                        )}

                        <Draggable draggableId={node.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`transition-all duration-150 ${snapshot.isDragging ? 'scale-[1.02] z-50' : ''}`}
                            >
                              <div
                                className={`
                                  group relative flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all
                                  ${snapshot.isDragging
                                    ? 'bg-zinc-800 border border-primary/40 shadow-lg shadow-primary/10'
                                    : 'bg-zinc-900/40 border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04]'
                                  }
                                `}
                                onClick={() => setSelectedNodeId(node.id)}
                              >
                                {/* Drag handle */}
                                <div
                                  {...provided.dragHandleProps}
                                  className="flex items-center justify-center w-5 text-zinc-700 hover:text-zinc-400 cursor-grab active:cursor-grabbing"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <GripVertical className="h-4 w-4" />
                                </div>

                                {/* Icon */}
                                <div className={`h-9 w-9 rounded-md ${colorClass} flex items-center justify-center flex-shrink-0`}>
                                  <Icon className="h-4 w-4" />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className={`text-[9px] font-semibold px-1.5 py-px rounded border ${config.badgeClass}`}>
                                      {config.label}
                                    </span>
                                    <span className="text-zinc-600 text-[10px]">#{index + 1}</span>
                                  </div>
                                  <h4 className="text-sm font-medium text-white truncate">
                                    {node.data.label}
                                  </h4>
                                  {node.data.description && (
                                    <p className="text-[11px] text-zinc-500 truncate">{node.data.description}</p>
                                  )}
                                  {node.data.config && Object.keys(node.data.config).length > 1 && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                                      <span className="text-[10px] text-zinc-600">Configured</span>
                                    </div>
                                  )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-zinc-500 hover:text-white hover:bg-white/[0.06]"
                                    onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); }}
                                  >
                                    <Settings2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10"
                                    onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>

                        {/* Block-to-block connector */}
                        {(isLastCondition || isLastAction || (!isCondition && !isAction)) && index < nodes.length - 1 && (
                          <div className="flex justify-center my-3">
                            <div className="w-px h-5 bg-white/[0.08] relative">
                              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1.5 w-1.5 bg-zinc-700 rounded-full" />
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

          {/* Summary */}
          {nodes.length > 0 && (
            <div className="flex justify-center mt-6">
              <div className="flex items-center gap-2 py-1.5 px-3 rounded-md bg-white/[0.03] border border-white/[0.06]">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs font-medium text-zinc-400">
                  {nodes.length} step{nodes.length > 1 ? 's' : ''} — {triggerCount}T · {nodes.filter(n => n.type === 'conditionNode').length}C · {actionCount}A
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
