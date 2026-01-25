'use client';

import React, { useState } from 'react';
import { 
  Zap, 
  Mail, 
  Bell, 
  Globe, 
  Database, 
  Play, 
  MousePointer2, 
  Search,
  CheckCircle2,
  Workflow
} from 'lucide-react';
import { Input } from '@/components/ui/input';

const NODE_TYPES = {
  triggers: [
    { type: 'pageView', label: 'Page View', icon: Zap, description: 'Triggers when a user visits a specific page' },
    { type: 'click', label: 'Button Click', icon: MousePointer2, description: 'Triggers when a specific button/element is clicked' },
    { type: 'customEvent', label: 'Custom Event', icon: CheckCircle2, description: 'Triggers on a custom analytics event' },
    { type: 'webhook', label: 'Incoming Webhook', icon: Globe, description: 'Triggers on external HTTP request' },
  ],
  logic: [
    { type: 'condition', label: 'Condition Check', icon: 'GitBranch', description: 'Split workflow driven by data values' },
    { type: 'delay', label: 'Wait / Delay', icon: 'Clock', description: 'Pause execution for a set duration' },
  ],
  interactions: [
    { type: 'modal', label: 'Show Modal', icon: 'PanelTop', description: 'Display a popup modal to the user' },
    { type: 'notification', label: 'Toast Notification', icon: 'BellRing', description: 'Show a temporary success/error message' },
    { type: 'banner', label: 'Floating Banner', icon: 'MessageSquare', description: 'Show a persistent banner message' },
  ],
  actions: [
    { type: 'email', label: 'Send Email', icon: Mail, description: 'Send an automated email to user or team' },
    { type: 'slack', label: 'Slack Alert', icon: Bell, description: 'Post a message to a Slack channel' },
    { type: 'crm', label: 'Sync to CRM', icon: Database, description: 'Update user profile in your CRM' },
    { type: 'httpRequest', label: 'HTTP Request', icon: Globe, description: 'Send an outgoing webhook request' },
  ]
};

// Helper component for icon rendering since some names are strings
const IconRenderer = ({ icon }: { icon: any }) => {
    if (typeof icon === 'string') {
        const { GitBranch, Clock, PanelTop, BellRing, MessageSquare } = require('lucide-react');
        const IconComponent = { GitBranch, Clock, PanelTop, BellRing, MessageSquare }[icon];
        return IconComponent ? <IconComponent size={16} /> : null;
    }
    const Icon = icon;
    return <Icon size={16} />;
};

export const BuilderSidebar = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/reactflow-label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  const filteredTriggers = NODE_TYPES.triggers.filter(n => n.label.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredLogic = NODE_TYPES.logic?.filter(n => n.label.toLowerCase().includes(searchTerm.toLowerCase())) || [];
  const filteredInteractions = NODE_TYPES.interactions?.filter(n => n.label.toLowerCase().includes(searchTerm.toLowerCase())) || [];
  const filteredActions = NODE_TYPES.actions.filter(n => n.label.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <aside className="w-80 h-full border-l bg-white dark:bg-slate-950 flex flex-col">
      <div className="p-6 border-b">
        <div className="flex items-center gap-2 mb-6">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Workflow size={18} />
            </div>
            <h2 className="font-black text-lg tracking-tight">Modules</h2>
        </div>
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Search modules..." 
            className="pl-10 h-10 bg-muted/20 border-none shadow-none rounded-xl text-xs font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <div>
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">Triggers</p>
           <div className="grid grid-cols-1 gap-3">
             {filteredTriggers.map((trigger) => (
                <div 
                    key={trigger.type}
                    onDragStart={(event) => onDragStart(event, 'triggerNode', trigger.label)}
                    draggable
                    className="p-3 rounded-xl border bg-slate-50 dark:bg-slate-900/50 hover:border-amber-500/50 hover:bg-amber-500/[0.02] transition-all cursor-grab active:cursor-grabbing group"
                >
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
                           <trigger.icon size={16} />
                        </div>
                        <div className="min-w-0">
                           <p className="text-xs font-black text-slate-900 dark:text-white">{trigger.label}</p>
                           <p className="text-[10px] text-muted-foreground truncate">{trigger.description}</p>
                        </div>
                    </div>
                </div>
             ))}
           </div>
        </div>

        <div>
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">Logic & Flow</p>
           <div className="grid grid-cols-1 gap-3">
             {filteredLogic.map((item) => (
                <div 
                    key={item.type}
                    onDragStart={(event) => onDragStart(event, 'conditionNode', item.label)}
                    draggable
                    className="p-3 rounded-xl border bg-slate-50 dark:bg-slate-900/50 hover:border-purple-500/50 hover:bg-purple-500/[0.02] transition-all cursor-grab active:cursor-grabbing group"
                >
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600">
                           <IconRenderer icon={item.icon} />
                        </div>
                        <div className="min-w-0">
                           <p className="text-xs font-black text-slate-900 dark:text-white">{item.label}</p>
                           <p className="text-[10px] text-muted-foreground truncate">{item.description}</p>
                        </div>
                    </div>
                </div>
             ))}
           </div>
        </div>

        <div>
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">User Interface</p>
           <div className="grid grid-cols-1 gap-3">
             {filteredInteractions.map((item) => (
                <div 
                    key={item.type}
                    onDragStart={(event) => onDragStart(event, 'interactionNode', item.label)}
                    draggable
                    className="p-3 rounded-xl border bg-slate-50 dark:bg-slate-900/50 hover:border-pink-500/50 hover:bg-pink-500/[0.02] transition-all cursor-grab active:cursor-grabbing group"
                >
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-600">
                           <IconRenderer icon={item.icon} />
                        </div>
                        <div className="min-w-0">
                           <p className="text-xs font-black text-slate-900 dark:text-white">{item.label}</p>
                           <p className="text-[10px] text-muted-foreground truncate">{item.description}</p>
                        </div>
                    </div>
                </div>
             ))}
           </div>
        </div>

        <div>
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">Actions</p>
           <div className="grid grid-cols-1 gap-3">
             {filteredActions.map((action) => (
                <div 
                    key={action.type}
                    onDragStart={(event) => onDragStart(event, 'actionNode', action.label)}
                    draggable
                    className="p-3 rounded-xl border bg-slate-50 dark:bg-slate-900/50 hover:border-blue-500/50 hover:bg-blue-500/[0.02] transition-all cursor-grab active:cursor-grabbing group"
                >
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
                           <action.icon size={16} />
                        </div>
                        <div className="min-w-0">
                           <p className="text-xs font-black text-slate-900 dark:text-white">{action.label}</p>
                           <p className="text-[10px] text-muted-foreground truncate">{action.description}</p>
                        </div>
                    </div>
                </div>
             ))}
           </div>
        </div>
      </div>

      <div className="p-6 border-t bg-slate-50/50 dark:bg-slate-900/10">
         <div className="flex items-center gap-2 text-primary">
            <Zap size={14} className="fill-primary" />
            <p className="text-[10px] font-black uppercase tracking-widest leading-none">Powered by Intelligence</p>
         </div>
      </div>
    </aside>
  );
};
