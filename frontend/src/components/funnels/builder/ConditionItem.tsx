'use client';

import React from 'react';
import { Trash2, GitBranch, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ConditionItemProps {
  step: any;
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: any) => void;
}

export const ConditionItem = ({ step, onDelete, onUpdate }: ConditionItemProps) => {
  return (
    <div className="group relative flex gap-4 pl-[1.65rem]">
       {/* Connector Line */}
      <div className="absolute left-[26px] top-0 bottom-0 w-[2px] bg-border" />
      
      {/* Node Decorator */}
      <div className="absolute left-[19px] top-1/2 -mt-3 h-3 w-3 rounded-full border-2 border-purple-500 bg-white dark:bg-slate-900 z-10 shadow-sm" />

      {/* Condition Card */}
      <div className="flex-1 my-2">
        <div className="relative flex items-center gap-3 rounded border border-dashed border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-900/10 p-3 pr-4 transition-all hover:border-purple-400 hover:shadow-sm">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-purple-100 dark:bg-purple-900/40 text-purple-600">
                <GitBranch size={16} />
            </div>
            
            <div className="flex-1 flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-600 shrink-0">WHERE</span>
                
                <Select defaultValue="device">
                    <SelectTrigger className="h-7 w-[110px] text-xs font-bold border-0 bg-white dark:bg-slate-900 shadow-sm">
                        <SelectValue placeholder="Property" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="device">Device</SelectItem>
                        <SelectItem value="country">Country</SelectItem>
                        <SelectItem value="referrer">Referrer</SelectItem>
                    </SelectContent>
                </Select>

                <span className="text-[10px] font-bold text-muted-foreground shrink-0">IS</span>

                <Select defaultValue="mobile">
                    <SelectTrigger className="h-7 w-[110px] text-xs font-bold border-0 bg-white dark:bg-slate-900 shadow-sm">
                        <SelectValue placeholder="Value" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="mobile">Mobile</SelectItem>
                        <SelectItem value="desktop">Desktop</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Button variant="ghost" size="icon" className="h-7 w-7 rounded text-purple-400 hover:text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900" onClick={() => onDelete(step.id)}>
                <Trash2 size={14} />
            </Button>
        </div>
      </div>
    </div>
  );
};
