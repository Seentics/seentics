'use client';

import React, { useState } from 'react';
import {
  Search,
  Workflow,
  Zap,
  MousePointer2,
  Scroll,
  Clock,
  Code2,
  Users,
  Activity,
  Globe,
  Mail,
  MessageSquare,
  MessageCircle,
  Bell,
  BarChart3,
  Database,
  Copy,
  GitBranch,
  Infinity as InfinityIcon,
  LogOut,
  FileText,
  UserX,
  Eye,
  EyeOff,
  TrendingUp,
  TrendingDown,
  Cookie,
  Target,
  CheckCircle2,
  Square,
  Plus,
  Settings,
  MousePointerClick,
  Hourglass,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useCustomNodesStore } from '@/stores/customNodesStore';
import { CustomNodeCreator } from './CustomNodeCreator';

export const TRIGGER_TYPES = [
  {
    type: 'pageView',
    label: 'Page View',
    icon: Eye,
    color: 'blue',
    description: 'Triggers when a user visits a specific page',
    implemented: true,
  },
  {
    type: 'customEvent',
    label: 'Custom Event',
    icon: Code2,
    color: 'yellow',
    description: 'Triggers on a custom analytics event',
    implemented: true,
  },
  {
    type: 'timeOnPage',
    label: 'Time on Page',
    icon: Clock,
    color: 'green',
    description: 'Triggers after user spends X time on page',
    implemented: true,
  },
  {
    type: 'scroll',
    label: 'Scroll Depth',
    icon: Scroll,
    color: 'lime',
    description: 'Triggers when user scrolls to a specific depth',
    implemented: true,
  },
  {
    type: 'exitIntent',
    label: 'Exit Intent',
    icon: LogOut,
    color: 'red',
    description: 'Triggers when user attempts to leave the page',
    implemented: true,
  },
  {
    type: 'inactivity',
    label: 'User Inactivity',
    icon: UserX,
    color: 'slate',
    description: 'Triggers after period of no user interaction',
    implemented: true,
  },
  {
    type: 'formSubmit',
    label: 'Form Submit',
    icon: FileText,
    color: 'indigo',
    description: 'Triggers when a form is submitted',
    implemented: true,
  },
  {
    type: 'funnelComplete',
    label: 'Funnel Completed',
    icon: CheckCircle2,
    color: 'emerald',
    description: 'Triggers when user completes entire funnel',
    implemented: true,
  },
  {
    type: 'funnelDropoff',
    label: 'Funnel Drop-off',
    icon: TrendingDown,
    color: 'rose',
    description: 'Triggers when user abandons a funnel',
    implemented: true,
  },
  {
    type: 'goalCompleted',
    label: 'Goal Reached',
    icon: Target,
    color: 'amber',
    description: 'Triggers when user reaches a defined goal',
    implemented: true,
  },
  {
    type: 'rageClicks',
    label: 'Rage Clicks',
    icon: MousePointerClick,
    color: 'red',
    description: 'Identify frustrated users from multiple rapid clicks',
    implemented: true,
  },
];


