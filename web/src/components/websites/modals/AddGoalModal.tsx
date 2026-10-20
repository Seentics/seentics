'use client';

import React, { Fragment, useState, useEffect, type ReactNode } from 'react';
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
import { analyticsKeys } from '@/features/analytics/queries';
import { toast } from 'sonner';
import { Loader2, Check, Copy, Code } from 'lucide-react';
import { useT } from '@/lib/i18n';

/** A sentence with code in it, as the message builds it. */
const rich = (parts: ReactNode[]) => parts.map((part, i) => <Fragment key={i}>{part}</Fragment>);

interface AddGoalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websiteId: string;
  /** When set, the modal edits this goal instead of creating a new one. */
  editingGoal?: Goal | null;
}

export function AddGoalModal({ open, onOpenChange, websiteId, editingGoal = null }: AddGoalModalProps) {
  const all = useT();
  const t = all.dashboard.goal;
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
      toast.success(t.created);
      queryClient.invalidateQueries({ queryKey: ['goals', websiteId] });
      queryClient.invalidateQueries({ queryKey: [...analyticsKeys.all, 'goal-stats', websiteId] });
      setCreatedGoal({ type: variables.type, identifier: variables.identifier, selector: variables.selector });
    },
    onError: (error: any) => {
      toast.error(error.message || t.createFailed);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { name: string; type: string; identifier: string; selector?: string }) =>
      updateGoal(websiteId, editingGoal!.id, data),
    onSuccess: () => {
      toast.success(t.updated);
      queryClient.invalidateQueries({ queryKey: ['goals', websiteId] });
      queryClient.invalidateQueries({ queryKey: [...analyticsKeys.all, 'goal-stats', websiteId] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || t.updateFailed);
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
      toast.error(t.fillAll);
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
      <DialogContent className="gap-3 sm:max-w-[420px]">
        {createdGoal && !isEdit ? (
          <div className="space-y-4">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Check className="h-4 w-4 text-emerald-500" />
                </div>
                <DialogTitle>{t.createdTitle}</DialogTitle>
              </div>
              <DialogDescription>
                {createdGoal.type === 'pageview'
                  ? t.createdPageview
                  : createdGoal.selector
                    ? t.createdSelector
                    : t.createdEvent}
              </DialogDescription>
            </DialogHeader>

            {createdGoal.type === 'event' && !createdGoal.selector && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Code className="h-3.5 w-3.5" />
                  {t.addSnippet}
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
                  {t.passProperties}<code className="bg-muted px-1 rounded-lg text-[10px]">{`seentics.track('${createdGoal.identifier}', { value: 99 })`}</code>
                </p>
              </div>
            )}

            {createdGoal.type === 'event' && createdGoal.selector && (
              <div className="bg-muted/30 border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  {rich(t.autoFire(
                    <code className="bg-muted px-1 rounded-lg font-bold">{createdGoal.identifier}</code>,
                    <code className="bg-muted px-1 rounded-lg font-bold">{createdGoal.selector}</code>,
                  ))}
                </p>
              </div>
            )}

            {createdGoal.type === 'pageview' && (
              <div className="bg-muted/30 border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  {rich(t.countedOnView(<code className="bg-muted px-1 rounded-lg font-bold">{createdGoal.identifier}</code>))}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => resetForm()} variant="outline">
                {t.createAnother}
              </Button>
              <Button onClick={handleClose}>
                {all.actions.done}
              </Button>
            </DialogFooter>
          </div>
        ) : (
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? t.editTitle : t.newTitle}</DialogTitle>
            <DialogDescription>
              {isEdit ? t.editDescription : t.newDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-3">
            <div className="grid gap-1.5">
              <Label htmlFor="name" className="text-xs">{t.name}</Label>
              <Input
                id="name"
                placeholder={t.namePlaceholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="type" className="text-xs">{t.type}</Label>
              <Select value={type} onValueChange={(v: any) => {
                setType(v);
                if (!isEdit) setIdentifier('');
              }}>
                <SelectTrigger id="type" className="h-9 text-sm">
                  <SelectValue placeholder={t.selectType} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="event">{t.customEvent}</SelectItem>
                  <SelectItem value="pageview">{t.pageVisit}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="identifier" className="text-xs">
                  {type === 'event' ? t.eventName : t.pagePath}
                </Label>
                <button
                  type="button"
                  onClick={() => setShowHelper(!showHelper)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {t.needHelp}
                </button>
              </div>
              <Input
                id="identifier"
                placeholder={type === 'event' ? t.eventPlaceholder : t.pathPlaceholder}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="h-9 text-sm"
              />
              {type === 'event' && (
                <div className="mt-1 grid gap-1.5">
                  <Label htmlFor="selector" className="text-xs">
                    {t.selector} <span className="font-normal text-muted-foreground">{t.selectorHint}</span>
                  </Label>
                  <Input
                    id="selector"
                    placeholder={t.selectorPlaceholder}
                    value={selector}
                    onChange={(e) => setSelector(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t.selectorListens}
                  </p>
                </div>
              )}
              {showHelper && (
                <div className="mt-2 p-3 bg-primary/5 rounded-lg border border-primary/10 text-[11px] font-medium leading-relaxed text-muted-foreground animate-in fade-in slide-in-from-top-1">
                  {type === 'event' ? (
                    <ul className="list-disc pl-4 space-y-1">
                      <li><strong>{t.help.eventName}</strong> {t.help.eventNameBody}</li>
                      <li><strong>{t.help.selector}</strong> {rich(t.help.selectorBody(<code className="bg-primary/10 px-1 rounded-lg text-primary">#submit-btn</code>, <code className="bg-primary/10 px-1 rounded-lg text-primary">.buy-now</code>))}</li>
                      <li><strong>{t.help.predefined}</strong> {rich(t.help.predefinedBody(<code className="bg-primary/10 px-1 rounded-lg text-primary">form_submission</code>))}</li>
                    </ul>
                  ) : (
                    <p>{rich(t.help.path(<code className="bg-primary/10 px-1 rounded-lg text-primary">/signup-complete</code>))}</p>
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
              {all.actions.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEdit ? t.saveChanges : t.create}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
