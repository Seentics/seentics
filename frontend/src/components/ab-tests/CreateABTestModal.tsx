'use client';

import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Plus, Trash2, HelpCircle } from 'lucide-react';
import { createABTest, ABVariant, ABTest } from '@/lib/ab-tests-api';
import { useToast } from '@/hooks/use-toast';

interface CreateABTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  websiteId: string;
}

export function CreateABTestModal({ isOpen, onClose, onSuccess, websiteId }: CreateABTestModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goalType, setGoalType] = useState('pageview');
  const [goalValue, setGoalValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [variants, setVariants] = useState<ABVariant[]>([
    { name: 'Control', weight: 50 },
    { name: 'Variant A', weight: 50 }
  ]);

  const addVariant = () => {
    setVariants([...variants, { name: `Variant ${String.fromCharCode(65 + variants.length - 1)}`, weight: 0 }]);
  };

  const removeVariant = (idx: number) => {
    if (variants.length <= 2) return;
    setVariants(variants.filter((_, i) => i !== idx));
  };

  const updateVariant = (idx: number, field: keyof ABVariant, value: any) => {
    const newVariants = [...variants];
    newVariants[idx] = { ...newVariants[idx], [field]: value };
    setVariants(newVariants);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate weights total 100
    const totalWeight = variants.reduce((sum, v) => sum + Number(v.weight), 0);
    if (totalWeight !== 100) {
      toast({ 
        title: 'Invalid weights', 
        description: `Total weight must be exactly 100%. Current total: ${totalWeight}%`, 
        variant: 'destructive' 
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const test: ABTest = {
        website_id: websiteId,
        name,
        description,
        status: 'draft',
        goal_event_type: goalType === 'event' ? goalValue : undefined,
        goal_path: goalType === 'pageview' ? goalValue : undefined,
      };

      await createABTest(websiteId, test, variants);
      toast({ title: 'Experiment created', description: 'Your A/B test has been saved as a draft.' });
      onSuccess();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create experiment', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New A/B Experiment</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Experiment Name</Label>
              <Input 
                id="name" 
                placeholder="e.g., Homepage Hero Test" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea 
                id="description" 
                placeholder="What are you testing?" 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Conversion Goal</Label>
                <Select value={goalType} onValueChange={setGoalType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pageview">Page Visit</SelectItem>
                    <SelectItem value="event">Custom Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{goalType === 'pageview' ? 'Page Path' : 'Event Name'}</Label>
                <Input 
                  placeholder={goalType === 'pageview' ? '/pricing' : 'purchase'} 
                  value={goalValue} 
                  onChange={(e) => setGoalValue(e.target.value)} 
                  required 
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Variants & Traffic Split</Label>
              <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                <Plus className="h-4 w-4 mr-1" /> Add Variant
              </Button>
            </div>
            
            <div className="space-y-3">
              {variants.map((v, idx) => (
                <div key={idx} className="flex gap-4 items-end bg-muted/30 p-3 rounded border">
                  <div className="flex-1 grid gap-2">
                    <Label className="text-[10px] uppercase text-muted-foreground">Name</Label>
                    <Input 
                      value={v.name} 
                      onChange={(e) => updateVariant(idx, 'name', e.target.value)} 
                      placeholder={`Variant ${idx}`}
                    />
                  </div>
                  <div className="w-24 grid gap-2">
                    <Label className="text-[10px] uppercase text-muted-foreground">Weight %</Label>
                    <Input 
                      type="number" 
                      value={v.weight} 
                      onChange={(e) => updateVariant(idx, 'weight', e.target.value)} 
                      min="0" 
                      max="100"
                    />
                  </div>
                  {variants.length > 2 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive h-10 w-10" 
                      onClick={() => removeVariant(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground flex items-center">
              <HelpCircle className="h-3 w-3 mr-1" />
              Total weight must equal 100%. Determine how many visitors see each variant.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Experiment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