export const ACTION_TYPES = [
  {
    type: 'actionNode',
    subtype: 'email',
    label: 'Send Email',
    icon: Mail,
    color: 'blue',
    description: 'Send an automated email notification',
    implemented: true,
  },
  {
    type: 'actionNode',
    subtype: 'modal',
    label: 'Show Modal',
    icon: Square,
    color: 'pink',
    description: 'Display a popup modal to the user',
    implemented: true,
  },
  {
    type: 'actionNode',
    subtype: 'banner',
    label: 'Show Banner',
    icon: BarChart3,
    color: 'amber',
    description: 'Show a persistent banner message',
    implemented: true,
  },
  {
    type: 'actionNode',
    subtype: 'notification',
    label: 'Notification',
    icon: Bell,
    color: 'orange',
    description: 'Show toast notification in the browser',
    implemented: true,
  },
  {
    type: 'actionNode',
    subtype: 'hideElement',
    label: 'Hide Element',
    icon: EyeOff,
    color: 'slate',
    description: 'Hide a specific element on the page',
    implemented: true,
  },
  {
    type: 'actionNode',
    subtype: 'showElement',
    label: 'Show Element',
    icon: Eye,
    color: 'lime',
    description: 'Show a previously hidden element',
    implemented: true,
  },
  {
    type: 'actionNode',
    subtype: 'slack',
    label: 'Slack Notification',
    icon: MessageSquare,
    color: 'indigo',
    description: 'Post a message to a Slack channel',
    implemented: true,
  },
  {
    type: 'actionNode',
    subtype: 'whatsapp',
    label: 'WhatsApp Message',
    icon: MessageCircle,
    color: 'emerald',
    description: 'Send an automated WhatsApp message',
    implemented: true,
  },
  {
    type: 'actionNode',
    subtype: 'webhook',
    label: 'Call Webhook',
    icon: Globe,
    color: 'purple',
    description: 'Send an outgoing webhook request',
    implemented: true,
  },
  {
    type: 'actionNode',
    subtype: 'javascript',
    label: 'Script Injection',
    icon: Code2,
    color: 'rose',
    description: 'Run custom JavaScript code',
    implemented: true,
  },
  {
    type: 'actionNode',
    subtype: 'redirect',
    label: 'Redirect User',
    icon: Zap,
    color: 'blue',
    description: 'Redirect user to another URL',
    implemented: true,
  },
  {
    type: 'actionNode',
    subtype: 'trackEvent',
    label: 'Track Event',
    icon: Activity,
    color: 'violet',
    description: 'Send a custom event to analytics',
    implemented: true,
  },
  {
    type: 'actionNode',
    subtype: 'setCookie',
    label: 'Set Cookie',
    icon: Cookie,
    color: 'yellow',
    description: 'Set a browser cookie with value',
    implemented: true,
  },
  {
    type: 'actionNode',
    subtype: 'wait',
    label: 'Delay Step',
    icon: Hourglass,
    color: 'slate',
    description: 'Pause automation execution for a specified duration',
    implemented: true,
  },
];

