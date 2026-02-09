'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings2, 
  Zap, 
  Trash2, 
  Info,
  ChevronRight,
  Save,
  MessageCircle,
  Mail,
  Bell,
  Globe,
  Database,
  Code2,
  Clock,
  Play,
  DollarSign,
  User,
  MapPin,
  Calendar,
  Hash,
  Type,
  Braces,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAutomationStore } from '@/stores/automationStore';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { FrequencyControl } from './FrequencyControl';

interface NodeConfigModalProps {
  node: any;
  onClose: () => void;
}

// Dynamic Variable Helper Component
const VariableHelper = ({ onInsert }: { onInsert: (variable: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const variableGroups = [
    {
      category: 'User Data',
      icon: User,
      variables: [
        { name: '{{user_id}}', description: 'Unique user identifier' },
        { name: '{{user_email}}', description: 'User email address' },
        { name: '{{user_name}}', description: 'User display name' },
        { name: '{{user_ip}}', description: 'User IP address' },
        { name: '{{user_country}}', description: 'User country' },
        { name: '{{user_city}}', description: 'User city' },
        { name: '{{user_language}}', description: 'Browser language' },
        { name: '{{user_timezone}}', description: 'User timezone' },
      ]
    },
    {
      category: 'Session Data',
      icon: Database,
      variables: [
        { name: '{{session_id}}', description: 'Current session ID' },
        { name: '{{page_views}}', description: 'Pages viewed in session' },
        { name: '{{time_on_site}}', description: 'Total time on site (seconds)' },
        { name: '{{referrer}}', description: 'Referrer URL' },
        { name: '{{utm_source}}', description: 'UTM source parameter' },
        { name: '{{utm_medium}}', description: 'UTM medium parameter' },
        { name: '{{utm_campaign}}', description: 'UTM campaign parameter' },
      ]
    },
    {
      category: 'Page Data',
      icon: Globe,
      variables: [
        { name: '{{page_url}}', description: 'Current page URL' },
        { name: '{{page_title}}', description: 'Current page title' },
        { name: '{{page_path}}', description: 'Current page path' },
        { name: '{{scroll_depth}}', description: 'Current scroll percentage' },
      ]
    },
    {
      category: 'Device Data',
      icon: Type,
      variables: [
        { name: '{{device_type}}', description: 'mobile/desktop/tablet' },
        { name: '{{browser}}', description: 'Browser name' },
        { name: '{{os}}', description: 'Operating system' },
        { name: '{{screen_width}}', description: 'Screen width in pixels' },
        { name: '{{screen_height}}', description: 'Screen height in pixels' },
      ]
    },
    {
      category: 'Timestamp Data',
      icon: Calendar,
      variables: [
        { name: '{{timestamp}}', description: 'Current timestamp (Unix)' },
        { name: '{{date}}', description: 'Current date (YYYY-MM-DD)' },
        { name: '{{time}}', description: 'Current time (HH:MM:SS)' },
        { name: '{{day_of_week}}', description: 'Day of week (Monday-Sunday)' },
      ]
    },
    {
      category: 'Funnel/Goal Data',
      icon: DollarSign,
      variables: [
        { name: '{{funnel_id}}', description: 'Current funnel ID' },
        { name: '{{funnel_step}}', description: 'Current funnel step' },
        { name: '{{goal_id}}', description: 'Completed goal ID' },
        { name: '{{goal_value}}', description: 'Goal value/revenue' },
        { name: '{{conversion_value}}', description: 'Conversion amount' },
      ]
    },
  ];

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs font-bold bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white"
      >
        <Braces size={14} className="mr-1" />
        Insert Variable
      </Button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[500px] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 max-h-[400px] overflow-y-auto">
          <div className="p-3 border-b border-slate-800 bg-slate-800/50">
            <h4 className="text-xs font-black text-white uppercase tracking-wider">Available Variables</h4>
            <p className="text-[10px] text-slate-400 mt-1">Click to insert dynamic data into your configuration</p>
          </div>
          
          <div className="p-2">
            {variableGroups.map((group, idx) => (
              <div key={idx} className="mb-3">
                <div className="flex items-center gap-2 px-2 py-1 mb-1">
                  <group.icon size={12} className="text-slate-500" />
                  <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{group.category}</h5>
                </div>
                <div className="space-y-0.5">
                  {group.variables.map((variable, vidx) => (
                    <button
                      key={vidx}
                      type="button"
                      onClick={() => {
                        onInsert(variable.name);
                        setIsOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <code className="text-xs font-mono text-amber-400 group-hover:text-amber-300">{variable.name}</code>
                        <ChevronRight size={12} className="text-slate-600 group-hover:text-slate-400" />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">{variable.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          <div className="p-3 border-t border-slate-800 bg-slate-800/30">
            <p className="text-[10px] text-slate-400">
              💡 Tip: Variables are replaced with real data when the automation runs
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export const NodeConfigModal = ({ node, onClose }: NodeConfigModalProps) => {
  const { updateNode, deleteNode } = useAutomationStore();
  const [localData, setLocalData] = useState({
    label: node.data.label || '',
    description: node.data.description || '',
    config: {
      ...node.data.config
    },
  });

  // Declare all refs at top level to comply with React Hooks rules
  const modalTitleRef = useRef<HTMLInputElement>(null);
  const modalContentRef = useRef<HTMLTextAreaElement>(null);
  const modalButtonRef = useRef<HTMLInputElement>(null);
  const bannerContentRef = useRef<HTMLTextAreaElement>(null);
  const bannerButtonRef = useRef<HTMLInputElement>(null);
  const notificationTitleRef = useRef<HTMLInputElement>(null);
  const notificationMessageRef = useRef<HTMLTextAreaElement>(null);
  const recipientRef = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const emailSubjectRef = useRef<HTMLInputElement>(null);
  const emailBodyRef = useRef<HTMLTextAreaElement>(null);
  const scriptCodeRef = useRef<HTMLTextAreaElement>(null);
  const webhookUrlRef = useRef<HTMLInputElement>(null);
  const redirectUrlRef = useRef<HTMLInputElement>(null);
  const hideElementSelectorRef = useRef<HTMLInputElement>(null);

  const updateConfig = (key: string, value: any) => {
    setLocalData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [key]: value
      }
    }));
  };

  // Helper to insert variable at cursor position
  const insertVariable = (inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>, variable: string) => {
    const input = inputRef.current;
    if (!input) return;
    
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const currentValue = input.value;
    const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end);
    
    // Update the config with new value
    const configKey = input.name || input.id;
    if (configKey) {
      updateConfig(configKey, newValue);
    }
  };

  // Keep local state in sync if node prop changes (though usually handled by mount/unmount)
  useEffect(() => {
    setLocalData({
      label: node.data.label || '',
      description: node.data.description || '',
      config: node.data.config || {},
    });
  }, [node]);

  const handleUpdate = () => {
    updateNode(node.id, localData);
    onClose();
  };

  const handleDelete = () => {
    deleteNode(node.id);
    onClose();
  };

  const typeLabel = node.type.replace('Node', '');
  const subtype = node.data.config?.triggerType || node.data.config?.actionType || node.data.config?.conditionType || node.subtype;

  const renderConfigFields = () => {
    // Page View Trigger
    if (node.type === 'pageView' || (node.type === 'triggerNode' && subtype === 'pageView')) {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Target URL Pattern</Label>
            <Input 
              value={localData.config.url_pattern || ''}
              onChange={(e) => updateConfig('url_pattern', e.target.value)}
              placeholder="e.g. /pricing or /blog/*"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
            <p className="text-[10px] text-slate-500">Use * for wildcard matching. Leave empty for all pages.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Frequency Control</Label>
            <Select 
              value={localData.config.frequency || 'always'}
              onValueChange={(val) => updateConfig('frequency', val)}
            >
              <SelectTrigger className="bg-slate-900/50 border-slate-800 h-11 text-white">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                <SelectItem value="always">Always trigger (Every page view)</SelectItem>
                <SelectItem value="once_per_session">Once per session</SelectItem>
                <SelectItem value="once_per_visitor">Once per visitor</SelectItem>
                <SelectItem value="once_per_day">Once per day</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-slate-500">Controls how often this automation can run for a single user.</p>
          </div>
        </div>
      );
    }

    // Button Click Trigger
    if (node.type === 'triggerNode' && subtype === 'click') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Element Selector (CSS)</Label>
            <Input 
              value={localData.config.selector || ''}
              onChange={(e) => updateConfig('selector', e.target.value)}
              placeholder="e.g. #signup-btn or .cta-button"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
            <p className="text-[10px] text-slate-500">The CSS selector of the button or link to track.</p>
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Target Page (Optional)</Label>
            <Input 
              value={localData.config.url_pattern || ''}
              onChange={(e) => updateConfig('url_pattern', e.target.value)}
              placeholder="e.g. /landing-page"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
          </div>
          <FrequencyControl
            value={localData.config.frequency || ''}
            onChange={(val) => updateConfig('frequency', val)}
            triggerType="click"
          />
        </div>
      );
    }

    // Scroll Depth Trigger
    if (node.type === 'triggerNode' && subtype === 'scroll') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Scroll Percentage (%)</Label>
            <div className="flex items-center gap-4">
               <Input 
                type="number"
                min="1"
                max="100"
                value={localData.config.percentage || '50'}
                onChange={(e) => updateConfig('percentage', e.target.value)}
                className="bg-slate-900/50 border-slate-800 h-11 text-white w-24"
              />
              <Slider 
                value={[parseInt(localData.config.percentage) || 50]} 
                onValueChange={([val]) => updateConfig('percentage', val)}
                max={100}
                step={10}
                className="flex-1"
              />
            </div>
            <p className="text-[10px] text-slate-500">Trigger when user scrolls past this point on the page.</p>
          </div>
          <FrequencyControl
            value={localData.config.frequency || ''}
            onChange={(val) => updateConfig('frequency', val)}
            triggerType="scroll"
          />
        </div>
      );
    }

    // Custom Event Trigger
    if (node.type === 'triggerNode' && subtype === 'customEvent') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Event Name</Label>
            <Input 
              value={localData.config.event_name || ''}
              onChange={(e) => updateConfig('event_name', e.target.value)}
              placeholder="e.g. form_submit or purchase"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
            <p className="text-[10px] text-slate-500">The name of the custom event that will fire this automation.</p>
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Property Requirement (Optional)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input 
                value={localData.config.event_key || ''}
                onChange={(e) => updateConfig('event_key', e.target.value)}
                placeholder="Key (e.g. plan)"
                className="bg-slate-900/50 border-slate-800 h-11 text-white text-xs"
              />
              <Input 
                value={localData.config.event_value || ''}
                onChange={(e) => updateConfig('event_value', e.target.value)}
                placeholder="Value (e.g. pro)"
                className="bg-slate-900/50 border-slate-800 h-11 text-white text-xs"
              />
            </div>
          </div>
          <FrequencyControl
            value={localData.config.frequency || ''}
            onChange={(val) => updateConfig('frequency', val)}
            triggerType="customEvent"
          />
        </div>
      );
    }

    // Time on Page Trigger
    if (node.type === 'triggerNode' && subtype === 'timeOnPage') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Time Duration (seconds)</Label>
            <div className="flex items-center gap-4">
              <Input 
                type="number"
                min="1"
                value={localData.config.seconds || '10'}
                onChange={(e) => updateConfig('seconds', e.target.value)}
                className="bg-slate-900/50 border-slate-800 h-11 text-white w-32"
              />
              <span className="text-slate-400 text-sm">seconds</span>
            </div>
            <p className="text-[10px] text-slate-500">Trigger after user spends this much time on the page.</p>
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Target Page (Optional)</Label>
            <Input 
              value={localData.config.url_pattern || ''}
              onChange={(e) => updateConfig('url_pattern', e.target.value)}
              placeholder="e.g. /pricing"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
          </div>
          <FrequencyControl
            value={localData.config.frequency || ''}
            onChange={(val) => updateConfig('frequency', val)}
            triggerType="timeOnPage"
          />
        </div>
      );
    }

    // Exit Intent Trigger
    if (node.type === 'triggerNode' && subtype === 'exitIntent') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Target Page (Optional)</Label>
            <Input 
              value={localData.config.url_pattern || ''}
              onChange={(e) => updateConfig('url_pattern', e.target.value)}
              placeholder="e.g. /checkout or leave empty for all pages"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Frequency Control</Label>
            <Select 
              value={localData.config.frequency || 'once_per_session'}
              onValueChange={(val) => updateConfig('frequency', val)}
            >
              <SelectTrigger className="bg-slate-900/50 border-slate-800 h-11 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                <SelectItem value="always">Every exit attempt</SelectItem>
                <SelectItem value="once_per_session">Once per session</SelectItem>
                <SelectItem value="once_per_visitor">Once per visitor (ever)</SelectItem>
                <SelectItem value="once_per_day">Once per day</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
            <p className="text-[10px] text-blue-400">
              💡 Detects when mouse moves towards browser close/back button. Great for exit-intent popups!
            </p>
          </div>
        </div>
      );
    }

    // Form Submit Trigger
    if (node.type === 'triggerNode' && subtype === 'formSubmit') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Form Selector (CSS)</Label>
            <Input 
              value={localData.config.selector || ''}
              onChange={(e) => updateConfig('selector', e.target.value)}
              placeholder="e.g. #contact-form or .signup-form"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
            <p className="text-[10px] text-slate-500">Leave empty to track all form submissions.</p>
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Target Page (Optional)</Label>
            <Input 
              value={localData.config.url_pattern || ''}
              onChange={(e) => updateConfig('url_pattern', e.target.value)}
              placeholder="e.g. /contact"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
          </div>
          <FrequencyControl
            value={localData.config.frequency || ''}
            onChange={(val) => updateConfig('frequency', val)}
            triggerType="formSubmit"
          />
        </div>
      );
    }

    // Inactivity Trigger
    if (node.type === 'triggerNode' && subtype === 'inactivity') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Inactivity Duration (seconds)</Label>
            <Input 
              type="number"
              min="5"
              value={localData.config.seconds || '30'}
              onChange={(e) => updateConfig('seconds', e.target.value)}
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
            <p className="text-[10px] text-slate-500">Trigger after this many seconds of no mouse/keyboard activity.</p>
          </div>
          <FrequencyControl
            value={localData.config.frequency || ''}
            onChange={(val) => updateConfig('frequency', val)}
            triggerType="inactivity"
          />
        </div>
      );
    }

    // Funnel Drop-off Trigger
    if (node.type === 'triggerNode' && subtype === 'funnelDropoff') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Funnel Name/ID</Label>
            <Input 
              value={localData.config.funnel_id || ''}
              onChange={(e) => updateConfig('funnel_id', e.target.value)}
              placeholder="e.g. checkout-funnel or funnel_123"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
            <p className="text-[10px] text-slate-500">The funnel to monitor for drop-offs.</p>
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Drop-off Step (Optional)</Label>
            <Input 
              value={localData.config.step || ''}
              onChange={(e) => updateConfig('step', e.target.value)}
              placeholder="e.g. payment or step-2"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
            <p className="text-[10px] text-slate-500">Leave empty to trigger on any step drop-off.</p>
          </div>
          <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5">
            <p className="text-[10px] text-rose-400">
              🎯 Perfect for recovery campaigns! Trigger when users abandon your funnel.
            </p>
          </div>
          <FrequencyControl
            value={localData.config.frequency || ''}
            onChange={(val) => updateConfig('frequency', val)}
            triggerType="funnelDropoff"
          />
        </div>
      );
    }

    // Funnel Completed Trigger
    if (node.type === 'triggerNode' && subtype === 'funnelComplete') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Funnel Name/ID</Label>
            <Input 
              value={localData.config.funnel_id || ''}
              onChange={(e) => updateConfig('funnel_id', e.target.value)}
              placeholder="e.g. signup-funnel or funnel_456"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
            <p className="text-[10px] text-slate-500">The funnel that was completed.</p>
          </div>
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
            <p className="text-[10px] text-emerald-400">
              🎉 Celebrate conversions! Send thank you messages or track success.
            </p>
          </div>
          <FrequencyControl
            value={localData.config.frequency || ''}
            onChange={(val) => updateConfig('frequency', val)}
            triggerType="funnelComplete"
          />
        </div>
      );
    }

    // Goal Completed Trigger
    if (node.type === 'triggerNode' && subtype === 'goalCompleted') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Goal Name/ID</Label>
            <Input 
              value={localData.config.goal_id || ''}
              onChange={(e) => updateConfig('goal_id', e.target.value)}
              placeholder="e.g. newsletter_signup or goal_789"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
            <p className="text-[10px] text-slate-500">The analytics goal that was reached.</p>
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Minimum Goal Value (Optional)</Label>
            <Input 
              type="number"
              value={localData.config.min_value || ''}
              onChange={(e) => updateConfig('min_value', e.target.value)}
              placeholder="e.g. 100"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
            <p className="text-[10px] text-slate-500">Only trigger if goal value is above this amount.</p>
          </div>
        </div>
      );
    }

    // Email Action
    if (node.type === 'actionNode' && subtype === 'email') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Recipient Email</Label>
              <VariableHelper onInsert={(v) => insertVariable(recipientRef, v)} />
            </div>
            <Input
              ref={recipientRef}
              name="recipient"
              value={localData.config.recipient || ''}
              onChange={(e) => updateConfig('recipient', e.target.value)}
              placeholder="e.g. admin@example.com or {{user_email}}"
              className="bg-slate-900/50 border-slate-800 h-11 text-white font-mono text-sm"
            />
            <p className="text-[10px] text-slate-500">Use variables like {{user_email}} for dynamic recipients</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Subject Line</Label>
              <VariableHelper onInsert={(v) => insertVariable(subjectRef, v)} />
            </div>
            <Input
              ref={subjectRef}
              name="subject"
              value={localData.config.subject || ''}
              onChange={(e) => updateConfig('subject', e.target.value)}
              placeholder="e.g. Hello {{user_name}}!"
              className="bg-slate-900/50 border-slate-800 h-11 text-white font-mono text-sm"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Email Body</Label>
              <VariableHelper onInsert={(v) => insertVariable(bodyRef, v)} />
            </div>
            <Textarea
              ref={bodyRef}
              name="body"
              value={localData.config.body || ''}
              onChange={(e) => updateConfig('body', e.target.value)}
              placeholder="Hi {{user_name}},\n\nYour order #{{order_id}} is confirmed!\n\nThanks!"
              className="bg-slate-900/50 border-slate-800 min-h-[150px] text-white font-mono text-sm"
            />
          </div>
          <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5">
            <p className="text-[10px] text-blue-400 flex items-start gap-2">
              <Info size={12} className="mt-0.5 flex-shrink-0" />
              <span>All {{variables}} will be replaced with real user data when the automation runs.</span>
            </p>
          </div>
        </div>
      );
    }

    // Webhook Action
    if ((node.type === 'actionNode' || node.type === 'webhook') && (subtype === 'webhook' || node.type === 'webhook')) {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Endpoint URL</Label>
            <Input 
              value={localData.config.url || ''}
              onChange={(e) => updateConfig('url', e.target.value)}
              placeholder="https://api.myapp.com/webhook"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">HTTP Method</Label>
            <Select 
              value={localData.config.method || 'POST'}
              onValueChange={(val) => updateConfig('method', val)}
            >
              <SelectTrigger className="bg-slate-900/50 border-slate-800 h-11 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="PATCH">PATCH</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/20">
            <div>
              <Label className="text-sm font-bold text-white">Include Payload</Label>
              <p className="text-[10px] text-slate-500">Send event data as JSON body</p>
            </div>
            <Switch 
              checked={localData.config.include_payload !== false}
              onCheckedChange={(val) => updateConfig('include_payload', val)}
            />
          </div>
        </div>
      );
    }

    // Modal Action
    if (node.type === 'actionNode' && subtype === 'modal') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Modal Title</Label>
              <VariableHelper onInsert={(variable) => insertVariable(modalTitleRef, 'title', variable)} />
            </div>
            <Input 
              ref={modalTitleRef}
              value={localData.config.title || ''}
              onChange={(e) => updateConfig('title', e.target.value)}
              placeholder="e.g. Hi {{user_name}}, Special Offer!"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Modal Content</Label>
              <VariableHelper onInsert={(variable) => insertVariable(modalContentRef, 'content', variable)} />
            </div>
            <Textarea 
              ref={modalContentRef}
              value={localData.config.content || ''}
              onChange={(e) => updateConfig('content', e.target.value)}
              placeholder="Welcome {{user_name}} from {{user_city}}!"
              className="bg-slate-900/50 border-slate-800 min-h-[100px] text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Primary Button Text</Label>
                <VariableHelper onInsert={(variable) => insertVariable(modalButtonRef, 'primaryButton', variable)} />
              </div>
              <Input 
                ref={modalButtonRef}
                value={localData.config.primaryButton || ''}
                onChange={(e) => updateConfig('primaryButton', e.target.value)}
                placeholder="e.g. Get Started"
                className="bg-slate-900/50 border-slate-800 h-11 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Primary Button URL</Label>
              <Input 
                value={localData.config.primaryUrl || ''}
                onChange={(e) => updateConfig('primaryUrl', e.target.value)}
                placeholder="/signup"
                className="bg-slate-900/50 border-slate-800 h-11 text-white"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Custom HTML (Advanced)</Label>
            <Textarea 
              value={localData.config.customHtml || ''}
              onChange={(e) => updateConfig('customHtml', e.target.value)}
              placeholder="<div>Custom HTML content...</div>"
              className="bg-slate-900/50 border-slate-800 min-h-[80px] text-white font-mono text-xs"
            />
          </div>
        </div>
      );
    }

    // Banner Action
    if (node.type === 'actionNode' && subtype === 'banner') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Banner Message</Label>
              <VariableHelper onInsert={(variable) => insertVariable(bannerContentRef, 'content', variable)} />
            </div>
            <Textarea 
              ref={bannerContentRef}
              value={localData.config.content || ''}
              onChange={(e) => updateConfig('content', e.target.value)}
              placeholder="Welcome {{user_name}}! Enjoy your visit from {{user_city}}."
              className="bg-slate-900/50 border-slate-800 min-h-[80px] text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Position</Label>
              <Select 
                value={localData.config.position || 'bottom'}
                onValueChange={(val) => updateConfig('position', val)}
              >
                <SelectTrigger className="bg-slate-900/50 border-slate-800 h-11 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="top">Top</SelectItem>
                  <SelectItem value="bottom">Bottom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Icon/Emoji</Label>
              <Input 
                value={localData.config.icon || ''}
                onChange={(e) => updateConfig('icon', e.target.value)}
                placeholder="e.g. ✨ 🎉 ⚡"
                className="bg-slate-900/50 border-slate-800 h-11 text-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Background Color</Label>
              <Input 
                type="color"
                value={localData.config.backgroundColor || '#0f172a'}
                onChange={(e) => updateConfig('backgroundColor', e.target.value)}
                className="bg-slate-900/50 border-slate-800 h-11"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Text Color</Label>
              <Input 
                type="color"
                value={localData.config.textColor || '#ffffff'}
                onChange={(e) => updateConfig('textColor', e.target.value)}
                className="bg-slate-900/50 border-slate-800 h-11"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Button Text (Optional)</Label>
              <VariableHelper onInsert={(variable) => insertVariable(bannerButtonRef, 'buttonText', variable)} />
            </div>
            <Input 
              ref={bannerButtonRef}
              value={localData.config.primaryButton || ''}
              onChange={(e) => updateConfig('primaryButton', e.target.value)}
              placeholder="e.g. Learn More"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Button URL</Label>
            <Input 
              value={localData.config.primaryUrl || ''}
              onChange={(e) => updateConfig('primaryUrl', e.target.value)}
              placeholder="/learn-more"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Auto-dismiss (seconds, 0 = manual close)</Label>
            <Input 
              type="number"
              min="0"
              value={localData.config.duration || '0'}
              onChange={(e) => updateConfig('duration', e.target.value)}
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
          </div>
        </div>
      );
    }

    // Notification (Toast) Action
    if (node.type === 'actionNode' && subtype === 'notification') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Notification Title</Label>
              <VariableHelper onInsert={(variable) => insertVariable(notificationTitleRef, 'title', variable)} />
            </div>
            <Input 
              ref={notificationTitleRef}
              value={localData.config.title || ''}
              onChange={(e) => updateConfig('title', e.target.value)}
              placeholder="e.g. Hi {{user_name}}!"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Message</Label>
              <VariableHelper onInsert={(variable) => insertVariable(notificationMessageRef, 'message', variable)} />
            </div>
            <Textarea 
              ref={notificationMessageRef}
              value={localData.config.message || ''}
              onChange={(e) => updateConfig('message', e.target.value)}
              placeholder="You've reached {{scroll_depth}}% scroll depth!"
              className="bg-slate-900/50 border-slate-800 min-h-[80px] text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Type</Label>
              <Select 
                value={localData.config.type || 'info'}
                onValueChange={(val) => updateConfig('type', val)}
              >
                <SelectTrigger className="bg-slate-900/50 border-slate-800 h-11 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="success">Success (Green)</SelectItem>
                  <SelectItem value="error">Error (Red)</SelectItem>
                  <SelectItem value="warning">Warning (Yellow)</SelectItem>
                  <SelectItem value="info">Info (Blue)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Position</Label>
              <Select 
                value={localData.config.position || 'top'}
                onValueChange={(val) => updateConfig('position', val)}
              >
                <SelectTrigger className="bg-slate-900/50 border-slate-800 h-11 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="top">Top Right</SelectItem>
                  <SelectItem value="bottom">Bottom Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Duration (seconds)</Label>
            <Input 
              type="number"
              min="1"
              max="30"
              value={localData.config.duration || '5'}
              onChange={(e) => updateConfig('duration', e.target.value)}
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
          </div>
        </div>
      );
    }

    // Redirect Action
    if (node.type === 'actionNode' && subtype === 'redirect') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Redirect URL</Label>
            <Input 
              value={localData.config.url || ''}
              onChange={(e) => updateConfig('url', e.target.value)}
              placeholder="e.g. /thank-you or https://example.com"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
            <p className="text-[10px] text-slate-500">Use relative paths (/page) or full URLs (https://...)</p>
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Delay Before Redirect (seconds)</Label>
            <Input 
              type="number"
              min="0"
              value={localData.config.delay || '0'}
              onChange={(e) => updateConfig('delay', e.target.value)}
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/20">
            <div>
              <Label className="text-sm font-bold text-white">Open in New Tab</Label>
              <p className="text-[10px] text-slate-500">Opens URL in a new browser tab</p>
            </div>
            <Switch 
              checked={localData.config.newTab || false}
              onCheckedChange={(val) => updateConfig('newTab', val)}
            />
          </div>
        </div>
      );
    }

    // JavaScript Action
    if (node.type === 'actionNode' && subtype === 'javascript') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">JavaScript Code</Label>
            <Textarea 
              value={localData.config.code || ''}
              onChange={(e) => updateConfig('code', e.target.value)}
              placeholder="console.log('Hello from automation!');\n// Your code here..."
              className="bg-slate-900/50 border-slate-800 min-h-[200px] text-white font-mono text-xs"
            />
            <p className="text-[10px] text-slate-500">This code will be executed in the browser context.</p>
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Injection Position</Label>
            <Select 
              value={localData.config.position || 'body'}
              onValueChange={(val) => updateConfig('position', val)}
            >
              <SelectTrigger className="bg-slate-900/50 border-slate-800 h-11 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                <SelectItem value="head">Document Head</SelectItem>
                <SelectItem value="body">Document Body (default)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <p className="text-[10px] text-amber-400 flex items-start gap-2">
              <span className="font-bold">⚠️</span>
              <span>Be cautious: This executes arbitrary JavaScript. Test thoroughly before deploying.</span>
            </p>
          </div>
        </div>
      );
    }

    // Hide Element Action
    if (node.type === 'actionNode' && subtype === 'hideElement') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Element Selector (CSS)</Label>
            <Input 
              value={localData.config.selector || ''}
              onChange={(e) => updateConfig('selector', e.target.value)}
              placeholder="e.g. #promo-banner or .popup-ad"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
            <p className="text-[10px] text-slate-500">The CSS selector of the element to hide (sets display: none).</p>
          </div>
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
            <p className="text-[10px] text-blue-400">
              💡 Useful for hiding annoying elements, ads, or customizing the user experience.
            </p>
          </div>
        </div>
      );
    }

    // Show Element Action
    if (node.type === 'actionNode' && subtype === 'showElement') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Element Selector (CSS)</Label>
            <Input 
              value={localData.config.selector || ''}
              onChange={(e) => updateConfig('selector', e.target.value)}
              placeholder="e.g. #hidden-content or .reveal-section"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
            <p className="text-[10px] text-slate-500">The CSS selector of the element to show (sets display: block).</p>
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Display Type</Label>
            <Select 
              value={localData.config.display_type || 'block'}
              onValueChange={(val) => updateConfig('display_type', val)}
            >
              <SelectTrigger className="bg-slate-900/50 border-slate-800 h-11 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                <SelectItem value="block">Block</SelectItem>
                <SelectItem value="flex">Flex</SelectItem>
                <SelectItem value="inline">Inline</SelectItem>
                <SelectItem value="inline-block">Inline Block</SelectItem>
                <SelectItem value="grid">Grid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    // Track Custom Event Action
    if (node.type === 'actionNode' && subtype === 'trackEvent') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Event Name</Label>
            <Input 
              value={localData.config.event_name || ''}
              onChange={(e) => updateConfig('event_name', e.target.value)}
              placeholder="e.g. automation_triggered or special_action"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
            <p className="text-[10px] text-slate-500">This event will be sent to your analytics dashboard.</p>
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Event Properties (JSON)</Label>
            <Textarea 
              value={localData.config.properties || ''}
              onChange={(e) => updateConfig('properties', e.target.value)}
              placeholder='{"action": "completed", "value": 100}'
              className="bg-slate-900/50 border-slate-800 min-h-[100px] text-white font-mono text-xs"
            />
            <p className="text-[10px] text-slate-500">Optional: Custom properties as JSON object.</p>
          </div>
        </div>
      );
    }

    // Set Cookie Action
    if (node.type === 'actionNode' && subtype === 'setCookie') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Cookie Name</Label>
            <Input 
              value={localData.config.cookie_name || ''}
              onChange={(e) => updateConfig('cookie_name', e.target.value)}
              placeholder="e.g. promo_shown or user_preference"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Cookie Value</Label>
            <Input 
              value={localData.config.cookie_value || ''}
              onChange={(e) => updateConfig('cookie_value', e.target.value)}
              placeholder="e.g. true or 2024-02-09"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Expiration (days)</Label>
            <Input 
              type="number"
              min="1"
              value={localData.config.expiration_days || '30'}
              onChange={(e) => updateConfig('expiration_days', e.target.value)}
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
            <p className="text-[10px] text-slate-500">How many days until the cookie expires.</p>
          </div>
        </div>
      );
    }

    // Condition Node - Different configs for each subtype
    if (node.type === 'conditionNode') {
      // Device Check Condition
      if (subtype === 'device') {
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Device Type</Label>
              <Select 
                value={localData.config.device_type || 'mobile'}
                onValueChange={(val) => updateConfig('device_type', val)}
              >
                <SelectTrigger className="bg-slate-900/50 border-slate-800 h-11 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="tablet">Tablet</SelectItem>
                  <SelectItem value="desktop">Desktop</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-slate-500">Workflow continues if user is on this device type</p>
            </div>
          </div>
        );
      }

      // Visitor Status Condition
      if (subtype === 'visitor') {
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Visitor Type</Label>
              <Select 
                value={localData.config.visitor_type || 'new'}
                onValueChange={(val) => updateConfig('visitor_type', val)}
              >
                <SelectTrigger className="bg-slate-900/50 border-slate-800 h-11 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="new">New Visitor</SelectItem>
                  <SelectItem value="returning">Returning Visitor</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-slate-500">Workflow continues based on visitor status</p>
            </div>
          </div>
        );
      }

      // URL Parameter Condition
      if (subtype === 'url_param') {
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Parameter Name</Label>
              <Input 
                value={localData.config.param_name || ''}
                onChange={(e) => updateConfig('param_name', e.target.value)}
                placeholder="e.g. utm_source or ref"
                className="bg-slate-900/50 border-slate-800 h-11 text-white"
              />
              <p className="text-[10px] text-slate-500">The URL parameter to check for</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Operator</Label>
                <Select 
                  value={localData.config.operator || 'equals'}
                  onValueChange={(val) => updateConfig('operator', val)}
                >
                  <SelectTrigger className="bg-slate-900/50 border-slate-800 h-11 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    <SelectItem value="equals">Equals</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="exists">Exists</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Value</Label>
                <Input 
                  value={localData.config.param_value || ''}
                  onChange={(e) => updateConfig('param_value', e.target.value)}
                  placeholder="e.g. google"
                  className="bg-slate-900/50 border-slate-800 h-11 text-white"
                  disabled={localData.config.operator === 'exists'}
                />
              </div>
            </div>
          </div>
        );
      }

      // Page View Count Condition
      if (subtype === 'page_views') {
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Operator</Label>
                <Select 
                  value={localData.config.operator || 'gt'}
                  onValueChange={(val) => updateConfig('operator', val)}
                >
                  <SelectTrigger className="bg-slate-900/50 border-slate-800 h-11 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    <SelectItem value="gt">Greater than</SelectItem>
                    <SelectItem value="lt">Less than</SelectItem>
                    <SelectItem value="eq">Equals</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Number of Pages</Label>
                <Input 
                  type="number"
                  min="1"
                  value={localData.config.count || '3'}
                  onChange={(e) => updateConfig('count', e.target.value)}
                  className="bg-slate-900/50 border-slate-800 h-11 text-white"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500">Check how many pages the visitor has viewed in this session.</p>
          </div>
        );
      }

      // Traffic Source Condition
      if (subtype === 'traffic_source') {
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Traffic Source Type</Label>
              <Select 
                value={localData.config.source_type || 'any'}
                onValueChange={(val) => updateConfig('source_type', val)}
              >
                <SelectTrigger className="bg-slate-900/50 border-slate-800 h-11 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="any">Any source</SelectItem>
                  <SelectItem value="direct">Direct (no referrer)</SelectItem>
                  <SelectItem value="organic">Organic Search (Google, Bing)</SelectItem>
                  <SelectItem value="social">Social Media</SelectItem>
                  <SelectItem value="paid">Paid Advertising</SelectItem>
                  <SelectItem value="referral">Referral (other websites)</SelectItem>
                  <SelectItem value="custom">Custom domain check</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {localData.config.source_type === 'custom' && (
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Domain/Keyword to Match</Label>
                <Input 
                  value={localData.config.custom_value || ''}
                  onChange={(e) => updateConfig('custom_value', e.target.value)}
                  placeholder="e.g. facebook.com or utm_medium=cpc"
                  className="bg-slate-900/50 border-slate-800 h-11 text-white"
                />
              </div>
            )}
          </div>
        );
      }

      // Cookie Condition
      if (subtype === 'cookie') {
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Cookie Name</Label>
              <Input 
                value={localData.config.cookie_name || ''}
                onChange={(e) => updateConfig('cookie_name', e.target.value)}
                placeholder="e.g. user_preference or promo_shown"
                className="bg-slate-900/50 border-slate-800 h-11 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Operator</Label>
                <Select 
                  value={localData.config.operator || 'exists'}
                  onValueChange={(val) => updateConfig('operator', val)}
                >
                  <SelectTrigger className="bg-slate-900/50 border-slate-800 h-11 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    <SelectItem value="exists">Exists</SelectItem>
                    <SelectItem value="not_exists">Does not exist</SelectItem>
                    <SelectItem value="equals">Equals value</SelectItem>
                    <SelectItem value="contains">Contains value</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Value (if checking)</Label>
                <Input 
                  value={localData.config.cookie_value || ''}
                  onChange={(e) => updateConfig('cookie_value', e.target.value)}
                  placeholder="expected value"
                  className="bg-slate-900/50 border-slate-800 h-11 text-white"
                  disabled={['exists', 'not_exists'].includes(localData.config.operator || 'exists')}
                />
              </div>
            </div>
          </div>
        );
      }

      // Generic If/Else Condition
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Property to Check</Label>
            <Input 
              value={localData.config.property || ''}
              onChange={(e) => updateConfig('property', e.target.value)}
              placeholder="e.g. browser, country, or custom_var"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Operator</Label>
              <Select 
                value={localData.config.operator || 'equals'}
                onValueChange={(val) => updateConfig('operator', val)}
              >
                <SelectTrigger className="bg-slate-900/50 border-slate-800 h-11 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="equals">Equals</SelectItem>
                  <SelectItem value="not_equals">Does not equal</SelectItem>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="starts_with">Starts with</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Value</Label>
              <Input 
                value={localData.config.value || ''}
                onChange={(e) => updateConfig('value', e.target.value)}
                placeholder="e.g. Chrome"
                className="bg-slate-900/50 border-slate-800 h-11 text-white"
              />
            </div>
          </div>
        </div>
      );
    }

    // Wait Action
    if (node.type === 'actionNode' && subtype === 'wait') {
      return (
        <div className="space-y-6">
           <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Delay Duration</Label>
            <div className="flex gap-2">
              <Input 
                type="number"
                value={localData.config.delay_value || '1'}
                onChange={(e) => updateConfig('delay_value', e.target.value)}
                className="bg-slate-900/50 border-slate-800 h-11 text-white w-24"
              />
              <Select 
                value={localData.config.delay_unit || 'minutes'}
                onValueChange={(val) => updateConfig('delay_unit', val)}
              >
                <SelectTrigger className="bg-slate-900/50 border-slate-800 h-11 text-white flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="seconds">Seconds</SelectItem>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="p-8 border-2 border-dashed border-slate-800 rounded-2xl text-center space-y-4">
        <div className="h-12 w-12 bg-slate-900 rounded-xl flex items-center justify-center mx-auto text-slate-500">
           <Code2 size={24} />
        </div>
        <div>
          <h3 className="text-white font-bold">No Special Config</h3>
          <p className="text-xs text-slate-500">This node uses standard execution logic. No additional fields required.</p>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[550px] bg-slate-900/95 border-slate-800 p-0 overflow-hidden shadow-2xl backdrop-blur-xl">
        <DialogHeader className="p-6 border-b border-slate-800 bg-slate-800/50">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
               <Settings2 size={24} />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-white tracking-tight">Configure {typeLabel} Step</DialogTitle>
              <DialogDescription className="text-slate-500 font-medium">
                Adjust step settings and business logic
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {renderConfigFields()}
        </div>

        <DialogFooter className="p-6 border-t border-slate-800 bg-slate-900/20 flex flex-row items-center justify-between gap-4">
          <Button 
            variant="ghost" 
            className="text-slate-500 hover:text-red-500 hover:bg-red-500/5 font-bold text-xs"
            onClick={handleDelete}
          >
            <Trash2 size={16} className="mr-2" />
            Delete Step
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" className="text-slate-400 font-bold text-xs" onClick={onClose}>Cancel</Button>
            <Button className="bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-widest px-6" onClick={handleUpdate}>
              <Save size={16} className="mr-2" />
              Save Step
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
