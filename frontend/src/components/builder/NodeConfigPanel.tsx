'use client';

import React, { useState } from 'react';
import { X, ChevronRight, Save, Copy, Trash2, Settings2 } from 'lucide-react';
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
    <div className="w-full h-full bg-slate-950/90 backdrop-blur-xl border-r border-slate-800 flex flex-col shadow-2xl animate-in slide-in-from-left duration-300">
      {/* Header */}
      <div className="px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            <Settings2 size={20} />
          </div>
          <div>
            <h2 className="font-extrabold text-lg text-white leading-none mb-1">Settings</h2>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">{node.data.label}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl hover:bg-slate-800 text-slate-500 hover:text-white h-9 w-9 transition-all">
          <X size={20} />
        </Button>
      </div>

      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-slate-800 to-transparent mx-auto" />

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-10 scrollbar-hide">
        {node.type === 'triggerNode' && <TriggerConfig config={config} setConfig={setConfig} />}
        {node.type === 'actionNode' && <ActionConfig config={config} setConfig={setConfig} />}
        {node.type === 'conditionNode' && <ConditionConfig config={config} setConfig={setConfig} />}
        
        <div className="pt-8 border-t border-slate-800/50">
          <ExecutionSettings config={config} setConfig={setConfig} />
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-slate-800 bg-slate-950/50 backdrop-blur-md flex flex-col gap-3">
        <Button onClick={handleSave} className="w-full rounded-xl h-12 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
          <Save size={16} />
          Sync Changes
        </Button>
        <Button variant="ghost" onClick={onClose} className="w-full rounded-xl text-slate-500 hover:text-white hover:bg-slate-800 h-11 text-xs font-bold uppercase tracking-wider transition-all">
          Dismiss
        </Button>
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
              placeholder="Slack webhook URL"
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

      {actionType === 'modal' && (
        <div className="space-y-4">
          <Field label="Modal Title">
            <Input
              placeholder="Limited Offer!"
              value={config.title || ''}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              className="bg-slate-950 border-slate-800 h-11"
            />
          </Field>
          <Field label="Content Text">
            <textarea
              placeholder="Sign up now and get 50% off..."
              value={config.content || ''}
              onChange={(e) => setConfig({ ...config, content: e.target.value })}
              className="w-full h-24 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-white"
            />
          </Field>
          <div className="flex gap-3">
            <div className="flex-1">
              <Field label="Primary Button">
                <Input
                  placeholder="Get Started"
                  value={config.primaryButton || ''}
                  onChange={(e) => setConfig({ ...config, primaryButton: e.target.value })}
                  className="bg-slate-950 border-slate-800 h-11"
                />
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Secondary Button">
                <Input
                  placeholder="Maybe Later"
                  value={config.secondaryButton || ''}
                  onChange={(e) => setConfig({ ...config, secondaryButton: e.target.value })}
                  className="bg-slate-950 border-slate-800 h-11"
                />
              </Field>
            </div>
          </div>
        </div>
      )}

      {actionType === 'banner' && (
        <div className="space-y-4">
          <Field label="Banner Content">
            <Input
              placeholder="New feature announcement! 🚀"
              value={config.content || ''}
              onChange={(e) => setConfig({ ...config, content: e.target.value })}
              className="bg-slate-950 border-slate-800 h-11"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Background Color">
              <Input
                type="color"
                value={config.backgroundColor || '#4f46e5'}
                onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
                className="bg-slate-950 border-slate-800 h-11 p-1"
              />
            </Field>
            <Field label="Text Color">
              <Input
                type="color"
                value={config.textColor || '#ffffff'}
                onChange={(e) => setConfig({ ...config, textColor: e.target.value })}
                className="bg-slate-950 border-slate-800 h-11 p-1"
              />
            </Field>
          </div>
          <Field label="Position">
            <select
              value={config.position || 'bottom'}
              onChange={(e) => setConfig({ ...config, position: e.target.value })}
              className="w-full h-11 px-3 bg-slate-950 border border-slate-800 rounded text-sm text-white"
            >
              <option value="top">Top Segment</option>
              <option value="bottom">Bottom Segment</option>
            </select>
          </Field>
        </div>
      )}

      {actionType === 'notification' && (
        <div className="space-y-4">
          <Field label="Title">
            <Input
              placeholder="Success!"
              value={config.title || ''}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              className="bg-slate-950 border-slate-800 h-11"
            />
          </Field>
          <Field label="Message">
            <Input
              placeholder="Your data has been saved."
              value={config.message || ''}
              onChange={(e) => setConfig({ ...config, message: e.target.value })}
              className="bg-slate-950 border-slate-800 h-11"
            />
          </Field>
          <Field label="Type">
            <select
              value={config.type || 'info'}
              onChange={(e) => setConfig({ ...config, type: e.target.value })}
              className="w-full h-11 px-3 bg-slate-950 border border-slate-800 rounded text-sm text-white"
            >
              <option value="info">Information</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </Field>
        </div>
      )}

      {actionType === 'redirect' && (
        <Field label="Destination URL">
          <Input
            placeholder="https://example.com/thank-you"
            value={config.url || ''}
            onChange={(e) => setConfig({ ...config, url: e.target.value })}
            className="bg-slate-950 border-slate-800 h-11"
          />
        </Field>
      )}

      {actionType === 'javascript' && (
        <Field label="Custom JavaScript Code">
          <textarea
            placeholder="console.log('Hello from Seentics!');"
            value={config.code || ''}
            onChange={(e) => setConfig({ ...config, code: e.target.value })}
            className="w-full h-64 p-4 bg-slate-950 border border-slate-800 rounded text-sm text-white font-mono"
          />
        </Field>
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
                } catch (error) {
                    console.error('Failed to parse expression:', error);
                }
              }}
              className="w-full h-40 p-4 bg-slate-950 border border-slate-800 rounded text-xs font-mono text-white outline-none focus:ring-1 ring-primary/20 transition-all"
            />
          </Field>
        </div>
      )}
    </div>
  );
};


