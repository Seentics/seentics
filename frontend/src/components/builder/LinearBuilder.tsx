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
  Play
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

  const handleAddStep = () => {
    // Open a modal or sidebar tab to add a step
  };

  return (
    <div className="flex-1 bg-transparent p-8 overflow-y-auto">
      <div className="max-w-3xl mx-auto space-y-6 pb-20">
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="workflow-steps">
            {(provided) => (
              <div 
                {...provided.droppableProps} 
                ref={provided.innerRef}
                className="space-y-4"
              >
                {nodes.length === 0 && (
                  <div className="border-2 border-dashed border-slate-800 rounded-2xl p-20 text-center space-y-4">
                    <div className="h-16 w-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto text-slate-500 border border-slate-800">
                      <Plus size={32} />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg">Start building your automation</h3>
                      <p className="text-slate-500 text-sm">Drag a trigger from the sidebar to begin</p>
                    </div>
                  </div>
                )}
                
                {nodes.map((node, index) => {
                  const Icon = getIcon(node.type || '', node.data.config?.triggerType || node.data.config?.actionType || node.data.config?.conditionType);
                  const colorClass = getColorClass(node.type || '', node.data.config?.triggerType || node.data.config?.actionType || node.data.config?.conditionType);

                  return (
                    <Draggable key={node.id} draggableId={node.id} index={index}>
                      {(provided, snapshot) => (
                        <div className="relative group">
                          {/* Connector Line */}
                          {index < nodes.length - 1 && (
                            <div className="absolute left-[27px] top-full h-4 w-0.5 bg-slate-800 z-0" />
                          )}
                          
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`flex flex-col z-10`}
                          >
                            <div className={`
                              flex items-center gap-4 bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-4 rounded-xl transition-all cursor-pointer
                              ${snapshot.isDragging ? 'scale-105 shadow-2xl border-primary ring-2 ring-primary/20' : 'hover:border-slate-700 hover:bg-slate-900/80'}
                            `} onClick={() => setSelectedNodeId(node.id)}>
                              <div {...provided.dragHandleProps} className="text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing" onClick={(e) => e.stopPropagation()}>
                                <GripVertical size={20} />
                              </div>

                              <div className={`h-12 w-12 rounded-xl ${colorClass} border flex items-center justify-center flex-shrink-0 shadow-inner`}>
                                <Icon size={24} />
                              </div>

                              <div className="flex-1 min-w-0" onClick={() => setSelectedNodeId(node.id)}>
                                <div className="flex items-center gap-2 mb-0.5">
                                  <Badge variant="outline" className="text-[9px] uppercase tracking-tighter py-0 px-1.5 border-slate-800 bg-slate-800/50 text-slate-400 font-black">
                                    Step {index + 1}
                                  </Badge>
                                  <h4 className="text-[14px] font-extrabold text-white truncate leading-none">
                                    {node.data.label}
                                  </h4>
                                </div>
                                <p className="text-[11px] font-medium text-slate-500 truncate">
                                  {node.data.description || 'Action step configuration'}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-white" onClick={() => setSelectedNodeId(node.id)}>
                                  <Settings2 size={16} />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-red-500" onClick={() => deleteNode(node.id)}>
                                  <Trash2 size={16} />
                                </Button>
                              </div>
                            </div>
                            
                            {/* Step Arrow */}
                            {index < nodes.length - 1 && (
                              <div className="flex justify-start pl-7 py-1 text-slate-800">
                                <ArrowDown size={14} />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        
        {nodes.length > 0 && (
          <div className="flex justify-center pt-4">
             <div className="flex items-center gap-3 py-3 px-6 rounded-full bg-emerald-500/5 border border-emerald-500/10 text-emerald-500">
                <CheckCircle2 size={18} />
                <span className="text-xs font-black uppercase tracking-widest">Workflow Ready</span>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