export const EnhancedBuilderSidebar = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCustomNodeCreatorOpen, setIsCustomNodeCreatorOpen] = useState(false);
  const [customNodeCategory, setCustomNodeCategory] = useState<'trigger' | 'condition' | 'action'>('action');
  const { customNodes, addCustomNode } = useCustomNodesStore();

  const onDragStart = (event: React.DragEvent, nodeType: string, label: string, description: string, subtype?: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/reactflow-label', label);
    event.dataTransfer.setData('application/reactflow-description', description);
    if (subtype) {
      event.dataTransfer.setData('application/reactflow-subtype', subtype);
    }
    event.dataTransfer.effectAllowed = 'move';
  };

  const filteredTriggers = TRIGGER_TYPES.filter((t) =>
    t.label.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredActions = ACTION_TYPES.filter((a) =>
    a.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get custom nodes by category
  const customTriggers = customNodes.filter(node => node.category === 'trigger');
  const customActions = customNodes.filter(node => node.category === 'action');

  const handleSaveCustomNode = (node: any) => {
    addCustomNode(node);
  };

  const colorMap: Record<string, string> = {
    amber: 'bg-amber-500/10 text-amber-500',
    orange: 'bg-orange-500/10 text-orange-500',
    lime: 'bg-lime-500/10 text-lime-500',
    green: 'bg-green-500/10 text-green-500',
    yellow: 'bg-yellow-500/10 text-yellow-500',
    blue: 'bg-blue-500/10 text-blue-500',
    purple: 'bg-purple-500/10 text-purple-500',
    cyan: 'bg-cyan-500/10 text-cyan-500',
    pink: 'bg-pink-500/10 text-pink-500',
    rose: 'bg-rose-500/10 text-rose-500',
  };

  const NodeItem = ({ item, type, subtype }: { item: any; type: string; subtype?: string }) => (
    <div
      onDragStart={(event) => item.implemented ? onDragStart(event, type, item.label, item.description, subtype) : undefined}
      draggable={item.implemented}
      className={`p-3 rounded-lg border transition-all ${item.implemented
        ? 'border-slate-800 bg-slate-900/30 hover:border-slate-700 hover:bg-slate-900/60 cursor-grab active:cursor-grabbing'
        : 'border-slate-800/50 bg-slate-900/10 border-dashed opacity-50 cursor-not-allowed'
        }`}
    >
      <div className="flex items-center gap-3">
        <div className={`h-9 w-9 rounded-md ${item.implemented ? colorMap[item.color] : 'bg-slate-700/30 text-slate-600'} flex items-center justify-center flex-shrink-0`}>
          <item.icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-semibold truncate ${item.implemented ? 'text-white' : 'text-slate-600'}`}>
              {item.label}
            </p>
            {!item.implemented && (
              <span className="text-[8px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/30 flex-shrink-0">
                Upcoming
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 truncate mt-0.5">
            {item.description}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <aside className="w-[400px] h-full border-l border-slate-800 bg-slate-900/40 backdrop-blur-xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Workflow size={18} />
          </div>
          <div>
            <h2 className="font-bold text-sm text-white">Add Steps</h2>
            <p className="text-[10px] text-slate-500">Drag to workflow</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="triggers" className="flex-1 flex flex-col overflow-hidden">
        <div className="pt-0">
          <TabsList className="w-full bg-slate-900/40 border-b border-slate-800 p-0 h-12 rounded-none flex items-stretch">
            <TabsTrigger value="triggers" className="flex-1 text-[11px] font-black uppercase tracking-widest rounded-none border-r border-slate-800/50 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-b-transparent data-[state=active]:border-b-primary transition-all">
              Triggers
            </TabsTrigger>
            <TabsTrigger value="actions" className="flex-1 text-[11px] font-black uppercase tracking-widest rounded-none data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-b-transparent data-[state=active]:border-b-primary transition-all">
              Actions
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar min-h-0">
          <TabsContent value="triggers" className="m-0 mt-0 space-y-2.5">
            <div className="space-y-2.5">
              {customTriggers.length > 0 && (
                <>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-2 py-1">Custom Triggers</div>
                  {customTriggers.map((trigger) => (
                    <div
                      key={trigger.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, 'triggerNode', trigger.name, trigger.description, trigger.id)}
                      className="group relative cursor-move p-3 rounded-xl border-2 border-slate-800 hover:border-blue-500/40 bg-slate-900/60 hover:bg-slate-900 transition-all duration-200"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-lg flex items-center justify-center text-2xl" style={{ backgroundColor: trigger.color + '20' }}>
                          {trigger.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[13px] font-bold text-white mb-0.5">{trigger.name}</h4>
                          <p className="text-[10px] text-slate-500 leading-relaxed">{trigger.description}</p>
                        </div>
                      </div>
                      <div className="absolute top-2 right-2">
                        <Settings className="w-3 h-3 text-slate-600" />
                      </div>
                    </div>
                  ))}
                  <div className="h-2" />
                </>
              )}

              {filteredTriggers.map((trigger) => (
                <NodeItem key={trigger.type} item={trigger} type="triggerNode" subtype={trigger.type} />
              ))}
              {filteredTriggers.length === 0 && customTriggers.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-xs text-slate-600">No triggers found</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="actions" className="m-0 mt-0 space-y-2.5">
            <div className="space-y-4">
              {/* Custom Actions */}
              {customActions.length > 0 && (
                <div className="space-y-2.5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-2 py-1">Custom Actions</div>
                  {customActions.map((action) => (
                    <div
                      key={action.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, 'actionNode', action.name, action.description, action.id)}
                      className="group relative cursor-move p-3 rounded-xl border-2 border-slate-800 hover:border-green-500/40 bg-slate-900/60 hover:bg-slate-900 transition-all duration-200"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-lg flex items-center justify-center text-2xl" style={{ backgroundColor: action.color + '20' }}>
                          {action.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[13px] font-bold text-white mb-0.5">{action.name}</h4>
                          <p className="text-[10px] text-slate-500 leading-relaxed">{action.description}</p>
                        </div>
                      </div>
                      <div className="absolute top-2 right-2">
                        <Settings className="w-3 h-3 text-slate-600" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions Segment */}
              <div className="space-y-2.5">

                {filteredActions.map((action, idx) => (
                  <NodeItem key={`action-${idx}`} item={action} type={action.type} subtype={action.subtype} />
                ))}
              </div>

              {filteredActions.length === 0 && customActions.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-xs text-slate-600">No tools found</p>
                </div>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <CustomNodeCreator
        isOpen={isCustomNodeCreatorOpen}
        onClose={() => setIsCustomNodeCreatorOpen(false)}
        onSave={handleSaveCustomNode}
        defaultCategory={customNodeCategory === 'trigger' ? 'trigger' : 'action'}
      />
    </aside>
  );
};
