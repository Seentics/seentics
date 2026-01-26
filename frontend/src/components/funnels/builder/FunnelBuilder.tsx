'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { FunnelToolbar } from './FunnelToolbar';
import { StepItem } from './StepItem';
import { ConditionItem } from './ConditionItem';
import { PlusCircle, GitBranch, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFunnel, useCreateFunnel, useUpdateFunnel } from '@/lib/funnels-api';
import { useToast } from '@/hooks/use-toast';

export const FunnelBuilder = () => {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const websiteId = params?.websiteId as string;
  const funnelId = searchParams?.get('id');
  const { toast } = useToast();

  const { data: existingFunnel, isLoading: loadingFunnel } = useFunnel(websiteId, funnelId || '');
  const createFunnel = useCreateFunnel();
  const updateFunnel = useUpdateFunnel();

  const [name, setName] = useState('New Conversion Funnel');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<any[]>([
    { id: Math.random().toString(36).substr(2, 9), type: 'pageView', name: 'Landing Page', value: '/home' }
  ]);

  useEffect(() => {
    if (existingFunnel) {
      setName(existingFunnel.name);
      setDescription(existingFunnel.description);
      if (existingFunnel.steps) {
        setSteps(existingFunnel.steps.map(s => ({
          id: s.id || Math.random().toString(36).substr(2, 9),
          type: s.stepType === 'page_view' ? 'pageView' : 'event',
          name: s.name,
          value: s.stepType === 'page_view' ? s.pagePath : s.eventType,
          matchType: s.matchType || 'exact'
        })));
      }
    }
  }, [existingFunnel]);

  const handleSave = async () => {
    const funnelData = {
      name,
      description,
      steps: steps.map((s, index) => ({
        name: s.name,
        order: index,
        stepType: (s.type === 'pageView' ? 'page_view' : 'event') as 'page_view' | 'event',
        pagePath: s.type === 'pageView' ? s.value : undefined,
        eventType: s.type === 'event' ? s.value : undefined,
        matchType: (s.matchType || 'exact') as 'exact' | 'contains' | 'starts_with' | 'regex'
      }))
    };

    try {
      if (funnelId) {
        await updateFunnel.mutateAsync({ websiteId, funnelId, data: funnelData });
        toast({ title: "Funnel Updated", description: "Your changes have been saved." });
      } else {
        await createFunnel.mutateAsync({ websiteId, data: funnelData });
        toast({ title: "Funnel Created", description: "New funnel has been established." });
      }
      router.push(`/websites/${websiteId}/funnels`);
    } catch (error) {
      toast({ title: "Error", description: "Failed to save funnel.", variant: "destructive" });
    }
  };

  const addStep = (type: string, name: string = 'New Step') => {
    const newStep = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      name,
      value: '',
      matchType: 'exact'
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

  if (loadingFunnel && funnelId) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex h-screen w-full bg-slate-50 dark:bg-slate-900 overflow-hidden flex-col">
      <FunnelToolbar
        name={name}
        onNameChange={setName}
        onSave={handleSave}
        isSaving={createFunnel.isPending || updateFunnel.isPending}
        websiteId={websiteId}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 h-full relative overflow-hidden flex flex-col items-center bg-slate-50 dark:bg-slate-950">
          <ScrollArea className="w-full h-full">
            <div className="max-w-2xl mx-auto py-12 px-6 flex flex-col pb-40">
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
