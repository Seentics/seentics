'use client';

import React from 'react';
import { 
  Trash2, 
  MoreVertical, 
  Settings2,
  MousePointer2,
  Eye,
  FormInput,
  ShoppingCart,
  CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface StepItemProps {
  step: any;
  index: number;
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: any) => void;
}

const ICONS: any = {
  pageView: Eye,
  click: MousePointer2,
  form: FormInput,
  addToCart: ShoppingCart,
  purchase: CreditCard
};

export const StepItem = ({ step, index, onDelete, onUpdate }: StepItemProps) => {
  const Icon = ICONS[step.type] || Eye;

  return (
    <div className="group relative flex gap-4">
      {/* Connector Line */}
      <div className="absolute left-[26px] top-14 bottom-[-16px] w-[2px] bg-border group-last:hidden" />

      {/* Number Badge */}
      <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded border-2 border-white dark:border-slate-900 bg-emerald-500 text-white shadow-xl ring-4 ring-emerald-500/10">
        <span className="font-black text-lg">{index + 1}</span>
      </div>

      {/* Step Card */}
      <div className="flex-1 rounded border border-border bg-white dark:bg-slate-900 p-1 shadow-sm transition-all hover:border-emerald-500/50 hover:shadow-md">
        <div className="flex items-center gap-4 rounded-[1.25rem] bg-slate-50 dark:bg-slate-950/50 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-white dark:bg-slate-900 shadow-sm text-emerald-600">
            <Icon size={24} />
          </div>
          
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-[9px] font-black uppercase tracking-widest text-emerald-600">
                {step.type.replace(/([A-Z])/g, ' $1').trim()}
              </Badge>
              <h4 className="font-bold text-slate-900 dark:text-white">{step.name}</h4>
            </div>
            <Input 
              value={step.value || ''} 
              onChange={(e) => onUpdate(step.id, { value: e.target.value })}
              placeholder={step.type === 'pageView' ? 'e.g. /pricing' : 'Element selector or ID'}
              className="h-8 border-none bg-transparent p-0 text-sm font-medium text-muted-foreground placeholder:text-muted-foreground/50 focus-visible:ring-0"
            />
          </div>

          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded text-muted-foreground hover:text-foreground">
              <Settings2 size={16} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded text-rose-500 hover:bg-rose-500/10 hover:text-rose-600" onClick={() => onDelete(step.id)}>
              <Trash2 size={16} />
            </Button>
            <Button variant="ghost" size="icon" className="cursor-grab h-8 w-8 rounded text-muted-foreground hover:text-foreground">
              <MoreVertical size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
