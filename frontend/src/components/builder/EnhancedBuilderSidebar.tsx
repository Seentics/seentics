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
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useCustomNodesStore } from '@/stores/customNodesStore';
import { CustomNodeCreator } from './CustomNodeCreator';

export const TRIGGER_TYPES = [
  // 🔥 HIGH IMPACT TRIGGERS
  {
    type: 'pageView',
    label: 'Page View',
    icon: Eye,
    color: 'blue',
    description: 'Triggers when a user visits a specific page',
    implemented: true,
    priority: 'high',
  },
  {
    type: 'click',
    label: 'Button Click',
    icon: MousePointer2,
    color: 'purple',
    description: 'Triggers when a specific button/element is clicked',
    implemented: true,
    priority: 'high',
  },
  {
    type: 'exitIntent',
    label: 'Exit Intent',
    icon: LogOut,
    color: 'red',
    description: 'Triggers when user attempts to leave the page',
    implemented: true,
    priority: 'high',
  },
  {
    type: 'timeOnPage',
    label: 'Time on Page',
    icon: Clock,
    color: 'green',
    description: 'Triggers after user spends X time on page',
    implemented: true,
    priority: 'high',
  },
  {
    type: 'scroll',
    label: 'Scroll Depth',
    icon: Scroll,
    color: 'lime',
    description: 'Triggers when user scrolls to a specific depth',
    implemented: true,
    priority: 'high',
  },
  
  // 🎯 CONVERSION & FUNNEL TRIGGERS
  {
    type: 'funnelDropoff',
    label: 'Funnel Drop-off',
    icon: TrendingDown,
    color: 'rose',
    description: 'Triggers when user drops off from a funnel step',
    implemented: true,
    priority: 'high',
  },
  {
    type: 'funnelComplete',
    label: 'Funnel Completed',
    icon: CheckCircle2,
    color: 'emerald',
    description: 'Triggers when user completes entire funnel',
    implemented: true,
    priority: 'high',
  },
  {
    type: 'goalCompleted',
    label: 'Goal Completed',
    icon: Target,
    color: 'cyan',
    description: 'Triggers when analytics goal is reached',
    implemented: true,
    priority: 'high',
  },
  {
    type: 'formSubmit',
    label: 'Form Submit',
    icon: FileText,
    color: 'indigo',
    description: 'Triggers when a form is submitted',
    implemented: true,
    priority: 'medium',
  },
  
  // ⚙️ ADVANCED TRIGGERS
  {
    type: 'customEvent',
    label: 'Custom Event',
    icon: Code2,
    color: 'yellow',
    description: 'Triggers on a custom analytics event',
    implemented: true,
    priority: 'medium',
  },
  {
    type: 'inactivity',
    label: 'User Inactivity',
    icon: UserX,
    color: 'slate',
    description: 'Triggers after period of no user interaction',
    implemented: true,
    priority: 'medium',
  },
  {
    type: 'webhook',
    label: 'Incoming Webhook',
    icon: Globe,
    color: 'cyan',
    description: 'Triggers on external HTTP request',
    implemented: false,
    priority: 'low',
  },
];