const ConditionConfig = ({ config, setConfig }: any) => {
  const conditionType = config.conditionType || 'if';

  return (
    <div className="space-y-6">
      <SectionHead title="Logic Criteria" subtitle="Control the flow based on data" />

      {conditionType === 'device' && (
        <Field label="Match Device">
          <select
            value={config.device || 'mobile'}
            onChange={(e) => setConfig({ ...config, device: e.target.value })}
            className="w-full h-11 px-3 bg-slate-900 border border-slate-800 rounded text-sm text-white"
          >
            <option value="mobile">Mobile Devices</option>
            <option value="desktop">Desktop / Laptop</option>
            <option value="tablet">Tablets</option>
          </select>
        </Field>
      )}

      {conditionType === 'visitor' && (
        <Field label="Visitor Status">
          <select
            value={config.status || 'new'}
            onChange={(e) => setConfig({ ...config, status: e.target.value })}
            className="w-full h-11 px-3 bg-slate-900 border border-slate-800 rounded text-sm text-white"
          >
            <option value="new">New Visitors</option>
            <option value="returning">Returning Visitors</option>
          </select>
        </Field>
      )}

      {conditionType === 'url_param' && (
        <div className="space-y-4">
          <Field label="Parameter Name">
            <Input
              placeholder="e.g. utm_source"
              value={config.param || ''}
              onChange={(e) => setConfig({ ...config, param: e.target.value })}
              className="bg-slate-950 border-slate-800 h-11"
            />
          </Field>
          <Field label="Comparison">
            <div className="flex gap-2">
              <select
                value={config.operator || 'eq'}
                onChange={(e) => setConfig({ ...config, operator: e.target.value })}
                className="w-1/3 h-11 px-3 bg-slate-950 border border-slate-800 rounded text-sm text-white"
              >
                <option value="eq">Equals</option>
                <option value="contains">Contains</option>
              </select>
              <Input
                placeholder="Value"
                value={config.value || ''}
                onChange={(e) => setConfig({ ...config, value: e.target.value })}
                className="flex-1 bg-slate-950 border-slate-800 h-11"
              />
            </div>
          </Field>
        </div>
      )}

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
          <option value="once_per_visitor">Once per Visitor</option>
          <option value="once_per_session">Once per Session</option>
          <option value="once_per_day">Once per Day</option>
          <option value="always">Always Trigger</option>
        </select>
      </Field>
      <Field label="Specific Path Only">
        <Input
          placeholder="e.g. /checkout (Optional)"
          value={config.pathFilter || ''}
          onChange={(e) => setConfig({ ...config, pathFilter: e.target.value })}
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
