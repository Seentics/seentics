'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, GripVertical, Save, X, Target, MousePointer, Activity } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { FunnelStep, Funnel } from '@/lib/analytics-api';

interface FunnelBuilderProps {
  websiteId: string;
  existingFunnel?: Funnel;
  onSave: (funnelData: Omit<Funnel, 'id' | 'website_id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
}

export function FunnelBuilder({ websiteId, existingFunnel, onSave, onCancel }: FunnelBuilderProps) {
  const [name, setName] = useState(existingFunnel?.name || '');
  const [description, setDescription] = useState(existingFunnel?.description || '');
  const [steps, setSteps] = useState<FunnelStep[]>(
    existingFunnel?.steps || [
      {
        id: 'step-1',
        name: 'Landing Page',
        type: 'page',
        condition: { page: '/' },
        order: 1
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
      alert('Please enter a funnel name');
      return;
    }

    if (steps.length < 2) {
      alert('A funnel must have at least 2 steps');
      return;
    }

    const hasEmptySteps = steps.some(step => 
      !step.name.trim() || 
      (step.type === 'page' && (!step.condition.page || step.condition.page.trim() === '')) ||
      (step.type === 'event' && (!step.condition.event || step.condition.event.trim() === '')) ||
      (step.type === 'custom' && (!step.condition.custom || step.condition.custom.trim() === ''))
    );

    if (hasEmptySteps) {
      alert('Please fill in all step details');
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      steps,
      is_active: true
    });
  }, [name, description, steps, onSave]);

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'page': return <MousePointer className="w-4 h-4" />;
      case 'event': return <Activity className="w-4 h-4" />;
      case 'custom': return <Target className="w-4 h-4" />;
      default: return <MousePointer className="w-4 h-4" />;
    }
  };

  const getStepColor = (index: number) => {
    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];
    return colors[index % colors.length];
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5" />
          {existingFunnel ? 'Edit Funnel' : 'Create New Funnel'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="funnel-name">Funnel Name</Label>
            <Input
              id="funnel-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., E-commerce Conversion, Lead Generation"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="funnel-description">Description (Optional)</Label>
            <Textarea
              id="funnel-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this funnel tracks..."
              className="mt-1"
            />
          </div>
        </div>

        {/* Funnel Steps */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Funnel Steps</h3>
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
                  className="space-y-3"
                >
                  {steps.map((step, index) => (
                    <Draggable key={step.id} draggableId={step.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`p-4 border rounded bg-card ${
                            snapshot.isDragging ? 'shadow-lg' : ''
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            {/* Drag Handle */}
                            <div
                              {...provided.dragHandleProps}
                              className="text-muted-foreground hover:text-foreground cursor-grab"
                            >
                              <GripVertical className="w-4 h-4" />
                            </div>

                            {/* Step Number */}
                            <div className={`w-8 h-8 rounded-full ${getStepColor(index)} text-white text-sm font-medium flex items-center justify-center`}>
                              {index + 1}
                            </div>

                            {/* Step Configuration */}
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* Step Name */}
                              <div>
                                <Label className="text-xs">Step Name</Label>
                                <Input
                                  value={step.name}
                                  onChange={(e) => updateStep(step.id, { name: e.target.value })}
                                  placeholder="e.g., Landing Page"
                                  className="h-8"
                                />
                              </div>

                              {/* Step Type */}
                              <div>
                                <Label className="text-xs">Type</Label>
                                <Select
                                  value={step.type}
                                  onValueChange={(value: 'page' | 'event' | 'custom') => 
                                    updateStep(step.id, { type: value, condition: {} })
                                  }
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="page">Page Visit</SelectItem>
                                    <SelectItem value="event">Event</SelectItem>
                                    <SelectItem value="custom">Custom</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Condition */}
                              <div>
                                <Label className="text-xs">
                                  {step.type === 'page' ? 'Page URL' : 
                                   step.type === 'event' ? 'Event Name' : 'Custom Condition'}
                                </Label>
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
                                    step.type === 'page' ? '/product/*' :
                                    step.type === 'event' ? 'add_to_cart' :
                                    'custom_condition'
                                  }
                                  className="h-8"
                                />
                              </div>
                            </div>

                            {/* Step Icon & Remove */}
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {getStepIcon(step.type)}
                                <span className="ml-1">{step.type}</span>
                              </Badge>
                              {steps.length > 1 && (
                                <Button
                                  onClick={() => removeStep(step.id)}
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Step Connection Arrow */}
                          {index < steps.length - 1 && (
                            <div className="flex justify-center mt-2">
                              <div className="w-px h-4 bg-border"></div>
                              <div className="absolute w-2 h-2 bg-border rounded-full -mt-1"></div>
                            </div>
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

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button onClick={onCancel} variant="outline">
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            {existingFunnel ? 'Update Funnel' : 'Create Funnel'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