export const LOGIC_TYPES = [
  {
    type: 'conditionNode',
    subtype: 'device',
    label: 'Device Check',
    icon: GitBranch,
    color: 'purple',
    description: 'Check if user is on Mobile, Desktop, or Tablet',
    implemented: true, // ✅ Verified: seentics-automation.js:42-100 evaluateCondition
  },
  {
    type: 'conditionNode',
    subtype: 'visitor',
    label: 'Visitor Status',
    icon: Users,
    color: 'blue',
    description: 'Check if user is New or Returning',
    implemented: true, // ✅ Verified: seentics-automation.js:42-100 evaluateCondition
  },
  {
    type: 'conditionNode',
    subtype: 'url_param',
    label: 'URL Parameter',
    icon: Globe,
    color: 'orange',
    description: 'Check for specific UTM or URL parameters',
    implemented: true, // ✅ Verified: seentics-automation.js:42-100 evaluateCondition
  },
  {
    type: 'advancedConditionNode',
    subtype: 'segment',
    label: 'User Segment',
    icon: InfinityIcon,
    color: 'pink',
    description: 'Complex matching against user segments',
    implemented: true, // ✅ Condition evaluation supports if/else logic
  },
  {
    type: 'conditionNode',
    subtype: 'if',
    label: 'Logic Split (If/Else)',
    icon: GitBranch,
    color: 'purple',
    description: 'Branch your workflow based on custom logic',
    implemented: true, // ✅ evaluateCondition with eq/neq/contains/gt operators
  },
  {
    type: 'actionNode',
    subtype: 'wait',
    label: 'Wait / Delay',
    icon: Clock,
    color: 'amber',
    description: 'Pause the workflow for a specific duration',
    implemented: true, // ✅ Timer system: seentics-automation.js:216-221
  },
  {
    type: 'conditionNode',
    subtype: 'page_views',
    label: 'Page View Count',
    icon: Eye,
    color: 'cyan',
    description: 'Check number of pages viewed in session',
    implemented: true, // ✅ Session tracking available
  },
  {
    type: 'conditionNode',
    subtype: 'traffic_source',
    label: 'Traffic Source',
    icon: TrendingUp,
    color: 'green',
    description: 'Check where user came from (organic, paid, social)',
    implemented: true, // ✅ Referrer condition: seentics-automation.js:84
  },
  {
    type: 'conditionNode',
    subtype: 'cookie',
    label: 'Cookie Value',
    icon: Cookie,
    color: 'orange',
    description: 'Check if specific cookie exists/value',
    implemented: true, // ✅ Browser API accessible
  },
];

