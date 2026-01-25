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
  Workflow,
  Code2,
  Scroll,
  Clock,
  Users,
  Activity,
  MessageSquare,
  BarChart3,
  Slack,
  Settings2,
  Lightbulb,
  BookOpen,
  Copy,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

const TRIGGER_TYPES = [
  {
    type: 'pageView',
    label: 'Page View',
    icon: Zap,
    color: 'amber',
    description: 'Triggers when a user visits a specific page',
  },
  {
    type: 'click',
    label: 'Button Click',
    icon: MousePointer2,
    color: 'orange',
    description: 'Triggers when a specific button/element is clicked',
  },
  {
    type: 'scroll',
    label: 'Scroll Depth',
    icon: Scroll,
    color: 'lime',
    description: 'Triggers when user scrolls to a specific depth',
  },
  {
    type: 'timeOnPage',
    label: 'Time on Page',
    icon: Clock,
    color: 'green',
    description: 'Triggers after user spends X time on page',
  },
  {
    type: 'customEvent',
    label: 'Custom Event',
    icon: Code2,
    color: 'yellow',
    description: 'Triggers on a custom analytics event',
  },
  {
    type: 'userProperty',
    label: 'User Property',
    icon: Users,
    color: 'blue',
    description: 'Triggers based on user properties or traits',
  },
  {
    type: 'behavior',
    label: 'User Behavior',
    icon: Activity,
    color: 'purple',
    description: 'Triggers on specific user behavior patterns',
  },
  {
    type: 'webhook',
    label: 'Incoming Webhook',
    icon: Globe,
    color: 'cyan',
    description: 'Triggers on external HTTP request',
  },
];

const ACTION_TYPES = [
  {
    type: 'email',
    label: 'Send Email',
    icon: Mail,
    color: 'blue',
    description: 'Send an automated email to user or team',
  },
  {
    type: 'slack',
    label: 'Slack Notification',
    icon: MessageSquare,
    color: 'purple',
    description: 'Post a message to a Slack channel',
  },
  {
    type: 'webhook',
    label: 'HTTP Webhook',
    icon: Globe,
    color: 'cyan',
    description: 'Send an outgoing webhook request',
  },
  {
    type: 'modal',
    label: 'Show Modal',
    icon: Bell,
    color: 'pink',
    description: 'Display a popup modal to the user',
  },
  {
    type: 'banner',
    label: 'Floating Banner',
    icon: BarChart3,
    color: 'rose',
    description: 'Show a persistent banner message',
  },
  {
    type: 'crm',
    label: 'Sync to CRM',
    icon: Database,
    color: 'indigo',
    description: 'Update user profile in your CRM',
  },
  {
    type: 'javascript',
    label: 'Execute JavaScript',
    icon: Code2,
    color: 'yellow',
    description: 'Run custom JavaScript code',
  },
  {
    type: 'analytics',
    label: 'Track Event',
    icon: Zap,
    color: 'green',
    description: 'Send a custom analytics event',
  },
];

const TEMPLATES = [
  {
    name: 'Welcome Series',
    description: 'Greet new visitors with a welcome modal',
    icon: Lightbulb,
    trigger: 'New Page View',
  },
  {
    name: 'Exit Intent',
    description: 'Show offer before visitor leaves',
    icon: Activity,
    trigger: 'Mouse Leave',
  },
  {
    name: 'Scroll Popup',
    description: 'Display modal after 50% scroll',
    icon: Scroll,
    trigger: 'Scroll 50%',
  },
  {
    name: 'Time Delay',
    description: 'Show notification after 3 seconds',
    icon: Clock,
    trigger: '3 Second Delay',
  },
  {
    name: 'Form Submission',
    description: 'Send notification on form submit',
    icon: CheckCircle2,
    trigger: 'Form Submit',
  },
  {
    name: 'Lead Scoring',
    description: 'Sync qualified leads to CRM',
    icon: Users,
    trigger: 'High Engagement',
  },
];

