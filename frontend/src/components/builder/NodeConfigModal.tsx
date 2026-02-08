'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings2, 
  Zap, 
  Trash2, 
  Info,
  ChevronRight,
  ShieldCheck,
  Save,
  MessageCircle,
  Mail,
  Bell,
  Globe,
  Database,
  Code2,
  Clock,
  Play
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

interface NodeConfigModalProps {
  node: any;
  onClose: () => void;
}

export const NodeConfigModal = ({ node, onClose }: NodeConfigModalProps) => {
  const { updateNode, deleteNode } = useAutomationStore();
  const [localData, setLocalData] = useState({
    label: node.data.label || '',
    description: node.data.description || '',
    config: {
      ...node.data.config
    },
  });

  const updateConfig = (key: string, value: any) => {
    setLocalData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [key]: value
      }
    }));
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
        </div>
      );
    }

    // Email Action
    if (node.type === 'actionNode' && subtype === 'email') {
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Recipient Email</Label>
            <Input 
              value={localData.config.recipient || ''}
              onChange={(e) => updateConfig('recipient', e.target.value)}
              placeholder="e.g. admin@example.com or {{user_email}}"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Subject Line</Label>
            <Input 
              value={localData.config.subject || ''}
              onChange={(e) => updateConfig('subject', e.target.value)}
              placeholder="e.g. New conversion detected!"
              className="bg-slate-900/50 border-slate-800 h-11 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Email Body</Label>
            <Textarea 
              value={localData.config.body || ''}
              onChange={(e) => updateConfig('body', e.target.value)}
              placeholder="Write your message here... Use {{name}} for variables."
              className="bg-slate-900/50 border-slate-800 min-h-[120px] text-white"
            />
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

    // Condition Node
    if (node.type === 'conditionNode') {
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
      <DialogContent className="sm:max-w-[550px] bg-gray-900 border-slate-800 p-0 overflow-hidden shadow-2xl backdrop-blur-3xl">
        <DialogHeader className="p-6 border-b border-slate-800 bg-gray-800/50">
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
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full bg-slate-900/50 border border-slate-800 mb-6">
              <TabsTrigger value="general" className="flex-1 text-xs font-black uppercase tracking-widest">General</TabsTrigger>
              <TabsTrigger value="config" className="flex-1 text-xs font-black uppercase tracking-widest">Settings</TabsTrigger>
              <TabsTrigger value="advanced" className="flex-1 text-xs font-black uppercase tracking-widest">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Step Label</Label>
                <Input 
                  value={localData.label}
                  onChange={(e) => setLocalData({ ...localData, label: e.target.value })}
                  placeholder="e.g. Welcome Email Trigger"
                  className="bg-slate-900/50 border-slate-800 h-11 text-white focus:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Internal Note / Description</Label>
                <Textarea 
                  value={localData.description}
                  onChange={(e) => setLocalData({ ...localData, description: e.target.value })}
                  placeholder="Explain what this step does for your team..."
                  className="bg-slate-900/50 border-slate-800 min-h-[100px] text-white focus:ring-primary/20"
                />
              </div>
            </TabsContent>

            <TabsContent value="config" className="space-y-6 animate-in fade-in duration-300">
               {renderConfigFields()}
            </TabsContent>

            <TabsContent value="advanced" className="space-y-6">
               <div className="space-y-4">
                 <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/20">
                   <div className="flex items-center gap-3">
                     <ShieldCheck className="text-emerald-500" size={18} />
                     <div>
                       <p className="text-sm font-bold text-white">Retry Logic</p>
                       <p className="text-[10px] text-slate-500">Auto-retry on failure</p>
                     </div>
                   </div>
                   <div className="h-5 w-10 bg-emerald-500 rounded-full flex items-center px-1">
                     <div className="h-3.5 w-3.5 bg-white rounded-full translate-x-4 transition-transform" />
                   </div>
                 </div>
               </div>
            </TabsContent>
          </Tabs>
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
