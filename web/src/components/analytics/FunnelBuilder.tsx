'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SheetHeader, SheetFooter, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Plus, Trash2, GripVertical, Save, X, Target } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { FunnelStep, Funnel } from '@/features/funnels/queries';

interface FunnelBuilderProps {
  websiteId: string;
  existingFunnel?: Funnel;
  onSave: (funnelData: Omit<Funnel, 'id' | 'website_id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
}

const autoName = (step: FunnelStep) => {
  if (step.type === 'event') return step.condition.event?.trim() || 'Event';
  const path = (step.type === 'page' ? step.condition.page : step.condition.custom)?.trim() || '';
  return path === '/' ? 'Home page' : path || 'Step';
};

export function FunnelBuilder({ websiteId, existingFunnel, onSave, onCancel }: FunnelBuilderProps) {
  const [name, setName] = useState(existingFunnel?.name || '');
  const [description, setDescription] = useState(existingFunnel?.description || '');
  // Hours a visitor may take between one step and the next; empty is no limit.
  const [windowHours, setWindowHours] = useState<string>(
    existingFunnel?.conversion_window_hours ? String(existingFunnel.conversion_window_hours) : 'none',
  );
  const [steps, setSteps] = useState<FunnelStep[]>(
    existingFunnel?.steps || [
      {
        id: 'step-1',
        // Named from its path when saved ("Home page" for "/"), so changing the path renames it too.
        name: '',
        type: 'page',
        condition: { page: '/' },
        order: 1,
        matchType: 'exact' as const,
      }
    ]
  );

  const addStep = useCallback(() => {
    const newStep: FunnelStep = {
      id: `step-${Date.now()}`,
      name: '',
      type: 'page',
      condition: {},
      order: steps.length + 1
    };
    setSteps(prevSteps => [...prevSteps, newStep]);
  }, [steps.length]);

  const updateStep = useCallback((stepId: string, updates: Partial<FunnelStep>) => {
    setSteps(prevSteps => prevSteps.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ));
  }, []);

  const removeStep = useCallback((stepId: string) => {
    setSteps(prevSteps => prevSteps.filter(step => step.id !== stepId));
  }, []);

