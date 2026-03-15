'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Flag, Plus, Trash2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { annotationsAPI, type Annotation } from '@/lib/annotations-api';
import { cn } from '@/lib/utils';

const COLOR_OPTIONS = [
  { value: 'blue', label: 'Blue', class: 'bg-indigo-500' },
  { value: 'green', label: 'Green', class: 'bg-green-500' },
  { value: 'red', label: 'Red', class: 'bg-red-500' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500' },
  { value: 'purple', label: 'Purple', class: 'bg-indigo-500' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500' },
];

interface AnnotationsPanelProps {
  websiteId: string;
  from: string;
  to: string;
}

export function AnnotationsPanel({ websiteId, from, to }: AnnotationsPanelProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formColor, setFormColor] = useState('blue');
  const [formDate, setFormDate] = useState('');

  useEffect(() => {
    loadAnnotations();
  }, [websiteId, from, to]);

  const loadAnnotations = async () => {
    try {
      setLoading(true);
      const data = await annotationsAPI.list(websiteId, from, to);
      setAnnotations(data);
    } catch {
      // Silent fail - annotations are optional
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formTitle.trim()) { toast.error('Please enter a title'); return; }
    if (!formDate) { toast.error('Please select a date'); return; }

    try {
      setCreating(true);
      const annotation = await annotationsAPI.create({
        websiteId,
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        color: formColor,
        occurredAt: new Date(formDate).toISOString(),
      });
      setAnnotations((prev) => [annotation, ...prev]);
      setShowCreate(false);
      resetForm();
      toast.success('Annotation added');
    } catch {
      toast.error('Failed to create annotation');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleting(id);
      await annotationsAPI.remove(id);
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
      toast.success('Annotation removed');
    } catch {
      toast.error('Failed to delete annotation');
    } finally {
      setDeleting(null);
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormColor('blue');
    setFormDate('');
  };

  const getColorClass = (color: string) => {
    return COLOR_OPTIONS.find((c) => c.value === color)?.class || 'bg-indigo-500';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Flag className="h-3.5 w-3.5" />
          <span>Annotations ({loading ? '...' : annotations.length})</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        <Button variant="ghost" size="sm" onClick={() => setShowCreate(true)} className="gap-1 text-xs h-7">
          <Plus className="h-3 w-3" />
          Add
        </Button>
      </div>

      {expanded && (
        <div className="space-y-1.5 mt-2">
          {annotations.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No annotations in this date range.</p>
          ) : (
            annotations.map((annotation) => (
              <div key={annotation.id} className="flex items-start gap-2 group">
                <div className={cn('h-2.5 w-2.5 rounded-full shrink-0 mt-1.5', getColorClass(annotation.color))} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate">{annotation.title}</span>
                    <span className="text-[10px] text-muted-foreground">{formatDate(annotation.occurredAt)}</span>
                  </div>
                  {annotation.description && (
                    <p className="text-[11px] text-muted-foreground truncate">{annotation.description}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={() => handleDelete(annotation.id)}
                  disabled={deleting === annotation.id}
                >
                  {deleting === annotation.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                  )}
                </Button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Annotation</DialogTitle>
            <DialogDescription>
              Mark a notable event on your analytics timeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="e.g. Product launch, Campaign started..."
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Additional details..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="datetime-local"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-1.5 pt-1">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormColor(color.value)}
                      className={cn(
                        'h-7 w-7 rounded-full transition-all',
                        color.class,
                        formColor === color.value ? 'ring-2 ring-offset-2 ring-primary' : 'opacity-50 hover:opacity-75'
                      )}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !formTitle.trim() || !formDate} className="gap-1.5">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" />}
              Add Annotation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
