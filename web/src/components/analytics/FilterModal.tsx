'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Filter, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterModalProps {
  dateRange: number;
  isCustomRange: boolean;
  customStartDate?: Date;
  customEndDate?: Date;
  onDateRangeChange: (value: string) => void;
  onCustomDateChange: (start: Date | undefined, end: Date | undefined) => void;
  onFiltersChange?: (filters: any) => void;
  activeFiltersCount?: number;
}

export function FilterModal({
  dateRange,
  isCustomRange,
  customStartDate,
  customEndDate,
  onDateRangeChange,
  onCustomDateChange,
  onFiltersChange,
  activeFiltersCount = 0
}: FilterModalProps) {
  const [open, setOpen] = useState(false);

  const totalActiveFilters = activeFiltersCount;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-10 px-4 bg-card/50 backdrop-blur-md hover:bg-card transition-all rounded shadow-sm font-bold text-xs uppercase tracking-widest gap-2 relative border border-border/50 active:scale-95 text-foreground">
          <Filter className="h-3.5 w-3.5 text-primary" />
          Filter
          {totalActiveFilters > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-black shadow-lg shadow-primary/20">
              {totalActiveFilters}
            </span>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[450px] rounded-3xl border border-border/10 bg-background shadow-2xl p-0 overflow-hidden outline-none">
        <div className="flex flex-col">
          {/* Header */}
          <DialogHeader className="p-6 pb-4 border-b border-border/10 bg-muted/5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <DialogTitle className="text-xl font-black tracking-tight text-foreground">
                  Time Period
                </DialogTitle>
                <p className="text-xs font-medium text-muted-foreground">
                  Select a date range for your analytics
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-6">
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Selection Mode</label>
              <Select
                value={isCustomRange ? 'custom' : dateRange.toString()}
                onValueChange={(val) => {
                  onDateRangeChange(val);
                }}
              >
                <SelectTrigger className="w-full h-12 bg-background border-border/20 hover:border-primary/50 transition-all rounded-xl text-sm font-bold shadow-sm">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/10 bg-popover shadow-2xl">
                  <SelectItem value="1" className="rounded-lg">Today</SelectItem>
                  <SelectItem value="7" className="rounded-lg">Last 7 days</SelectItem>
                  <SelectItem value="30" className="rounded-lg">Last 30 days</SelectItem>
                  <SelectItem value="90" className="rounded-lg">Last 90 days</SelectItem>
                  <SelectItem value="custom" className="text-primary font-bold rounded-lg border-t border-border/10 mt-1">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isCustomRange && (
              <div className="space-y-4 animate-in slide-in-from-top-2 duration-500">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Custom Calendar</label>
                <div className="p-1 rounded-2xl border border-border/10 bg-muted/5 overflow-hidden">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={customStartDate}
                    selected={{ from: customStartDate, to: customEndDate }}
                    onSelect={(range) => { onCustomDateChange(range?.from, range?.to); }}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border/10 bg-muted/5 flex items-center justify-end">
            <Button
              onClick={() => setOpen(false)}
              className="h-10 px-8 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all gap-2"
            >
              <CheckCircle2 size={16} />
              Done
            </Button>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[120px] -mr-32 -mt-32 rounded-full pointer-events-none animate-pulse" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/10 blur-[120px] -ml-32 -mb-32 rounded-full pointer-events-none animate-pulse" />
      </DialogContent>
    </Dialog>
  );
}
