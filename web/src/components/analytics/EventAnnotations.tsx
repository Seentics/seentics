'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Trash2, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

export interface EventAnnotation {
  id: string;
  date: Date;
  title: string;
  description?: string;
  color?: string;
}

interface EventAnnotationsProps {
  annotations: EventAnnotation[];
  onAdd: (annotation: Omit<EventAnnotation, 'id'>) => void;
  onDelete: (id: string) => void;
}

export function EventAnnotations({ annotations, onAdd, onDelete }: EventAnnotationsProps) {
  const t = useT().analytics.annotations;
  const actions = useT().actions;
  const longDate = (d: Date) => format(d, 'PPP');
  const shortDate = (d: Date) => format(d, 'MMM d, yyyy');
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date>(new Date());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#2563eb');

  const colors = [
    { name: t.colors.blue, value: '#2563eb' },
    { name: t.colors.green, value: '#10b981' },
    { name: t.colors.red, value: '#ef4444' },
    { name: t.colors.purple, value: '#2563eb' },
    { name: t.colors.orange, value: '#f97316' },
    { name: t.colors.pink, value: '#ec4899' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onAdd({
        date,
        title: title.trim(),
        description: description.trim() || undefined,
        color,
      });
      setTitle('');
      setDescription('');
      setDate(new Date());
      setColor('#2563eb');
      setOpen(false);
    }
  };

  return (
    <div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 h-7 px-3 font-medium text-xs text-muted-foreground bg-muted/50 hover:bg-muted/70 hover:text-foreground rounded-lg border-0">
            <Tag className="h-3.5 w-3.5" />
            {t.annotate}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{t.title}</DialogTitle>
              <DialogDescription>
                {t.description}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="date">{t.date}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'justify-start text-left font-normal',
                        !date && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? longDate(date) : <span>{t.pickDate}</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => d && setDate(d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="title">{t.eventTitle}</Label>
                <Input
                  id="title"
                  placeholder={t.eventTitlePlaceholder}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">{t.descriptionLabel}</Label>
                <Textarea
                  id="description"
                  placeholder={t.descriptionPlaceholder}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t.color}</Label>
                <div className="flex gap-2">
                  {colors.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      className={cn(
                        'w-8 h-8 rounded-full border-2 transition-all',
                        color === c.value ? 'border-foreground scale-110' : 'border-transparent'
                      )}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {actions.cancel}
              </Button>
              <Button type="submit" disabled={!title.trim()}>
                {t.add}
              </Button>
            </DialogFooter>
          </form>

          {/* Annotations List */}
          {annotations.length > 0 && (
            <div className="mt-8 border-t pt-6">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">{t.recent}</p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {annotations
                  .sort((a, b) => b.date.getTime() - a.date.getTime())
                  .slice(0, 10)
                  .map((annotation) => (
                    <div
                      key={annotation.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: annotation.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{annotation.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {shortDate(annotation.date)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        aria-label={t.delete}
                        title={t.delete}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(annotation.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
