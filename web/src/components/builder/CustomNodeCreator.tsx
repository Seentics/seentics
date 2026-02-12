'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Code, Zap, Filter } from 'lucide-react';

interface CustomFieldDefinition {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'boolean';
  placeholder?: string;
  options?: string[]; // For select type
  required?: boolean;
}

interface CustomNodeDefinition {
  id: string;
  name: string;
  description: string;
  category: 'trigger' | 'condition' | 'action';
  icon: string;
  color: string;
  fields: CustomFieldDefinition[];
  executionCode?: string; // JavaScript code for execution
}

interface CustomNodeCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (node: CustomNodeDefinition) => void;
  defaultCategory?: 'trigger' | 'condition' | 'action';
}

export const CustomNodeCreator: React.FC<CustomNodeCreatorProps> = ({ isOpen, onClose, onSave, defaultCategory = 'action' }) => {
  const [nodeData, setNodeData] = useState<Partial<CustomNodeDefinition>>({
    name: '',
    description: '',
    category: defaultCategory,
    icon: '⚡',
    color: '#3b82f6',
    fields: [],
    executionCode: '',
  });

  // Update category when defaultCategory changes
  React.useEffect(() => {
    setNodeData(prev => ({
      ...prev,
      category: defaultCategory,
    }));
  }, [defaultCategory]);

  const [currentField, setCurrentField] = useState<Partial<CustomFieldDefinition>>({
    name: '',
    label: '',
    type: 'text',
    placeholder: '',
    required: false,
  });

  const addField = () => {
    if (!currentField.name || !currentField.label) return;

    const newField: CustomFieldDefinition = {
      id: `field_${Date.now()}`,
      name: currentField.name,
      label: currentField.label,
      type: currentField.type || 'text',
      placeholder: currentField.placeholder,
      required: currentField.required || false,
      options: currentField.options,
    };

    setNodeData({
      ...nodeData,
      fields: [...(nodeData.fields || []), newField],
    });

    // Reset current field
    setCurrentField({
      name: '',
      label: '',
      type: 'text',
      placeholder: '',
      required: false,
    });
  };

  const removeField = (fieldId: string) => {
    setNodeData({
      ...nodeData,
      fields: (nodeData.fields || []).filter(f => f.id !== fieldId),
    });
  };

  const handleSave = () => {
    if (!nodeData.name || !nodeData.description || !nodeData.category) {
      alert('Please fill in all required fields');
      return;
    }

    const customNode: CustomNodeDefinition = {
      id: `custom_${nodeData.category}_${Date.now()}`,
      name: nodeData.name,
      description: nodeData.description,
      category: nodeData.category as 'trigger' | 'condition' | 'action',
      icon: nodeData.icon || '⚡',
      color: nodeData.color || '#3b82f6',
      fields: nodeData.fields || [],
      executionCode: nodeData.executionCode,
    };

    onSave(customNode);
    handleClose();
  };

  const handleClose = () => {
    setNodeData({
      name: '',
      description: '',
      category: 'action',
      icon: '⚡',
      color: '#3b82f6',
      fields: [],
      executionCode: '',
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-950 border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white">Create Custom Node</DialogTitle>
          <DialogDescription className="text-slate-400">
            Define a custom trigger, condition, or action for your automation workflows
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8 py-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Code className="w-5 h-5" />
              Basic Information
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Node Name</Label>
                <Input
                  value={nodeData.name || ''}
                  onChange={(e) => setNodeData({ ...nodeData, name: e.target.value })}
                  placeholder="e.g. Slack Notification"
                  className="bg-slate-900/50 border-slate-800 h-11 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Category</Label>
                <Select
                  value={nodeData.category || 'action'}
                  onValueChange={(val) => setNodeData({ ...nodeData, category: val as any })}
                >
                  <SelectTrigger className="bg-slate-900/50 border-slate-800 h-11 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    <SelectItem value="trigger">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Trigger
                      </div>
                    </SelectItem>
                    <SelectItem value="condition">
                      <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        Condition
                      </div>
                    </SelectItem>
                    <SelectItem value="action">
                      <div className="flex items-center gap-2">
                        <Code className="w-4 h-4" />
                        Action
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Description</Label>
              <Textarea
                value={nodeData.description || ''}
                onChange={(e) => setNodeData({ ...nodeData, description: e.target.value })}
                placeholder="Describe what this node does..."
                className="bg-slate-900/50 border-slate-800 min-h-[80px] text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Icon (Emoji)</Label>
                <Input
                  value={nodeData.icon || ''}
                  onChange={(e) => setNodeData({ ...nodeData, icon: e.target.value })}
                  placeholder="e.g. 🔔 📧 💬"
                  className="bg-slate-900/50 border-slate-800 h-11 text-white text-2xl"
                  maxLength={2}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Color</Label>
                <Input
                  type="color"
                  value={nodeData.color || '#3b82f6'}
                  onChange={(e) => setNodeData({ ...nodeData, color: e.target.value })}
                  className="bg-slate-900/50 border-slate-800 h-11"
                />
              </div>
            </div>
          </div>

          {/* Configuration Fields */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Configuration Fields
            </h3>

            {/* Existing Fields */}
            {(nodeData.fields || []).length > 0 && (
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Defined Fields</Label>
                <div className="space-y-2">
                  {nodeData.fields?.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800"
                    >
                      <div>
                        <p className="text-white font-medium">{field.label}</p>
                        <p className="text-xs text-slate-400">
                          {field.name} • {field.type} {field.required && '• Required'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeField(field.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Field */}
            <div className="p-4 rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/20 space-y-4">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Add New Field</Label>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-slate-400">Field Name (variable)</Label>
                  <Input
                    value={currentField.name || ''}
                    onChange={(e) => setCurrentField({ ...currentField, name: e.target.value })}
                    placeholder="e.g. webhook_url"
                    className="bg-slate-900/50 border-slate-800 h-10 text-white font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-slate-400">Field Label</Label>
                  <Input
                    value={currentField.label || ''}
                    onChange={(e) => setCurrentField({ ...currentField, label: e.target.value })}
                    placeholder="e.g. Webhook URL"
                    className="bg-slate-900/50 border-slate-800 h-10 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-slate-400">Field Type</Label>
                  <Select
                    value={currentField.type || 'text'}
                    onValueChange={(val) => setCurrentField({ ...currentField, type: val as any })}
                  >
                    <SelectTrigger className="bg-slate-900/50 border-slate-800 h-10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                      <SelectItem value="text">Text Input</SelectItem>
                      <SelectItem value="textarea">Text Area</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="select">Dropdown</SelectItem>
                      <SelectItem value="boolean">Toggle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-slate-400">Placeholder</Label>
                  <Input
                    value={currentField.placeholder || ''}
                    onChange={(e) => setCurrentField({ ...currentField, placeholder: e.target.value })}
                    placeholder="e.g. https://..."
                    className="bg-slate-900/50 border-slate-800 h-10 text-white"
                  />
                </div>
              </div>

              {currentField.type === 'select' && (
                <div className="space-y-2">
                  <Label className="text-xs text-slate-400">Options (comma-separated)</Label>
                  <Input
                    value={currentField.options?.join(', ') || ''}
                    onChange={(e) => setCurrentField({ 
                      ...currentField, 
                      options: e.target.value.split(',').map(o => o.trim()).filter(Boolean) 
                    })}
                    placeholder="e.g. Option 1, Option 2, Option 3"
                    className="bg-slate-900/50 border-slate-800 h-10 text-white"
                  />
                </div>
              )}

              <Button
                onClick={addField}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Field
              </Button>
            </div>
          </div>

          {/* Execution Code (Optional) */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Code className="w-5 h-5" />
              Execution Code (Advanced)
            </h3>
            
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                JavaScript Code
              </Label>
              <Textarea
                value={nodeData.executionCode || ''}
                onChange={(e) => setNodeData({ ...nodeData, executionCode: e.target.value })}
                placeholder={`// Access config values via config object\n// Example:\n// const url = config.webhook_url;\n// fetch(url, { method: 'POST', body: JSON.stringify(data) });\n\nreturn { success: true };`}
                className="bg-slate-900/50 border-slate-800 min-h-[150px] text-white font-mono text-sm"
              />
              <p className="text-[10px] text-slate-500">
                💡 Use <code className="bg-slate-800 px-1 py-0.5 rounded">config</code> to access field values, 
                <code className="bg-slate-800 px-1 py-0.5 rounded ml-1">data</code> for trigger data
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-800">
            <Button
              onClick={handleClose}
              variant="outline"
              className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold"
            >
              Create Custom Node
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CustomNodeCreator;
