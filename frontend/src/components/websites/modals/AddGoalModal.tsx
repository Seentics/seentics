'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addGoal } from '@/lib/websites-api';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface AddGoalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websiteId: string;
}

export function AddGoalModal({ open, onOpenChange, websiteId }: AddGoalModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'event' | 'pageview'>('event');
  const [identifier, setIdentifier] = useState('');
  const [selector, setSelector] = useState('');
  const [showHelper, setShowHelper] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: { name: string; type: string; identifier: string; selector?: string }) =>
      addGoal(websiteId, data),
    onSuccess: () => {
      toast.success('Goal created successfully');
      queryClient.invalidateQueries({ queryKey: ['goals', websiteId] });
      onOpenChange(false);
      setName('');
      setIdentifier('');
      setSelector('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create goal');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !identifier.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    mutation.mutate({ name, type, identifier, selector: selector.trim() || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Goal</DialogTitle>
            <DialogDescription>
              Define a goal to track specific actions or page visits.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Goal Name</Label>
              <Input
                id="name"
                placeholder="e.g., Signup Success"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Goal Type</Label>
              <Select value={type} onValueChange={(v: any) => {
                setType(v);
                setIdentifier('');
              }}>
                <SelectTrigger id="type" className="h-11 font-bold">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="event" className="font-bold">Custom Event</SelectItem>
                  <SelectItem value="pageview" className="font-bold">Page Visit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="identifier">
                  {type === 'event' ? 'Event Name (ID)' : 'Target Page Path'}
                </Label>
                <button 
                  type="button" 
                  onClick={() => setShowHelper(!showHelper)}
                  className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                >
                  Need help?
                </button>
              </div>
              <Input
                id="identifier"
                placeholder={type === 'event' ? 'e.g., signup_click' : 'e.g., /thank-you'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="h-11 font-bold"
              />
              {type === 'event' && (
                <div className="mt-2 grid gap-2">
                  <Label htmlFor="selector" className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
                    Target Selector (ID or Class) - Optional
                  </Label>
                  <Input
                    id="selector"
                    placeholder="e.g., #form-id or .btn-cta"
                    value={selector}
                    onChange={(e) => setSelector(e.target.value)}
                    className="h-10 text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    If provided, the tracker will automatically listen for clicks on this element.
                  </p>
                </div>
              )}
              {showHelper && (
                <div className="mt-2 p-3 bg-primary/5 rounded border border-primary/10 text-[11px] font-medium leading-relaxed text-muted-foreground animate-in fade-in slide-in-from-top-1">
                  {type === 'event' ? (
                    <ul className="list-disc pl-4 space-y-1">
                      <li><strong>Event Name:</strong> The name that will appear in your reports.</li>
                      <li><strong>Selector:</strong> Provide a CSS selector (e.g. <code className="bg-primary/10 px-1 rounded text-primary">#submit-btn</code> or <code className="bg-primary/10 px-1 rounded text-primary">.buy-now</code>) to auto-track it.</li>
                      <li><strong>Predefined:</strong> Use <code className="bg-primary/10 px-1 rounded text-primary">form_submission</code> for all forms.</li>
                    </ul>
                  ) : (
                    <p>Enter the exact URL path. For example, to track users who reach your success page, use <code className="bg-primary/10 px-1 rounded text-primary">/signup-complete</code>.</p>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Goal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
