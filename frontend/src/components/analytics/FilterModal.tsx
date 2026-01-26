'use client';

import React from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, Filter, Save, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface FilterModalProps {
  dateRange: number;
  isCustomRange: boolean;
  customStartDate?: Date;
  customEndDate?: Date;
  onDateRangeChange: (value: string) => void;
  onCustomDateChange: (start: Date | undefined, end: Date | undefined) => void;
  onExport: () => void;
}

export function FilterModal({
  dateRange,
  isCustomRange,
  customStartDate,
  customEndDate,
  onDateRangeChange,
  onCustomDateChange,
  onExport,
}: FilterModalProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-10 px-4 bg-card/50 backdrop-blur-md border-border/40 hover:bg-card transition-colors rounded-xl shadow-sm font-bold text-xs uppercase tracking-widest gap-2">
          <Filter className="h-3.5 w-3.5" />
          Filters
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px] rounded-2xl border-border/40 bg-background/95 backdrop-blur-xl shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border/10">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold tracking-tight">Analytics Filters</DialogTitle>
          </div>
        </DialogHeader>
        
        <div className="p-6 space-y-8">
          {/* Date Range Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Time Period</label>
            </div>
            
            <Select 
              value={isCustomRange ? 'custom' : dateRange.toString()} 
              onValueChange={(val) => {
                onDateRangeChange(val);
                if (val !== 'custom') setOpen(false);
              }}
            >
              <SelectTrigger className="w-full h-12 bg-accent/5 border-border/40 hover:bg-accent/10 transition-colors rounded-xl shadow-sm text-sm font-semibold">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/40 shadow-2xl">
                <SelectItem value="1">Today</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="custom" className="text-primary font-bold">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Date Picker - Only shown if custom range is selected */}
          {isCustomRange && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Custom Dates</label>
              </div>
              
              <div className="p-4 rounded-xl border border-border/40 bg-accent/5">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-muted-foreground">Selection</span>
                        <span className="font-bold text-primary">
                            {customStartDate && customEndDate 
                              ? `${format(customStartDate, 'MMM dd')} - ${format(customEndDate, 'MMM dd')}`
                              : 'Select range'
                            }
                        </span>
                    </div>
                    <div className="bg-background rounded-lg border border-border/40 p-1">
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
              </div>
            </div>
          )}

          {/* Actions Section */}
          <div className="pt-4 border-t border-border/10 space-y-3">
             <Button 
                variant="brand" 
                className="w-full h-12 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
                onClick={() => setOpen(false)}
             >
                Apply Filters
             </Button>
             
             <Button 
                variant="outline" 
                className="w-full h-12 rounded-xl font-bold text-xs uppercase tracking-widest border-border/40 hover:bg-accent/5 gap-2 transition-all"
                onClick={() => {
                   onExport();
                   setOpen(false);
                }}
             >
                <Download className="h-4 w-4" />
                Export Results
             </Button>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 blur-3xl -ml-16 -mb-16 rounded-full pointer-events-none" />
      </DialogContent>
    </Dialog>
  );
}
