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
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-slate-800 border-2 border-slate-700 rounded shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col scale-in-center">
        {/* Header */}
        <div className="border-b border-slate-700 bg-slate-800 px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded bg-primary/10 flex items-center justify-center text-primary">
              <Settings2 size={24} />
            </div>
            <div>
              <h2 className="font-black text-xl text-white">{node.data.label} Settings</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Configure your automation step</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose} 
            className="rounded-full text-slate-400 hover:text-white hover:bg-slate-700"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-8">
          {renderConfigForm()}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 bg-slate-800/80 px-8 py-6 flex items-center justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={onClose} 
            className="rounded border-slate-600 text-slate-300 hover:bg-slate-700 h-11"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            className="rounded px-8 h-11 gap-2 bg-primary hover:bg-primary/90 text-white font-black shadow-lg shadow-primary/20"
          >
            <Save size={18} />
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
};

const TriggerConfig = ({ config, setConfig }: any) => {
  const triggerType = config.triggerType || 'pageView';

  return (
    <div className="space-y-8">
      <Section title="Trigger Configuration" icon={<Zap className="w-4 h-4 text-amber-500" />}>
        {triggerType === 'pageView' && (
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Page URL Filter</label>
            <Input
              placeholder="e.g. /pricing or https://..."
              value={config.page || ''}
              onChange={(e) => setConfig({ ...config, page: e.target.value })}
              className="bg-slate-900/50 border-slate-700 h-12 rounded text-white focus:ring-primary/20"
            />
            <p className="text-[10px] text-slate-500 mt-2 italic">Triggers when anyone visits this specific page.</p>
          </div>
        )}

        {triggerType === 'click' && (
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">CSS Selector</label>
            <Input
              placeholder="e.g. #cta-button or .signup-link"
              value={config.selector || ''}
              onChange={(e) => setConfig({ ...config, selector: e.target.value })}
              className="bg-slate-900/50 border-slate-700 h-12 rounded text-white focus:ring-primary/20"
            />
            <p className="text-[10px] text-slate-500 mt-2 italic">Identify the button or element using its CSS ID or Class.</p>
          </div>
        )}

        {triggerType === 'scroll' && (
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Scroll Depth (%)</label>
            <Input
              type="number"
              min="0"
              max="100"
              value={config.scrollDepth || 50}
              onChange={(e) => setConfig({ ...config, scrollDepth: parseInt(e.target.value) })}
              className="bg-slate-900/50 border-slate-700 h-12 rounded text-white focus:ring-primary/20"
            />
          </div>
        )}

        {triggerType === 'timeOnPage' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Duration</label>
              <Input
                type="number"
                min="1"
                value={config.duration || 30}
                onChange={(e) => setConfig({ ...config, duration: parseInt(e.target.value) })}
                className="bg-slate-900/50 border-slate-700 h-12 rounded text-white focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Unit</label>
              <select
                value={config.unit || 'seconds'}
                onChange={(e) => setConfig({ ...config, unit: e.target.value })}
                className="w-full px-4 h-12 bg-slate-900/50 border border-slate-700 rounded text-white text-sm outline-none focus:ring-2 ring-primary/20"
              >
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
              </select>
            </div>
          </div>
        )}
      </Section>

      <ExecutionSettings config={config} setConfig={setConfig} />
    </div>
  );
};