export const EnhancedBuilderSidebar = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('modules');

  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/reactflow-label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  const filteredTriggers = TRIGGER_TYPES.filter((t) =>
    t.label.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredActions = ACTION_TYPES.filter((a) =>
    a.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside className="w-80 h-full border-l bg-white dark:bg-slate-950 flex flex-col shadow-lg">
      {/* Header */}
      <div className="p-6 border-b bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white">
            <Workflow size={18} />
          </div>
          <h2 className="font-black text-lg tracking-tight">Automation Modules</h2>
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-3 rounded-none border-b bg-transparent p-0 h-12">
          <TabsTrigger
            value="modules"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs font-black uppercase tracking-wider"
          >
            Modules
          </TabsTrigger>
          <TabsTrigger
            value="templates"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs font-black uppercase tracking-wider"
          >
            <BookOpen size={14} className="mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger
            value="presets"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs font-black uppercase tracking-wider"
          >
            <Settings2 size={14} className="mr-2" />
            Presets
          </TabsTrigger>
        </TabsList>

        {/* Modules Tab */}
        <TabsContent value="modules" className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Triggers */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">
              🎯 Triggers
            </p>
            <div className="grid grid-cols-1 gap-2.5">
              {filteredTriggers.map((trigger) => {
                const colorMap: Record<string, string> = {
                  amber: 'bg-amber-500/10 text-amber-600',
                  orange: 'bg-orange-500/10 text-orange-600',
                  lime: 'bg-lime-500/10 text-lime-600',
                  green: 'bg-green-500/10 text-green-600',
                  yellow: 'bg-yellow-500/10 text-yellow-600',
                  blue: 'bg-blue-500/10 text-blue-600',
                  purple: 'bg-purple-500/10 text-purple-600',
                  cyan: 'bg-cyan-500/10 text-cyan-600',
                };
                return (
                  <div
                    key={trigger.type}
                    onDragStart={(event) => onDragStart(event, 'triggerNode', trigger.label)}
                    draggable
                    className="p-3 rounded-xl border bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/30 dark:to-slate-900/10 hover:border-primary/50 hover:shadow-md transition-all cursor-grab active:cursor-grabbing group"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-8 w-8 rounded-lg ${colorMap[trigger.color]} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <trigger.icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-slate-900 dark:text-white">
                          {trigger.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {trigger.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">
              ⚡ Actions
            </p>
            <div className="grid grid-cols-1 gap-2.5">
              {filteredActions.map((action) => {
                const colorMap: Record<string, string> = {
                  blue: 'bg-blue-500/10 text-blue-600',
                  purple: 'bg-purple-500/10 text-purple-600',
                  cyan: 'bg-cyan-500/10 text-cyan-600',
                  pink: 'bg-pink-500/10 text-pink-600',
                  rose: 'bg-rose-500/10 text-rose-600',
                  indigo: 'bg-indigo-500/10 text-indigo-600',
                  yellow: 'bg-yellow-500/10 text-yellow-600',
                  green: 'bg-green-500/10 text-green-600',
                };
                return (
                  <div
                    key={action.type}
                    onDragStart={(event) => onDragStart(event, 'actionNode', action.label)}
                    draggable
                    className="p-3 rounded-xl border bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/30 dark:to-slate-900/10 hover:border-primary/50 hover:shadow-md transition-all cursor-grab active:cursor-grabbing group"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-8 w-8 rounded-lg ${colorMap[action.color]} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <action.icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-slate-900 dark:text-white">
                          {action.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {action.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="flex-1 overflow-y-auto p-6 space-y-3">
          {TEMPLATES.map((template) => (
            <div
              key={template.name}
              className="p-4 rounded-xl border border-border bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/30 dark:to-slate-900/10 hover:border-primary/50 hover:shadow-md transition-all group"
            >
              <div className="flex items-start gap-3 mb-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                  <template.icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-900 dark:text-white">
                    {template.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {template.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/30">
                <p className="text-[9px] font-semibold text-muted-foreground">
                  {template.trigger}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] font-black gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Copy size={12} />
                  Use
                </Button>
              </div>
            </div>
          ))}
        </TabsContent>

        {/* Presets Tab */}
        <TabsContent value="presets" className="flex-1 overflow-y-auto p-6 space-y-3">
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4 text-xs font-semibold text-blue-900 dark:text-blue-100">
            💡 Saved conditions and action templates will appear here
          </div>
          <Button variant="outline" className="w-full rounded-lg font-black text-xs">
            + Save Current Config
          </Button>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="p-6 border-t bg-slate-50/50 dark:bg-slate-900/10">
        <div className="flex items-center gap-2 text-primary text-xs font-black mb-2">
          <Zap size={14} className="fill-primary" />
          <span className="uppercase tracking-widest">POWERED BY AI</span>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Build sophisticated automations with intelligent triggers and actions.
        </p>
      </div>
    </aside>
  );
};
