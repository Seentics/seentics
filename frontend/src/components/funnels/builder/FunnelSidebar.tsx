'use client';

import React, { useState } from 'react';
import { 
  Filter, 
  MousePointer2, 
  Eye, 
  Search, 
  ArrowRight,
  FormInput,
  ShoppingCart,
  CreditCard
} from 'lucide-react';
import { Input } from '@/components/ui/input';

const FUNNEL_STEPS = [
  { type: 'pageView', label: 'Page View', icon: Eye, description: 'User visits a specific URL' },
  { type: 'click', label: 'Button Click', icon: MousePointer2, description: 'User clicks a specific element' },
  { type: 'form', label: 'Form Submit', icon: FormInput, description: 'User submits a lead form' },
  { type: 'addToCart', label: 'Add to Cart', icon: ShoppingCart, description: 'User adds item to cart' },
  { type: 'purchase', label: 'Purchase', icon: CreditCard, description: 'User completes checkout' },
];

export const FunnelSidebar = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType); // Keeping key for compat, but value is now specific type
    event.dataTransfer.setData('application/reactflow-label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  const filteredSteps = FUNNEL_STEPS.filter(n => n.label.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <aside className="w-80 h-full border-l bg-white dark:bg-slate-950 flex flex-col z-10 shrink-0">
      <div className="p-6 border-b">
        <div className="flex items-center gap-2 mb-6">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <Filter size={18} />
            </div>
            <h2 className="font-black text-lg tracking-tight">Funnel Steps</h2>
        </div>
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Search steps..." 
            className="pl-10 h-10 bg-muted/20 border-none shadow-none rounded-xl text-xs font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
           {filteredSteps.map((step) => (
            <div 
                key={step.type}
                onDragStart={(event) => onDragStart(event, step.type, step.label)}
                draggable
                className="p-4 rounded-2xl border bg-slate-50 dark:bg-slate-900/50 hover:border-emerald-500/50 hover:bg-emerald-500/[0.02] transition-all cursor-grab active:cursor-grabbing group shadow-sm hover:shadow-md"
            >
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                       <step.icon size={20} />
                    </div>
                    <div className="min-w-0">
                       <p className="text-sm font-black text-slate-900 dark:text-white">{step.label}</p>
                       <p className="text-[10px] text-muted-foreground truncate font-medium">{step.description}</p>
                    </div>
                </div>
            </div>
           ))}
      </div>

      <div className="p-6 border-t bg-emerald-50/50 dark:bg-emerald-900/10">
         <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <ArrowRight size={14} />
            <p className="text-[10px] font-black uppercase tracking-widest leading-none">Linear Progression Mode</p>
         </div>
      </div>
    </aside>
  );
};
