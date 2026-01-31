'use client';

import React, { useState } from 'react';
import { X, ChevronRight, Save, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAutomationStore } from '@/stores/automationStore';
import { Node } from 'reactflow';

interface NodeConfigPanelProps {
  node: Node | null;
  onClose: () => void;
}

export const NodeConfigPanel = ({ node, onClose }: NodeConfigPanelProps) => {
  const [config, setConfig] = useState(node?.data?.config || {});
  const { updateNode } = useAutomationStore();

  if (!node) return null;

  const handleSave = () => {
    updateNode(node.id, { config });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] scale-in-center">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="h-9 w-9 rounded bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <Settings size={18} />
            </div>
            <div>
              <h2 className="font-bold text-base text-white leading-tight">Node Settings</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{node.data.label}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-800 text-slate-400 h-8 w-8">
            <X size={16} />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {node.type === 'triggerNode' && <TriggerConfig config={config} setConfig={setConfig} />}
          {node.type === 'actionNode' && <ActionConfig config={config} setConfig={setConfig} />}
          {node.type === 'conditionNode' && <ConditionConfig config={config} setConfig={setConfig} />}
          
          <div className="pt-6 border-t border-slate-800">
            <ExecutionSettings config={config} setConfig={setConfig} />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex items-center gap-2">
          <Button onClick={handleSave} className="flex-1 rounded h-10 gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-xs uppercase tracking-wider">
            <Save size={14} />
            Save changes
          </Button>
          <Button variant="outline" onClick={onClose} className="rounded border-slate-700 text-slate-400 hover:bg-slate-800 h-10 px-4 text-xs font-bold uppercase tracking-wider">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

const TriggerConfig = ({ config, setConfig }: any) => {
  const triggerType = config.triggerType || 'pageView';

  return (
    <div className="space-y-6">
      <SectionHead title="Trigger Basis" subtitle="When should this automation start?" />
      
      {triggerType === 'pageView' && (
        <Field label="Page Path / URL">
          <Input
            placeholder="e.g. /pricing"
            value={config.page || ''}
            onChange={(e) => setConfig({ ...config, page: e.target.value })}
            className="bg-slate-950 border-slate-800 h-11"
          />
        </Field>
      )}

      {triggerType === 'click' && (
        <Field label="Element Selector (ID or Class)">
          <Input
            placeholder="e.g. #signup-btn"
            value={config.selector || ''}
            onChange={(e) => setConfig({ ...config, selector: e.target.value })}
            className="bg-slate-900 border-slate-800 h-11"
          />
        </Field>
      )}

      {triggerType === 'scroll' && (
        <Field label="Scroll Depth (%)">
          <Input
            type="number"
            value={config.scrollDepth || 50}
            onChange={(e) => setConfig({ ...config, scrollDepth: parseInt(e.target.value) })}
            className="bg-slate-900 border-slate-800 h-11"
          />
        </Field>
      )}

      {triggerType === 'timeOnPage' && (
        <div className="flex gap-3">
          <div className="flex-1">
            <Field label="Duration">
              <Input
                type="number"
                value={config.duration || 30}
                onChange={(e) => setConfig({ ...config, duration: parseInt(e.target.value) })}
                className="bg-slate-900 border-slate-800 h-11"
              />
            </Field>
          </div>
          <div className="w-1/3">
            <Field label="Unit">
              <select
                value={config.unit || 'seconds'}
                onChange={(e) => setConfig({ ...config, unit: e.target.value })}
                className="w-full h-11 px-3 bg-slate-900 border border-slate-800 rounded text-sm text-white outline-none"
              >
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
              </select>
            </Field>
          </div>
        </div>
      )}
    </div>
  );
};

const ActionConfig = ({ config, setConfig }: any) => {
  const actionType = config.actionType || 'email';

  return (
    <div className="space-y-6">
      <SectionHead title="Action Setup" subtitle="What should happen at this step?" />

      {actionType === 'email' && (
        <div className="space-y-4">
          <Field label="Recipient">
            <Input
              type="email"
              placeholder="user@example.com"
              value={config.to || ''}
              onChange={(e) => setConfig({ ...config, to: e.target.value })}
              className="bg-slate-950 border-slate-800 h-11"
            />
          </Field>
          <Field label="Subject">
            <Input
              placeholder="Email subject line"
              value={config.subject || ''}
              onChange={(e) => setConfig({ ...config, subject: e.target.value })}
              className="bg-slate-950 border-slate-800 h-11"
            />
          </Field>
          <Field label="Message Body">
            <textarea
              value={config.body || ''}
              onChange={(e) => setConfig({ ...config, body: e.target.value })}
              className="w-full h-40 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-white focus:ring-1 ring-primary/20 transition-all font-mono"
            />
          </Field>
        </div>
      )}

      {actionType === 'slack' && (
        <div className="space-y-4">
          <Field label="Incoming Webhook URL">
            <Input
              placeholder="Slach webhook URL"
              value={config.webhookUrl || ''}
              onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
              className="bg-slate-900 border-slate-800 h-11"
            />
          </Field>
          <Field label="Message Text">
            <textarea
              value={config.message || ''}
              onChange={(e) => setConfig({ ...config, message: e.target.value })}
              className="w-full h-32 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-white outline-none focus:ring-1 ring-primary/20 transition-all font-mono"
            />
          </Field>
        </div>
      )}

      {actionType === 'webhook' && (
        <div className="space-y-4">
          <div className="flex gap-3">
             <div className="w-1/4">
               <Field label="Method">
                <select
                  value={config.method || 'POST'}
                  onChange={(e) => setConfig({ ...config, method: e.target.value })}
                  className="w-full h-11 px-3 bg-slate-900 border border-slate-800 rounded text-sm text-white"
                >
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                </select>
              </Field>
             </div>
             <div className="flex-1">
              <Field label="Endpoint URL">
                <Input
                  placeholder="https://api..."
                  value={config.url || ''}
                  onChange={(e) => setConfig({ ...config, url: e.target.value })}
                  className="bg-slate-900 border-slate-800 h-11"
                />
              </Field>
             </div>
          </div>
          <Field label="JSON Payload">
            <textarea
              placeholder='{"key": "value"}'
              value={config.body ? JSON.stringify(config.body, null, 2) : ''}
              onChange={(e) => {
                try {
                  const body = JSON.parse(e.target.value);
                  setConfig({ ...config, body });
                } catch (err) {}
              }}
              className="w-full h-40 p-4 bg-slate-950 border border-slate-800 rounded text-xs font-mono text-white outline-none focus:ring-1 ring-primary/20 transition-all"
            />
          </Field>
        </div>
      )}

      {(actionType === 'modal' || actionType === 'banner') && (
        <div className="space-y-4">
          <Field label="Title / Heading">
            <Input
              placeholder="Important Update"
              value={config.title || ''}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              className="bg-slate-950 border-slate-800 h-11"
            />
          </Field>
          <Field label="Display Content">
            <textarea
              placeholder="What should the user see?"
               value={config.content || ''}
              onChange={(e) => setConfig({ ...config, content: e.target.value })}
              className="w-full h-32 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-white outline-none focus:ring-1 ring-primary/20 transition-all"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Button Text">
              <Input
                placeholder="Continue"
                value={config.buttonText || ''}
                onChange={(e) => setConfig({ ...config, buttonText: e.target.value })}
                className="bg-slate-950 border-slate-800 h-11"
              />
            </Field>
             <Field label="Duration (0=infinite)">
              <Input
                type="number"
                value={config.duration || 0}
                onChange={(e) => setConfig({ ...config, duration: parseInt(e.target.value) })}
                className="bg-slate-900 border-slate-800 h-11"
              />
            </Field>
          </div>
          <Field label="Position">
            <select
              value={config.position || 'bottom'}
              onChange={(e) => setConfig({ ...config, position: e.target.value })}
              className="w-full h-11 px-3 bg-slate-900 border border-slate-800 rounded text-sm text-white"
            >
              <option value="bottom">Bottom</option>
              <option value="top">Top</option>
              <option value="center">Center</option>
            </select>
          </Field>
        </div>
      )}

      {actionType === 'javascript' && (
        <Field label="Custom Script">
          <textarea
            value={config.code || ''}
            onChange={(e) => setConfig({ ...config, code: e.target.value })}
            className="w-full h-80 p-4 bg-slate-950 border border-slate-800 rounded text-xs font-mono text-white outline-none focus:ring-1 ring-primary/20 transition-all"
            placeholder="console.log('Running script...')"
          />
        </Field>
      )}
    </div>
  );
};

const ConditionConfig = ({ config, setConfig }: any) => {
  const conditionType = config.conditionType || 'if';

  return (
    <div className="space-y-6">
      <SectionHead title="Logic Criteria" subtitle="Control the flow based on data" />

      {conditionType === 'if' && (
        <div className="space-x-2 flex items-end">
          <div className="flex-1">
             <Field label="Data Field">
              <select
                value={config.field || 'user.email'}
                onChange={(e) => setConfig({ ...config, field: e.target.value })}
                className="w-full h-11 px-3 bg-slate-900 border border-slate-800 rounded text-sm text-white outline-none"
              >
                <option value="user.email">User Email</option>
                <option value="page.path">Current URL</option>
                <option value="user.country">Country</option>
              </select>
            </Field>
          </div>
          <div className="w-1/4">
             <Field label="Operator">
              <select
                value={config.operator || 'equals'}
                onChange={(e) => setConfig({ ...config, operator: e.target.value })}
                className="w-full h-11 px-3 bg-slate-900 border border-slate-800 rounded text-sm text-white"
              >
                <option value="equals">is</option>
                <option value="contains">contains</option>
              </select>
            </Field>
          </div>
        </div>
      )}

      {conditionType === 'if' && (
        <Field label="Comparison Value">
          <Input
            value={config.value || ''}
            onChange={(e) => setConfig({ ...config, value: e.target.value })}
            className="bg-slate-950 border-slate-800 h-11"
          />
        </Field>
      )}

      {conditionType === 'wait' && (
        <div className="flex gap-4">
          <div className="flex-1">
            <Field label="Wait Amount">
              <Input
                 type="number"
                value={config.delay || 10}
                onChange={(e) => setConfig({ ...config, delay: parseInt(e.target.value) })}
                className="bg-slate-900 border-slate-800 h-11"
              />
            </Field>
          </div>
          <div className="w-1/3">
             <Field label="Unit">
              <select
                value={config.unit || 'minutes'}
                onChange={(e) => setConfig({ ...config, unit: e.target.value })}
                className="w-full h-11 px-3 bg-slate-900 border border-slate-800 rounded text-sm text-white"
              >
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
              </select>
            </Field>
          </div>
        </div>
      )}
    </div>
  );
};

const ExecutionSettings = ({ config, setConfig }: any) => (
  <div className="space-y-6">
    <SectionHead title="Runtime Controls" subtitle="Frequency and behavioral limits" />
    <div className="grid grid-cols-2 gap-4">
      <Field label="Run Frequency">
        <select
          value={config.frequency || 'once'}
          onChange={(e) => setConfig({ ...config, frequency: e.target.value })}
          className="w-full h-11 px-3 bg-slate-900 border border-slate-800 rounded text-sm text-white outline-none"
        >
          <option value="once">Once per user</option>
          <option value="perSession">Once per session</option>
          <option value="every">Every occurrence</option>
        </select>
      </Field>
      <Field label="Restricting Path">
        <Input
          placeholder="/optional-filter"
          value={config.pageFilter || ''}
          onChange={(e) => setConfig({ ...config, pageFilter: e.target.value })}
          className="bg-slate-900 border-slate-800 h-11"
        />
      </Field>
    </div>
  </div>
);

const SectionHead = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div>
    <h3 className="text-sm font-black text-white tracking-tight">{title}</h3>
    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">{subtitle}</p>
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-0.5">{label}</label>
    {children}
  </div>
);

import { Zap, Activity, Settings2, BarChart3, Settings } from 'lucide-react';
