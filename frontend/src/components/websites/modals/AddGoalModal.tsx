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
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: { name: string; type: string; identifier: string }) =>
      addGoal(websiteId, data),
    onSuccess: () => {
      toast.success('Goal created successfully');
      queryClient.invalidateQueries({ queryKey: ['goals', websiteId] });
      onOpenChange(false);
      setName('');
      setIdentifier('');
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
    mutation.mutate({ name, type, identifier });
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
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="event">Custom Event</SelectItem>
                  <SelectItem value="pageview">Page Visit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="identifier">
                {type === 'event' ? 'Event Name' : 'Page Path'}
              </Label>
              <Input
                id="identifier"
                placeholder={type === 'event' ? 'e.g., button_click' : 'e.g., /pricing'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
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
