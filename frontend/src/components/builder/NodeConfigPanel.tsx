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

  const renderConfigForm = () => {
    switch (node.type) {
      case 'triggerNode':
        return <TriggerConfig config={config} setConfig={setConfig} />;
      case 'actionNode':
        return <ActionConfig config={config} setConfig={setConfig} />;
      case 'conditionNode':
        return <ConditionConfig config={config} setConfig={setConfig} />;
      default:
        return <div>No configuration available</div>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 px-8 py-6 flex items-center justify-between">
          <div>
            <h2 className="font-black text-xl">{node.data.label}</h2>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">{node.type}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X size={20} />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {renderConfigForm()}
        </div>

        {/* Footer */}
        <div className="border-t bg-slate-50 dark:bg-slate-900/50 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg gap-2"
            >
              <Copy size={14} />
              Duplicate
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg gap-2 text-red-600 hover:text-red-700"
            >
              <Trash2 size={14} />
              Delete
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose} className="rounded-lg">
              Cancel
            </Button>
            <Button onClick={handleSave} className="rounded-lg gap-2 bg-primary text-white">
              <Save size={14} />
              Save Config
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const TriggerConfig = ({ config, setConfig }: any) => (
  <div className="space-y-6">
    <div>
      <label className="block text-sm font-black mb-2">Trigger Type</label>
      <select
        value={config.triggerType || 'pageView'}
        onChange={(e) => setConfig({ ...config, triggerType: e.target.value })}
        className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-slate-900"
      >
        <option value="pageView">Page View</option>
        <option value="click">Button Click</option>
        <option value="scroll">Scroll Depth</option>
        <option value="timeOnPage">Time on Page</option>
        <option value="customEvent">Custom Event</option>
        <option value="webhook">Incoming Webhook</option>
      </select>
    </div>

    {config.triggerType === 'pageView' && (
      <div>
        <label className="block text-sm font-black mb-2">Page URL Pattern</label>
        <Input
          placeholder="e.g., /pricing or https://example.com/checkout"
          value={config.page || ''}
          onChange={(e) => setConfig({ ...config, page: e.target.value })}
          className="rounded-lg"
        />
      </div>
    )}

    {config.triggerType === 'click' && (
      <div>
        <label className="block text-sm font-black mb-2">CSS Selector</label>
        <Input
          placeholder="e.g., .btn-subscribe or #cta-button"
          value={config.selector || ''}
          onChange={(e) => setConfig({ ...config, selector: e.target.value })}
          className="rounded-lg"
        />
      </div>
    )}

    {config.triggerType === 'scroll' && (
      <div>
        <label className="block text-sm font-black mb-2">Scroll Depth (%)</label>
        <Input
          type="number"
          min="0"
          max="100"
          value={config.scrollDepth || 50}
          onChange={(e) => setConfig({ ...config, scrollDepth: parseInt(e.target.value) })}
          className="rounded-lg"
        />
      </div>
    )}

    {config.triggerType === 'timeOnPage' && (
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-black mb-2">Duration</label>
          <Input
            type="number"
            min="1"
            value={config.duration || 30}
            onChange={(e) => setConfig({ ...config, duration: parseInt(e.target.value) })}
            className="rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-black mb-2">Unit</label>
          <select
            value={config.unit || 'seconds'}
            onChange={(e) => setConfig({ ...config, unit: e.target.value })}
            className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-slate-900"
          >
            <option value="seconds">Seconds</option>
            <option value="minutes">Minutes</option>
          </select>
        </div>
      </div>
    )}
  </div>
);

const ActionConfig = ({ config, setConfig }: any) => (
  <div className="space-y-6">
    <div>
      <label className="block text-sm font-black mb-2">Action Type</label>
      <select
        value={config.actionType || 'email'}
        onChange={(e) => setConfig({ ...config, actionType: e.target.value })}
        className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-slate-900"
      >
        <option value="email">Send Email</option>
        <option value="slack">Slack Notification</option>
        <option value="webhook">HTTP Webhook</option>
        <option value="modal">Show Modal</option>
        <option value="banner">Show Banner</option>
        <option value="crm">Sync to CRM</option>
        <option value="javascript">Execute JavaScript</option>
      </select>
    </div>

    {config.actionType === 'email' && (
      <>
        <div>
          <label className="block text-sm font-black mb-2">Recipient Email</label>
          <Input
            type="email"
            placeholder="user@example.com or {{user.email}}"
            value={config.to || ''}
            onChange={(e) => setConfig({ ...config, to: e.target.value })}
            className="rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-black mb-2">Subject</label>
          <Input
            placeholder="Welcome to {{company.name}}"
            value={config.subject || ''}
            onChange={(e) => setConfig({ ...config, subject: e.target.value })}
            className="rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-black mb-2">Email Body</label>
          <textarea
            placeholder="Hi {{user.name}}, thanks for visiting..."
            value={config.body || ''}
            onChange={(e) => setConfig({ ...config, body: e.target.value })}
            className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-slate-900 font-mono text-sm min-h-[150px]"
          />
        </div>
      </>
    )}

    {config.actionType === 'slack' && (
      <>
        <div>
          <label className="block text-sm font-black mb-2">Webhook URL</label>
          <Input
            placeholder="https://hooks.slack.com/services/..."
            value={config.webhookUrl || ''}
            onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
            className="rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-black mb-2">Message</label>
          <textarea
            placeholder="@channel User {{user.email}} just converted!"
            value={config.message || ''}
            onChange={(e) => setConfig({ ...config, message: e.target.value })}
            className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-slate-900 font-mono text-sm min-h-[120px]"
          />
        </div>
      </>
    )}

    {config.actionType === 'modal' && (
      <>
        <div>
          <label className="block text-sm font-black mb-2">Modal Title</label>
          <Input
            placeholder="Special Offer!"
            value={config.title || ''}
            onChange={(e) => setConfig({ ...config, title: e.target.value })}
            className="rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-black mb-2">Modal Content</label>
          <textarea
            placeholder="Get 30% off this week only..."
            value={config.content || ''}
            onChange={(e) => setConfig({ ...config, content: e.target.value })}
            className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-slate-900 font-mono text-sm min-h-[150px]"
          />
        </div>
      </>
    )}
  </div>
);

const ConditionConfig = ({ config, setConfig }: any) => (
  <div className="space-y-6">
    <div>
      <label className="block text-sm font-black mb-2">Condition Type</label>
      <select
        value={config.conditionType || 'if'}
        onChange={(e) => setConfig({ ...config, conditionType: e.target.value })}
        className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-slate-900"
      >
        <option value="if">If / Then</option>
        <option value="and">And (All conditions must match)</option>
        <option value="or">Or (Any condition matches)</option>
        <option value="timeWindow">Time Window</option>
      </select>
    </div>

    {config.conditionType === 'if' && (
      <>
        <div>
          <label className="block text-sm font-black mb-2">Field</label>
          <select
            value={config.field || 'user.property'}
            onChange={(e) => setConfig({ ...config, field: e.target.value })}
            className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-slate-900"
          >
            <option value="user.email">User Email</option>
            <option value="user.country">User Country</option>
            <option value="user.device">User Device</option>
            <option value="event.data">Event Data</option>
            <option value="custom.property">Custom Property</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-black mb-2">Operator</label>
          <select
            value={config.operator || 'equals'}
            onChange={(e) => setConfig({ ...config, operator: e.target.value })}
            className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-slate-900"
          >
            <option value="equals">Equals</option>
            <option value="contains">Contains</option>
            <option value="startsWith">Starts with</option>
            <option value="endsWith">Ends with</option>
            <option value="greaterThan">Greater than</option>
            <option value="lessThan">Less than</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-black mb-2">Value</label>
          <Input
            placeholder="Enter comparison value"
            value={config.value || ''}
            onChange={(e) => setConfig({ ...config, value: e.target.value })}
            className="rounded-lg"
          />
        </div>
      </>
    )}
  </div>
);