  const handleDragEnd = useCallback((result: any) => {
    if (!result.destination) return;

    setSteps(prevSteps => {
      const newSteps = Array.from(prevSteps);
      const [reorderedStep] = newSteps.splice(result.source.index, 1);
      newSteps.splice(result.destination.index, 0, reorderedStep);

      // Update order numbers
      return newSteps.map((step, index) => ({
        ...step,
        order: index + 1
      }));
    });
  }, []);

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      toast.error('Give the funnel a name');
      return;
    }

    if (steps.length < 2) {
      toast.error('A funnel needs at least 2 steps');
      return;
    }

    const hasEmptySteps = steps.some(step => 
      (step.type === 'page' && (!step.condition.page || step.condition.page.trim() === '')) ||
      (step.type === 'event' && (!step.condition.event || step.condition.event.trim() === '')) ||
      (step.type === 'custom' && (!step.condition.custom || step.condition.custom.trim() === ''))
    );

    if (hasEmptySteps) {
      toast.error('Fill in every step before saving');
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      steps: steps.map((step, i) => ({ ...step, order: i + 1, name: step.name.trim() || autoName(step) })),
      is_active: existingFunnel?.is_active ?? true,
      conversion_window_hours: windowHours === 'none' ? null : Number(windowHours),
    });
  }, [name, description, steps, windowHours, onSave, existingFunnel?.is_active]);

  const getStepColor = (index: number) => {
    const colors = ['bg-indigo-500', 'bg-indigo-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];
    return colors[index % colors.length];
  };

  return (
    <>
      <SheetHeader className="bg-card">
        <SheetTitle className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          {existingFunnel ? 'Edit funnel' : 'New funnel'}
        </SheetTitle>
        <SheetDescription>
          Define the steps a visitor takes and see where they drop off.
        </SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto bg-muted/40 px-4 py-4 space-y-3">
        {/* Basic Information */}
        <div className="space-y-3 rounded-lg border bg-card p-3.5 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_9rem]">
            <div>
              <Label htmlFor="funnel-name" className="text-xs">Name</Label>
              <Input
                id="funnel-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Checkout conversion"
                className="mt-1 h-8 !bg-card text-xs"
              />
            </div>
            <div>
              <Label htmlFor="funnel-window" className="text-xs">Step window</Label>
              <Select value={windowHours} onValueChange={setWindowHours}>
                <SelectTrigger id="funnel-window" className="mt-1 h-8 !bg-card text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No limit</SelectItem>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="24">1 day</SelectItem>
                  <SelectItem value="72">3 days</SelectItem>
                  <SelectItem value="168">7 days</SelectItem>
                  <SelectItem value="720">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="funnel-description" className="text-xs">Description (optional)</Label>
            <Textarea
              id="funnel-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this funnel tracks"
              rows={2}
              className="mt-1 min-h-0 resize-none !bg-card text-xs"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            A visitor counts at the next step only if they reach it within the step window of the step before.
          </p>
        </div>

        {/* Funnel Steps */}
        <div className="space-y-3 rounded-lg border bg-card p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Steps</h3>
            <Button onClick={addStep} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Step
            </Button>
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="funnel-steps">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-2"
                >
                  {steps.map((step, index) => (
                    <Draggable key={step.id} draggableId={step.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`flex items-start gap-2 rounded-md border bg-muted/30 p-2 ${
                            snapshot.isDragging ? 'shadow-lg bg-card' : ''
                          }`}
                        >
                          <div
                            {...provided.dragHandleProps}
                            className="mt-1.5 text-muted-foreground hover:text-foreground cursor-grab"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </div>
                          <div className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${getStepColor(index)} text-[11px] font-medium text-white`}>
                            {index + 1}
                          </div>

                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex gap-2">
                              {step.type !== 'custom' && (
                                <div className="flex h-8 shrink-0 rounded-md border bg-card p-0.5 text-xs">
                                  {(['page', 'event'] as const).map((t) => (
                                    <button
                                      key={t}
                                      type="button"
                                      onClick={() => step.type !== t && updateStep(step.id, { type: t, condition: {} })}
                                      className={`rounded px-2.5 font-medium transition-colors ${
                                        step.type === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                                      }`}
                                    >
                                      {t === 'page' ? 'Page' : 'Event'}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <Input
                                value={
                                  step.type === 'page' ? step.condition.page || '' :
                                  step.type === 'event' ? step.condition.event || '' :
                                  step.condition.custom || ''
                                }
                                onChange={(e) => {
                                  const newCondition = { ...step.condition };
                                  if (step.type === 'page') newCondition.page = e.target.value;
                                  else if (step.type === 'event') newCondition.event = e.target.value;
                                  else newCondition.custom = e.target.value;
                                  updateStep(step.id, { condition: newCondition });
                                }}
                                placeholder={
                                  step.type === 'page' ? '/pricing' :
                                  step.type === 'event' ? 'signup_completed' :
                                  'Custom condition'
                                }
                                aria-label="Page path or event name"
                                className="h-8 min-w-0 flex-1 !bg-card text-xs"
                              />
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {step.type === 'page' ? (
                                <>
                                  Visitor views a page that{' '}
                                  <select
                                    value={step.matchType || 'exact'}
                                    onChange={(e) => updateStep(step.id, { matchType: e.target.value as FunnelStep['matchType'] })}
                                    className="cursor-pointer rounded bg-transparent font-medium text-foreground underline decoration-dotted underline-offset-2 outline-none"
                                  >
                                    <option value="exact">is exactly this path</option>
                                    <option value="starts_with">starts with this path</option>
                                    <option value="contains">contains this text</option>
                                    <option value="regex">matches this regex</option>
                                  </select>
                                </>
                              ) : step.type === 'event' ? (
                                'Visitor triggers this custom event'
                              ) : (
                                'Custom condition'
                              )}
                            </p>
                          </div>

                          {steps.length > 1 && (
                            <Button
                              onClick={() => removeStep(step.id)}
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                              aria-label="Remove step"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>

      </div>
      <SheetFooter className="bg-card pr-20">
        <Button onClick={onCancel} variant="outline" size="sm">
          <X className="w-4 h-4 mr-1.5" />
          Cancel
        </Button>
        <Button onClick={handleSave} size="sm">
          <Save className="w-4 h-4 mr-1.5" />
          {existingFunnel ? 'Update funnel' : 'Create funnel'}
        </Button>
      </SheetFooter>
    </>
  );
}
