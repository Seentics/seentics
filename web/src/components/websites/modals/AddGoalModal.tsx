'use client';

import React, { useState, useEffect } from 'react';
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
import { addGoal, updateGoal, type Goal } from '@/lib/websites-api';
import { analyticsKeys } from '@/lib/analytics-api';
import { toast } from 'sonner';
import { Loader2, Check, Copy, Code } from 'lucide-react';

interface AddGoalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websiteId: string;
  /** When set, the modal edits this goal instead of creating a new one. */
  editingGoal?: Goal | null;
}

export function AddGoalModal({ open, onOpenChange, websiteId, editingGoal = null }: AddGoalModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'event' | 'pageview'>('event');
  const [identifier, setIdentifier] = useState('');
  const [selector, setSelector] = useState('');
  const [showHelper, setShowHelper] = useState(false);
  const [createdGoal, setCreatedGoal] = useState<{ type: string; identifier: string; selector?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();
  const isEdit = !!editingGoal?.id;

  useEffect(() => {
    if (!open) return;
    if (editingGoal) {
      setName(editingGoal.name ?? '');
      setType(editingGoal.type === 'pageview' ? 'pageview' : 'event');
      setIdentifier(editingGoal.identifier ?? '');
      setSelector(typeof editingGoal.selector === 'string' ? editingGoal.selector : '');
      setCreatedGoal(null);
      setShowHelper(false);
    } else {
      setName('');
      setIdentifier('');
      setSelector('');
      setType('event');
      setCreatedGoal(null);
      setShowHelper(false);
    }
  }, [open, editingGoal?.id]);

  const resetForm = () => {
    setName('');
    setIdentifier('');
    setSelector('');
    setCreatedGoal(null);
    setShowHelper(false);
    setCopied(false);
  };

  const mutation = useMutation({
    mutationFn: (data: { name: string; type: string; identifier: string; selector?: string }) =>
      addGoal(websiteId, data),
    onSuccess: (_data, variables) => {
      toast.success('Goal created successfully');
      queryClient.invalidateQueries({ queryKey: ['goals', websiteId] });
      queryClient.invalidateQueries({ queryKey: [...analyticsKeys.all, 'goal-stats', websiteId] });
      setCreatedGoal({ type: variables.type, identifier: variables.identifier, selector: variables.selector });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create goal');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { name: string; type: string; identifier: string; selector?: string }) =>
      updateGoal(websiteId, editingGoal!.id, data),
    onSuccess: () => {
      toast.success('Goal updated');
      queryClient.invalidateQueries({ queryKey: ['goals', websiteId] });
      queryClient.invalidateQueries({ queryKey: [...analyticsKeys.all, 'goal-stats', websiteId] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update goal');
    },
  });

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const copySnippet = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !identifier.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    const payload = { name, type, identifier, selector: selector.trim() || undefined };
    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      mutation.mutate(payload);
    }
  };

  const pending = mutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <DialogContent className="sm:max-w-[460px]">
        {createdGoal && !isEdit ? (
          <div className="space-y-4">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Check className="h-4 w-4 text-emerald-500" />
                </div>
                <DialogTitle>Goal Created</DialogTitle>
              </div>
              <DialogDescription>
                {createdGoal.type === 'pageview'
                  ? 'This goal will automatically track visits to the specified page. No code changes needed.'
                  : createdGoal.selector
                    ? 'Clicks on the target element will be auto-tracked. No code changes needed.'
                    : 'To start tracking conversions, trigger this event from your site.'}
              </DialogDescription>
            </DialogHeader>

            {createdGoal.type === 'event' && !createdGoal.selector && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Code className="h-3.5 w-3.5" />
                  Add this to your site where the action happens:
                </div>
                <div className="relative group">
                  <pre className="bg-muted/50 border border-border rounded-lg p-4 text-sm font-mono text-foreground overflow-x-auto">
                    <code>{`seentics.track('${createdGoal.identifier}')`}</code>
                  </pre>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => copySnippet(`seentics.track('${createdGoal.identifier}')`)}
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  You can also pass properties: <code className="bg-muted px-1 rounded-lg text-[10px]">{`seentics.track('${createdGoal.identifier}', { value: 99 })`}</code>
                </p>
              </div>
            )}

            {createdGoal.type === 'event' && createdGoal.selector && (
              <div className="bg-muted/30 border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  The tracker script will automatically fire <code className="bg-muted px-1 rounded-lg font-bold">{createdGoal.identifier}</code> when a user clicks on <code className="bg-muted px-1 rounded-lg font-bold">{createdGoal.selector}</code>.
                </p>
              </div>
            )}

            {createdGoal.type === 'pageview' && (
              <div className="bg-muted/30 border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  Conversions will be counted each time a visitor views <code className="bg-muted px-1 rounded-lg font-bold">{createdGoal.identifier}</code>. No code changes required.
                </p>
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => resetForm()} variant="outline">
                Create Another
              </Button>
              <Button onClick={handleClose}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit goal' : 'Create New Goal'}</DialogTitle>
            <DialogDescription>
              {isEdit ? 'Update how this goal is tracked.' : 'Define a goal to track specific actions or page visits.'}
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
                if (!isEdit) setIdentifier('');
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
                <div className="mt-2 p-3 bg-primary/5 rounded-lg border border-primary/10 text-[11px] font-medium leading-relaxed text-muted-foreground animate-in fade-in slide-in-from-top-1">
                  {type === 'event' ? (
                    <ul className="list-disc pl-4 space-y-1">
                      <li><strong>Event Name:</strong> The name that will appear in your reports.</li>
                      <li><strong>Selector:</strong> Provide a CSS selector (e.g. <code className="bg-primary/10 px-1 rounded-lg text-primary">#submit-btn</code> or <code className="bg-primary/10 px-1 rounded-lg text-primary">.buy-now</code>) to auto-track it.</li>
                      <li><strong>Predefined:</strong> Use <code className="bg-primary/10 px-1 rounded-lg text-primary">form_submission</code> for all forms.</li>
                    </ul>
                  ) : (
                    <p>Enter the exact URL path. For example, to track users who reach your success page, use <code className="bg-primary/10 px-1 rounded-lg text-primary">/signup-complete</code>.</p>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEdit ? 'Save changes' : 'Create Goal'}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
