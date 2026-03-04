'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Trash2,
  Loader2,
  LayoutDashboard,
  Star,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  dashboardsAPI,
  type CustomDashboardData,
  type WidgetConfig,
  AVAILABLE_WIDGETS,
} from '@/lib/dashboards-api';
import { cn } from '@/lib/utils';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';

const CATEGORIES = [
  { id: 'overview', label: 'Overview', color: 'text-blue-500' },
  { id: 'behavior', label: 'Behavior', color: 'text-purple-500' },
  { id: 'acquisition', label: 'Acquisition', color: 'text-green-500' },
  { id: 'performance', label: 'Performance', color: 'text-orange-500' },
] as const;

export function DashboardsSettingsComponent() {
  const params = useParams();
  const websiteId = params?.websiteId as string;

  const [dashboards, setDashboards] = useState<CustomDashboardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formWidgets, setFormWidgets] = useState<WidgetConfig[]>(
    AVAILABLE_WIDGETS.map((w, i) => ({ ...w, position: i }))
  );

  useEffect(() => {
    if (websiteId) loadDashboards();
  }, [websiteId]);

  const loadDashboards = async () => {
    try {
      setLoading(true);
      const data = await dashboardsAPI.list(websiteId);
      setDashboards(data);
    } catch {
      toast.error('Failed to load dashboards');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formName.trim()) { toast.error('Please enter a name'); return; }

    try {
      setCreating(true);
      const enabledWidgets = formWidgets.filter((w) => w.enabled);
      const dashboard = await dashboardsAPI.create({
        websiteId,
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        widgets: enabledWidgets,
        layout: 'grid',
      });
      setDashboards((prev) => [dashboard, ...prev]);
      setShowCreate(false);
      resetForm();
      toast.success('Dashboard created');
    } catch {
      toast.error('Failed to create dashboard');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this dashboard?')) return;
    try {
      setDeleting(id);
      await dashboardsAPI.remove(id);
      setDashboards((prev) => prev.filter((d) => d.id !== id));
      toast.success('Dashboard deleted');
    } catch {
      toast.error('Failed to delete dashboard');
    } finally {
      setDeleting(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await dashboardsAPI.update(id, { isDefault: true });
      setDashboards((prev) =>
        prev.map((d) => ({ ...d, isDefault: d.id === id }))
      );
      toast.success('Default dashboard updated');
    } catch {
      toast.error('Failed to set default');
    }
  };

  const handleSaveWidgets = async (id: string, widgets: WidgetConfig[]) => {
    try {
      setSaving(true);
      await dashboardsAPI.update(id, { widgets });
      setDashboards((prev) =>
        prev.map((d) => (d.id === id ? { ...d, widgets } : d))
      );
      setEditingId(null);
      toast.success('Widgets saved');
    } catch {
      toast.error('Failed to save widgets');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormWidgets(AVAILABLE_WIDGETS.map((w, i) => ({ ...w, position: i })));
  };

  const toggleFormWidget = (widgetId: string) => {
    setFormWidgets((prev) =>
      prev.map((w) => (w.id === widgetId ? { ...w, enabled: !w.enabled } : w))
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight">Custom Dashboards</h2>
          <p className="text-muted-foreground text-sm">
            Create personalized dashboards with your preferred analytics widgets.
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="h-10 px-5 font-bold rounded gap-2 shadow-lg shadow-primary/20 transition-transform active:scale-95"
        >
          <Plus className="h-4 w-4" />
          New Dashboard
        </Button>
      </div>

      {/* Dashboard List */}
      <div className="grid grid-cols-1 gap-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : dashboards.length === 0 ? (
          <div className="text-center py-12 bg-muted/20 rounded border border-dashed">
            <LayoutDashboard className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground text-sm">No custom dashboards yet.</p>
            <p className="text-muted-foreground text-xs mt-1">Create one to organize your analytics widgets.</p>
          </div>
        ) : (
          dashboards.map((dashboard) => (
            <DashboardCard
              key={dashboard.id}
              dashboard={dashboard}
              isExpanded={expandedId === dashboard.id}
              isEditing={editingId === dashboard.id}
              isDeleting={deleting === dashboard.id}
              isSaving={saving}
              onToggleExpand={() => setExpandedId(expandedId === dashboard.id ? null : dashboard.id)}
              onEdit={() => setEditingId(editingId === dashboard.id ? null : dashboard.id)}
              onDelete={() => handleDelete(dashboard.id)}
              onSetDefault={() => handleSetDefault(dashboard.id)}
              onSaveWidgets={(widgets) => handleSaveWidgets(dashboard.id, widgets)}
            />
          ))
        )}
      </div>

      {/* Info Card */}
      <div className="bg-muted/30 p-4 rounded border border-border/50 flex gap-4">
        <LayoutDashboard className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="space-y-1">
          <p className="text-xs font-bold text-foreground">About Custom Dashboards</p>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Custom dashboards let you choose which analytics widgets to display. Set a dashboard as
            default to use it as your main analytics view. Each dashboard can have a different set of widgets.
          </p>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Dashboard</DialogTitle>
            <DialogDescription>
              Create a custom dashboard with your preferred widgets.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Marketing Overview, Weekly KPIs..."
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="What is this dashboard for?"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-3">
              <Label>Widgets</Label>
              {CATEGORIES.map((cat) => {
                const catWidgets = formWidgets.filter((w) => w.category === cat.id);
                return (
                  <div key={cat.id}>
                    <h4 className={cn('text-xs font-bold uppercase tracking-wider mb-2', cat.color)}>{cat.label}</h4>
                    <div className="space-y-1.5">
                      {catWidgets.map((widget) => (
                        <button
                          key={widget.id}
                          type="button"
                          onClick={() => toggleFormWidget(widget.id)}
                          className={cn(
                            'flex items-center gap-3 w-full p-2.5 rounded border text-left transition-all text-sm',
                            widget.enabled
                              ? 'border-primary/50 bg-primary/5'
                              : 'border-border/50 hover:border-border'
                          )}
                        >
                          {widget.enabled ? (
                            <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                          ) : (
                            <X className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                          )}
                          <span className="font-medium">{widget.title}</span>
                          <Badge variant="outline" className="ml-auto text-[9px] h-4 px-1">
                            {widget.type}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !formName.trim()} className="gap-1.5">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LayoutDashboard className="h-3.5 w-3.5" />}
              Create Dashboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Dashboard Card Sub-component ---

interface DashboardCardProps {
  dashboard: CustomDashboardData;
  isExpanded: boolean;
  isEditing: boolean;
  isDeleting: boolean;
  isSaving: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  onSaveWidgets: (widgets: WidgetConfig[]) => void;
}

function DashboardCard({
  dashboard, isExpanded, isEditing, isDeleting, isSaving,
  onToggleExpand, onEdit, onDelete, onSetDefault, onSaveWidgets,
}: DashboardCardProps) {
  const [localWidgets, setLocalWidgets] = useState<WidgetConfig[]>(dashboard.widgets);

  useEffect(() => {
    setLocalWidgets(dashboard.widgets);
  }, [dashboard.widgets]);

  const toggleWidget = (widgetId: string) => {
    setLocalWidgets((prev) =>
      prev.map((w) => (w.id === widgetId ? { ...w, enabled: !w.enabled } : w))
    );
  };

  const enabledCount = (dashboard.widgets || []).filter((w) => w.enabled).length;

  return (
    <div className="bg-card/50 backdrop-blur-sm rounded border border-border/50 hover:border-primary/30 transition-all">
      {/* Header row */}
      <div className="p-4 flex items-center justify-between">
        <button onClick={onToggleExpand} className="flex items-center gap-3 min-w-0 flex-1 text-left">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-foreground truncate">{dashboard.name}</h4>
              {dashboard.isDefault && (
                <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider px-1.5 h-4 bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                  Default
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>{enabledCount} widget{enabledCount !== 1 ? 's' : ''}</span>
              <span>Created {format(new Date(dashboard.createdAt), 'MMM d, yyyy')}</span>
            </div>
          </div>
          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        </button>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {!dashboard.isDefault && (
            <Button variant="ghost" size="sm" onClick={onSetDefault} className="gap-1 text-xs h-8">
              <Star className="h-3.5 w-3.5" />
              Set Default
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onEdit} className="gap-1 text-xs h-8">
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            disabled={isDeleting}
            className="h-8 w-8 text-muted-foreground hover:text-rose-500"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Expanded widget editor */}
      {(isExpanded || isEditing) && (
        <div className="border-t border-border/50 p-4 space-y-4">
          {dashboard.description && (
            <p className="text-xs text-muted-foreground">{dashboard.description}</p>
          )}
          {CATEGORIES.map((cat) => {
            const catWidgets = (isEditing ? localWidgets : dashboard.widgets).filter(
              (w) => w.category === cat.id
            );
            if (catWidgets.length === 0) return null;
            return (
              <div key={cat.id}>
                <h4 className={cn('text-xs font-bold uppercase tracking-wider mb-2', cat.color)}>{cat.label}</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {catWidgets.map((widget) => (
                    <div
                      key={widget.id}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded border text-sm transition-all',
                        widget.enabled ? 'border-primary/30 bg-primary/5' : 'border-border/30 opacity-50',
                        isEditing && 'cursor-pointer hover:border-primary/50'
                      )}
                      onClick={isEditing ? () => toggleWidget(widget.id) : undefined}
                    >
                      {isEditing && (
                        <Switch checked={widget.enabled} className="scale-75" tabIndex={-1} />
                      )}
                      <span className="text-xs font-medium truncate">{widget.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {isEditing && (
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={onEdit}>Cancel</Button>
              <Button
                size="sm"
                onClick={() => onSaveWidgets(localWidgets)}
                disabled={isSaving}
                className="gap-1.5"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save Widgets
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
