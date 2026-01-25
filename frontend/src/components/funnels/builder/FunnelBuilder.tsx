'use client';

import React, { useState } from 'react';
import { FunnelToolbar } from './FunnelToolbar';
import { StepItem } from './StepItem';
import { ConditionItem } from './ConditionItem';
import { PlusCircle, GitBranch, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export const FunnelBuilder = () => {
  const [steps, setSteps] = useState<any[]>([
    { id: '1', type: 'pageView', name: 'Landing Page', value: '/home' }
  ]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/reactflow');
    const label = e.dataTransfer.getData('application/reactflow-label');

    if (type) {
       addStep(type, label);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const addStep = (type: string, name: string = 'New Step') => {
    const newStep = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      name,
      value: ''
    };
    setSteps([...steps, newStep]);
  };

  const addCondition = () => {
    const newCondition = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'condition',
      name: 'Check Requirement'
    };
    setSteps([...steps, newCondition]);
  };

  const updateStep = (id: string, data: any) => {
    setSteps(steps.map(s => s.id === id ? { ...s, ...data } : s));
  };

  const deleteStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id));
  };

  return (
    <div className="fixed inset-0 z-[100] flex h-screen w-full bg-slate-50 dark:bg-slate-900 overflow-hidden flex-col">
      <FunnelToolbar />
      
      <div className="flex flex-1 overflow-hidden" onDrop={handleDrop} onDragOver={handleDragOver}>
        {/* Main Canvas Area */}
        <div className="flex-1 h-full relative overflow-hidden flex flex-col items-center bg-slate-50 dark:bg-slate-950">
            <ScrollArea className="w-full h-full">
                <div className="max-w-2xl mx-auto py-12 px-6 flex flex-col pb-40">
                    
                    {/* Start Indicator */}
                    <div className="mx-auto mb-8 flex flex-col items-center gap-2 text-muted-foreground/50">
                        <div className="h-3 w-3 rounded-full bg-current" />
                        <div className="h-8 w-[2px] bg-current" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Traffic Entry</p>
                    </div>

                    <div className="space-y-0">
                        {steps.map((step, index) => (
                            step.type === 'condition' ? (
                                <ConditionItem 
                                    key={step.id} 
                                    step={step} 
                                    onDelete={deleteStep} 
                                    onUpdate={updateStep} 
                                />
                            ) : (
                                <StepItem 
                                    key={step.id} 
                                    step={step} 
                                    index={steps.filter(s => s.type !== 'condition').indexOf(step)}
                                    onDelete={deleteStep} 
                                    onUpdate={updateStep} 
                                />
                            )
                        ))}
                    </div>

                    {/* Add Buttons */}
                    <div className="mt-8 flex flex-col items-center gap-4">
                        <div className="h-8 w-[2px] bg-border border-l border-dashed border-muted-foreground/30" />
                        <div className="flex items-center gap-3">
                            <Button variant="outline" className="h-10 rounded-xl px-6 font-bold text-xs gap-2 hover:bg-white dark:hover:bg-slate-900 shadow-sm" onClick={() => addStep('pageView', 'New Page Step')}>
                                <PlusCircle size={16} />
                                Add Step
                            </Button>
                            <Button variant="ghost" className="h-10 rounded-xl px-4 font-bold text-xs gap-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20" onClick={addCondition}>
                                <GitBranch size={16} />
                                Add Condition
                            </Button>
                        </div>
                    </div>

                </div>
            </ScrollArea>
        </div>

      </div>
    </div>
  );
};

export default FunnelBuilder;