export const ACTION_TYPES = [
  // 🔥 HIGH IMPACT UI ACTIONS
  {
    type: 'actionNode',
    subtype: 'modal',
    label: 'Show Modal',
    icon: Square,
    color: 'pink',
    description: 'Display a popup modal to the user',
    implemented: true,
    priority: 'high',
  },
  {
    type: 'actionNode',
    subtype: 'banner',
    label: 'Show Banner',
    icon: BarChart3,
    color: 'amber',
    description: 'Show a persistent banner message',
    implemented: true,
    priority: 'high',
  },
  {
    type: 'actionNode',
    subtype: 'notification',
    label: 'Toast Notification',
    icon: Bell,
    color: 'orange',
    description: 'Show toast notification in the browser',
    implemented: true,
    priority: 'high',
  },
  {
    type: 'actionNode',
    subtype: 'redirect',
    label: 'Redirect User',
    icon: Zap,
    color: 'blue',
    description: 'Redirect user to another URL',
    implemented: true,
    priority: 'high',
  },
  
  // 📧 COMMUNICATION ACTIONS
  {
    type: 'actionNode',
    subtype: 'email',
    label: 'Send Email',
    icon: Mail,
    color: 'cyan',
    description: 'Send an automated email to user or team',
    implemented: true,
    priority: 'high',
  },
  {
    type: 'actionNode',
    subtype: 'webhook',
    label: 'Call Webhook',
    icon: Globe,
    color: 'purple',
    description: 'Send an outgoing webhook request',
    implemented: true,
    priority: 'high',
  },
  
  // 🎨 ELEMENT MANIPULATION
  {
    type: 'actionNode',
    subtype: 'hideElement',
    label: 'Hide Element',
    icon: EyeOff,
    color: 'slate',
    description: 'Hide a specific element on the page',
    implemented: true,
    priority: 'medium',
  },
  {
    type: 'actionNode',
    subtype: 'showElement',
    label: 'Show Element',
    icon: Eye,
    color: 'lime',
    description: 'Show a previously hidden element',
    implemented: true,
    priority: 'medium',
  },
  
  // ⚙️ ADVANCED ACTIONS
  {
    type: 'actionNode',
    subtype: 'trackEvent',
    label: 'Track Event',
    icon: Activity,
    color: 'violet',
    description: 'Send a custom event to analytics',
    implemented: true,
    priority: 'medium',
  },
  {
    type: 'actionNode',
    subtype: 'setCookie',
    label: 'Set Cookie',
    icon: Cookie,
    color: 'yellow',
    description: 'Set a browser cookie with value',
    implemented: true,
    priority: 'medium',
  },
  {
    type: 'actionNode',
    subtype: 'javascript',
    label: 'Execute JavaScript',
    icon: Code2,
    color: 'rose',
    description: 'Run custom JavaScript code',
    implemented: true,
    priority: 'low',
  },
  {
    type: 'actionNode',
    subtype: 'slack',
    label: 'Slack Message',
    icon: MessageSquare,
    color: 'indigo',
    description: 'Post a message to a Slack channel',
    implemented: false,
    priority: 'low',
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
  const filteredLogic = LOGIC_TYPES.filter((l) =>
    l.label.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredActions = ACTION_TYPES.filter((a) =>
    a.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get custom nodes by category
  const customTriggers = customNodes.filter(node => node.category === 'trigger');
  const customConditions = customNodes.filter(node => node.category === 'condition');
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
      className={`p-3 rounded-lg border transition-all ${
        item.implemented
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
    <aside className="w-[340px] h-full border-l border-slate-800 bg-slate-900/40 backdrop-blur-xl flex flex-col overflow-hidden">
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
        <div className="px-4 pt-3">
          <TabsList className="w-full bg-slate-900/50 border border-slate-800 p-0.5 h-9">
            <TabsTrigger value="triggers" className="flex-1 text-[11px] font-semibold data-[state=active]:bg-primary data-[state=active]:text-white">
              Triggers
            </TabsTrigger>
            <TabsTrigger value="logic" className="flex-1 text-[11px] font-semibold data-[state=active]:bg-primary data-[state=active]:text-white">
              Logic
            </TabsTrigger>
            <TabsTrigger value="actions" className="flex-1 text-[11px] font-semibold data-[state=active]:bg-primary data-[state=active]:text-white">
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

          <TabsContent value="logic" className="m-0 mt-0 space-y-2.5">
            <div className="space-y-2.5">
              {customConditions.length > 0 && (
                <>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-2 py-1">Custom Conditions</div>
                  {customConditions.map((condition) => (
                    <div
                      key={condition.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, 'logicNode', condition.name, condition.description, condition.id)}
                      className="group relative cursor-move p-3 rounded-xl border-2 border-slate-800 hover:border-purple-500/40 bg-slate-900/60 hover:bg-slate-900 transition-all duration-200"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-lg flex items-center justify-center text-2xl" style={{ backgroundColor: condition.color + '20' }}>
                          {condition.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[13px] font-bold text-white mb-0.5">{condition.name}</h4>
                          <p className="text-[10px] text-slate-500 leading-relaxed">{condition.description}</p>
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
              
              {filteredLogic.map((logic, idx) => (
                <NodeItem key={idx} item={logic} type={logic.type} subtype={logic.subtype} />
              ))}
              {filteredLogic.length === 0 && customConditions.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-xs text-slate-600">No logic nodes found</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="actions" className="m-0 mt-0 space-y-2.5">
            
            <div className="space-y-2.5">
              {customActions.length > 0 && (
                <>
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
                  <div className="h-2" />
                </>
              )}
              
              {filteredActions.map((action, idx) => (
                <NodeItem key={idx} item={action} type={action.type} subtype={action.subtype} />
              ))}
              {filteredActions.length === 0 && customActions.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-xs text-slate-600">No actions found</p>
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
        defaultCategory={customNodeCategory}
      />
    </aside>
  );
};