const ActionConfig = ({ config, setConfig }: any) => {
  const actionType = config.actionType || 'email';

  return (
    <div className="space-y-8">
      <Section title="Action Configuration" icon={<Activity className="w-4 h-4 text-blue-500" />}>
        {actionType === 'email' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Recipient Email</label>
              <Input
                type="email"
                placeholder="Recipient (e.g., user@example.com)"
                value={config.to || ''}
                onChange={(e) => setConfig({ ...config, to: e.target.value })}
                className="bg-slate-900/50 border-slate-700 h-12 rounded text-white focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Subject</label>
              <Input
                placeholder="Subject line..."
                value={config.subject || ''}
                onChange={(e) => setConfig({ ...config, subject: e.target.value })}
                className="bg-slate-900/50 border-slate-700 h-12 rounded text-white focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Body Content</label>
              <textarea
                placeholder="Email content (supports HTML and {{markdown}})"
                value={config.body || ''}
                onChange={(e) => setConfig({ ...config, body: e.target.value })}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded text-white text-sm font-mono min-h-[150px] outline-none focus:ring-2 ring-primary/20 transition-all"
              />
            </div>
          </div>
        )}

        {actionType === 'slack' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Webhook URL</label>
              <Input
                placeholder="https://hooks.slack.com/services/..."
                value={config.webhookUrl || ''}
                onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
                className="bg-slate-900/50 border-slate-700 h-12 rounded text-white focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Message</label>
              <textarea
                placeholder="Type your Slack message..."
                value={config.message || ''}
                onChange={(e) => setConfig({ ...config, message: e.target.value })}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded text-white text-sm font-mono min-h-[120px] outline-none focus:ring-2 ring-primary/20 transition-all"
              />
            </div>
          </div>
        )}

        {actionType === 'webhook' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Webhook URL</label>
              <Input
                placeholder="https://your-webhook.com/endpoint"
                value={config.url || ''}
                onChange={(e) => setConfig({ ...config, url: e.target.value })}
                className="bg-slate-900/50 border-slate-700 h-12 rounded text-white focus:ring-primary/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Method</label>
                <select
                  value={config.method || 'POST'}
                  onChange={(e) => setConfig({ ...config, method: e.target.value })}
                  className="w-full px-4 h-12 bg-slate-900/50 border border-slate-700 rounded text-white text-sm outline-none focus:ring-2 ring-primary/20"
                >
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Headers (JSON)</label>
              <textarea
                placeholder='{"Authorization": "Bearer token"}'
                value={config.headers ? JSON.stringify(config.headers, null, 2) : ''}
                onChange={(e) => {
                  try {
                    const headers = JSON.parse(e.target.value);
                    setConfig({ ...config, headers });
                  } catch (err) {
                    // Invalid JSON, don't update
                  }
                }}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded text-white text-sm font-mono min-h-[80px] outline-none focus:ring-2 ring-primary/20 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Body (JSON)</label>
              <textarea
                placeholder='{"event": "custom_event", "data": "value"}'
                value={config.body ? JSON.stringify(config.body, null, 2) : ''}
                onChange={(e) => {
                  try {
                    const body = JSON.parse(e.target.value);
                    setConfig({ ...config, body });
                  } catch (err) {
                    // Invalid JSON, don't update
                  }
                }}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded text-white text-sm font-mono min-h-[120px] outline-none focus:ring-2 ring-primary/20 transition-all"
              />
            </div>
          </div>
        )}

        {actionType === 'banner' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Banner Content</label>
              <textarea
                placeholder="Your banner message here..."
                value={config.content || ''}
                onChange={(e) => setConfig({ ...config, content: e.target.value })}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded text-white text-sm min-h-[100px] outline-none focus:ring-2 ring-primary/20 transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Position</label>
                <select
                  value={config.position || 'bottom'}
                  onChange={(e) => setConfig({ ...config, position: e.target.value })}
                  className="w-full px-4 h-12 bg-slate-900/50 border border-slate-700 rounded text-white text-sm outline-none focus:ring-2 ring-primary/20"
                >
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Duration (seconds)</label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0 = permanent"
                  value={config.duration || 0}
                  onChange={(e) => setConfig({ ...config, duration: parseInt(e.target.value) })}
                  className="bg-slate-900/50 border-slate-700 h-12 rounded text-white focus:ring-primary/20"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Background Color</label>
                <Input
                  type="color"
                  value={config.backgroundColor || '#000000'}
                  onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
                  className="bg-slate-900/50 border-slate-700 h-12 rounded text-white focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Text Color</label>
                <Input
                  type="color"
                  value={config.textColor || '#ffffff'}
                  onChange={(e) => setConfig({ ...config, textColor: e.target.value })}
                  className="bg-slate-900/50 border-slate-700 h-12 rounded text-white focus:ring-primary/20"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.closeButton !== false}
                onChange={(e) => setConfig({ ...config, closeButton: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900/50"
              />
              <label className="text-sm text-slate-300">Show close button</label>
            </div>
          </div>
        )}

        {(actionType === 'javascript' || actionType === 'script') && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">JavaScript Code</label>
              <textarea
                placeholder="console.log('Hello from automation!');"
                value={config.code || ''}
                onChange={(e) => setConfig({ ...config, code: e.target.value })}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded text-white text-sm font-mono min-h-[200px] outline-none focus:ring-2 ring-primary/20 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Injection Position</label>
              <select
                value={config.position || 'head'}
                onChange={(e) => setConfig({ ...config, position: e.target.value })}
                className="w-full px-4 h-12 bg-slate-900/50 border border-slate-700 rounded text-white text-sm outline-none focus:ring-2 ring-primary/20"
              >
                <option value="head">Head</option>
                <option value="body">Body</option>
              </select>
            </div>
            <div className="p-4 rounded bg-amber-500/10 border border-amber-500/20">
              <p className="text-[10px] text-amber-400 leading-relaxed">
                ⚠️ Be careful with custom JavaScript. Only use trusted code.
              </p>
            </div>
          </div>
        )}

        {actionType === 'modal' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={config.useCustom || false}
                onChange={(e) => setConfig({ ...config, useCustom: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900/50"
              />
              <label className="text-sm text-slate-300">Use custom HTML/CSS/JS</label>
            </div>

            {!config.useCustom ? (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Modal Title</label>
                  <Input
                    placeholder="Welcome to our site!"
                    value={config.title || ''}
                    onChange={(e) => setConfig({ ...config, title: e.target.value })}
                    className="bg-slate-900/50 border-slate-700 h-12 rounded text-white focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Content</label>
                  <textarea
                    placeholder="Your modal message here..."
                    value={config.content || ''}
                    onChange={(e) => setConfig({ ...config, content: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded text-white text-sm min-h-[100px] outline-none focus:ring-2 ring-primary/20 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Primary Button</label>
                    <Input
                      placeholder="Confirm"
                      value={config.primaryButton || ''}
                      onChange={(e) => setConfig({ ...config, primaryButton: e.target.value })}
                      className="bg-slate-900/50 border-slate-700 h-12 rounded text-white focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Secondary Button</label>
                    <Input
                      placeholder="Cancel"
                      value={config.secondaryButton || ''}
                      onChange={(e) => setConfig({ ...config, secondaryButton: e.target.value })}
                      className="bg-slate-900/50 border-slate-700 h-12 rounded text-white focus:ring-primary/20"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Custom HTML</label>
                  <textarea
                    placeholder="<div>Your custom HTML...</div>"
                    value={config.customHtml || ''}
                    onChange={(e) => setConfig({ ...config, customHtml: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded text-white text-sm font-mono min-h-[120px] outline-none focus:ring-2 ring-primary/20 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Custom CSS</label>
                  <textarea
                    placeholder=".my-modal { ... }"
                    value={config.customCss || ''}
                    onChange={(e) => setConfig({ ...config, customCss: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded text-white text-sm font-mono min-h-[120px] outline-none focus:ring-2 ring-primary/20 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Custom JavaScript</label>
                  <textarea
                    placeholder="// Your custom JS code"
                    value={config.customJs || ''}
                    onChange={(e) => setConfig({ ...config, customJs: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded text-white text-sm font-mono min-h-[100px] outline-none focus:ring-2 ring-primary/20 transition-all"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {actionType === 'notification' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={config.useCustom || false}
                onChange={(e) => setConfig({ ...config, useCustom: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900/50"
              />
              <label className="text-sm text-slate-300">Use custom HTML/CSS/JS</label>
            </div>

            {!config.useCustom ? (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Notification Type</label>
                  <select
                    value={config.type || 'info'}
                    onChange={(e) => setConfig({ ...config, type: e.target.value })}
                    className="w-full px-4 h-12 bg-slate-900/50 border border-slate-700 rounded text-white text-sm outline-none focus:ring-2 ring-primary/20"
                  >
                    <option value="success">Success</option>
                    <option value="error">Error</option>
                    <option value="warning">Warning</option>
                    <option value="info">Info</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Title</label>
                  <Input
                    placeholder="Notification title"
                    value={config.title || ''}
                    onChange={(e) => setConfig({ ...config, title: e.target.value })}
                    className="bg-slate-900/50 border-slate-700 h-12 rounded text-white focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Message</label>
                  <textarea
                    placeholder="Your notification message..."
                    value={config.message || ''}
                    onChange={(e) => setConfig({ ...config, message: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded text-white text-sm min-h-[80px] outline-none focus:ring-2 ring-primary/20 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Position</label>
                    <select
                      value={config.position || 'top'}
                      onChange={(e) => setConfig({ ...config, position: e.target.value })}
                      className="w-full px-4 h-12 bg-slate-900/50 border border-slate-700 rounded text-white text-sm outline-none focus:ring-2 ring-primary/20"
                    >
                      <option value="top">Top Right</option>
                      <option value="bottom">Bottom Right</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Duration (seconds)</label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="5"
                      value={config.duration || 5}
                      onChange={(e) => setConfig({ ...config, duration: parseInt(e.target.value) })}
                      className="bg-slate-900/50 border-slate-700 h-12 rounded text-white focus:ring-primary/20"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Custom HTML</label>
                  <textarea
                    placeholder="<div>Your custom HTML...</div>"
                    value={config.customHtml || ''}
                    onChange={(e) => setConfig({ ...config, customHtml: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded text-white text-sm font-mono min-h-[120px] outline-none focus:ring-2 ring-primary/20 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Custom CSS</label>
                  <textarea
                    placeholder=".my-notification { ... }"
                    value={config.customCss || ''}
                    onChange={(e) => setConfig({ ...config, customCss: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded text-white text-sm font-mono min-h-[120px] outline-none focus:ring-2 ring-primary/20 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Custom JavaScript</label>
                  <textarea
                    placeholder="// Your custom JS code"
                    value={config.customJs || ''}
                    onChange={(e) => setConfig({ ...config, customJs: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded text-white text-sm font-mono min-h-[100px] outline-none focus:ring-2 ring-primary/20 transition-all"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </Section>

      <ExecutionSettings config={config} setConfig={setConfig} />
    </div>
  );
};

const ConditionConfig = ({ config, setConfig }: any) => {
  const conditionType = config.conditionType || 'if';

  return (
    <div className="space-y-8">
      <Section title="Logic Configuration" icon={<Settings2 className="w-4 h-4 text-purple-500" />}>
        {conditionType === 'if' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <select
                value={config.field || 'user.email'}
                onChange={(e) => setConfig({ ...config, field: e.target.value })}
                className="bg-slate-900/50 border-slate-700 h-10 rounded text-white text-xs font-bold outline-none"
              >
                <option value="user.email">User Email</option>
                <option value="user.country">Country</option>
                <option value="user.device">Device</option>
                <option value="page.path">Current Path</option>
              </select>
              <select
                value={config.operator || 'equals'}
                onChange={(e) => setConfig({ ...config, operator: e.target.value })}
                className="bg-slate-900/50 border-slate-700 h-10 rounded text-white text-xs font-bold outline-none"
              >
                <option value="equals">Equals</option>
                <option value="contains">Contains</option>
                <option value="greaterThan"> &gt; </option>
                <option value="lessThan"> &lt; </option>
              </select>
            </div>
            <Input
              placeholder="Comparison value..."
              value={config.value || ''}
              onChange={(e) => setConfig({ ...config, value: e.target.value })}
              className="bg-slate-900/50 border-slate-700 h-12 rounded text-white focus:ring-primary/20"
            />
          </div>
        )}

        {conditionType === 'wait' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Delay Amount</label>
              <Input
                type="number"
                min="1"
                value={config.delay || 10}
                onChange={(e) => setConfig({ ...config, delay: parseInt(e.target.value) })}
                className="bg-slate-900/50 border-slate-700 h-12 rounded text-white focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Unit</label>
              <select
                value={config.unit || 'minutes'}
                onChange={(e) => setConfig({ ...config, unit: e.target.value })}
                className="w-full px-4 h-12 bg-slate-900/50 border border-slate-700 rounded text-white text-sm outline-none focus:ring-2 ring-primary/20"
              >
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          </div>
        )}

        {conditionType === 'property' && (
          <div className="space-y-4">
             <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">User Attribute</label>
              <Input
                placeholder="e.g. plan_type or signup_source"
                value={config.propertyKey || ''}
                onChange={(e) => setConfig({ ...config, propertyKey: e.target.value })}
                className="bg-slate-900/50 border-slate-700 h-12 rounded text-white focus:ring-primary/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={config.operator || 'equals'}
                onChange={(e) => setConfig({ ...config, operator: e.target.value })}
                className="bg-slate-900/50 border-slate-700 h-10 rounded text-white text-xs font-bold outline-none"
              >
                <option value="equals">Is</option>
                <option value="exists">Exists</option>
                <option value="notExists">Doesn't Exist</option>
              </select>
              <Input
                placeholder="Value..."
                value={config.value || ''}
                onChange={(e) => setConfig({ ...config, value: e.target.value })}
                className="bg-slate-900/50 border-slate-700 h-10 rounded text-white focus:ring-primary/20"
              />
            </div>
          </div>
        )}
      </Section>

      <ExecutionSettings config={config} setConfig={setConfig} />
    </div>
  );
};

const Section = ({ title, icon, children }: any) => (
  <div className="space-y-6">
    <div className="flex items-center gap-2 pb-3 border-b border-slate-700/50">
      {icon}
      <h3 className="text-[11px] font-black text-slate-200 uppercase tracking-[0.2em]">{title}</h3>
    </div>
    <div className="space-y-5">
      {children}
    </div>
  </div>
);

const ExecutionSettings = ({ config, setConfig }: any) => (
  <Section title="Execution & Filters" icon={<BarChart3 className="w-4 h-4 text-emerald-500" />}>
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Frequency</label>
        <select
          value={config.frequency || 'once'}
          onChange={(e) => setConfig({ ...config, frequency: e.target.value })}
          className="w-full px-4 h-12 bg-slate-900/50 border border-slate-700 rounded text-white text-sm outline-none focus:ring-2 ring-primary/20"
        >
          <option value="once">Once</option>
          <option value="perSession">Per Session</option>
          <option value="every">Every Time</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Page Match</label>
        <Input
          placeholder="e.g. /pricing"
          value={config.pageFilter || ''}
          onChange={(e) => setConfig({ ...config, pageFilter: e.target.value })}
          className="bg-slate-900/50 border-slate-700 h-12 rounded text-white focus:ring-primary/20"
        />
      </div>
    </div>
    <div className="p-4 rounded bg-slate-900/40 border border-slate-700/50">
      <p className="text-[10px] text-slate-400 leading-relaxed italic">
        These controls limit how often this automation step can run for a single user and on which URLs it is active.
      </p>
    </div>
  </Section>
);

import { Zap, Activity, Settings2, BarChart3, Settings } from 'lucide-react';
