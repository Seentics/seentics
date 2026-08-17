'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Play,
  Pause,
  ArrowRight,
  Eye,
  Users,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { FunnelBuilder } from './FunnelBuilder';
import { StatCards } from '@/components/seentics-ui/StatCards';
import {
  useFunnels,
  useFunnelAnalytics,
  useCreateFunnel,
  useUpdateFunnel,
  useDeleteFunnel,
  type Funnel
} from '@/lib/analytics-api';
import { isDemo } from '@/lib/demo';

interface FunnelManagementProps {
  websiteId: string;
  dateRange: number;
  onCreateWorkflow?: (step: string) => void;
}

/** Inline row stats: list batch summary (no extra requests). Demo uses analytics API. */
function FunnelRowStats({ funnel, dateRange, websiteId }: { funnel: Funnel; dateRange: number; websiteId: string }) {
  const demoSite = isDemo(websiteId);
  const { data: analytics, isLoading } = useFunnelAnalytics(
    demoSite ? funnel.id : '',
    dateRange,
    demoSite ? websiteId : undefined
  );

  if (demoSite) {
    const item = analytics?.analytics?.[0];
    if (isLoading) {
      return (
        <div className="flex items-center gap-3">
          <div className="h-4 w-12 bg-muted rounded-lg animate-pulse" />
          <div className="h-4 w-10 bg-muted rounded-lg animate-pulse" />
        </div>
      );
    }
    if (!item) return null;
    return (
      <div className="flex items-center gap-3 text-[11px] shrink-0">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Users className="h-3 w-3" />
          <span className="font-medium text-foreground">{item.total_starts?.toLocaleString() || '0'}</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-green-500" />
          <span className="font-medium text-green-600">{item.conversion_rate?.toFixed(1) || '0'}%</span>
        </div>
        {(item.drop_off_rate ?? 0) > 0 && (
          <div className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-orange-400" />
            <span className="font-medium text-orange-500">{item.drop_off_rate?.toFixed(1)}%</span>
          </div>
        )}
      </div>
    );
  }

  const s = funnel.list_summary;
  if (!s) {
    return <span className="text-[11px] text-muted-foreground shrink-0">—</span>;
  }
  const dropPct = s.total_starts > 0 ? ((s.total_starts - s.total_conversions) / s.total_starts) * 100 : 0;
  return (
    <div className="flex items-center gap-3 text-[11px] shrink-0">
      <div className="flex items-center gap-1 text-muted-foreground">
        <Users className="h-3 w-3" />
        <span className="font-medium text-foreground">{s.total_starts.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-1">
        <TrendingUp className="h-3 w-3 text-green-500" />
        <span className="font-medium text-green-600">{s.conversion_rate.toFixed(1)}%</span>
      </div>
      {dropPct > 0 && (
        <div className="flex items-center gap-1">
          <TrendingDown className="h-3 w-3 text-orange-400" />
          <span className="font-medium text-orange-500">{dropPct.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

function FunnelDetailModal({
  funnel,
  dateRange,
  websiteId,
  open,
  onOpenChange
}: {
  funnel: Funnel;
  dateRange: number;
  websiteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: funnelAnalytics, isLoading } = useFunnelAnalytics(
    open ? funnel.id : '',
    dateRange,
    open ? websiteId : undefined
  );

  const analytics = funnelAnalytics?.analytics?.[0];
  const steps = funnel.steps || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border border-border/60 bg-card rounded-lg shadow-xl p-0 gap-0">
        <DialogHeader className="p-5 pb-3 border-b border-border/60">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
            {funnel.name}
            <Badge variant={funnel.is_active ? 'default' : 'secondary'} className="text-[10px] h-5">
              {funnel.is_active ? 'Active' : 'Paused'}
            </Badge>
          </DialogTitle>
          {funnel.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{funnel.description}</p>
          )}
        </DialogHeader>

        <div className="p-5">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Summary stats */}
              {analytics && (
                <StatCards
                  cols={3}
                  cards={[
                    { label: 'Entries', value: analytics.total_starts || 0, icon: Users },
                    { label: 'Conversion', value: `${analytics.conversion_rate?.toFixed(1) || '0'}%`, icon: TrendingUp, iconColor: 'text-green-600', valueColor: 'text-green-600' },
                    { label: 'Drop-off', value: `${analytics.drop_off_rate?.toFixed(1) || '0'}%`, icon: TrendingDown, iconColor: 'text-orange-600', valueColor: 'text-orange-600' },
                  ]}
                />
              )}

              {/* Step-by-step funnel visualization */}
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Funnel Steps</h4>
                <div className="bg-muted/20 border border-border/40 rounded-lg p-4 space-y-0">
                  {steps.map((step, i) => {
                    const isLast = i === steps.length - 1;
                    const widthPct = steps.length > 1 ? 100 - (i * (60 / (steps.length - 1))) : 100;
                    return (
                      <div key={step.id || i}>
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{step.name}</span>
                              <Badge variant="outline" className="text-[9px] h-4 shrink-0 bg-background">
                                {step.type === 'page' ? 'Page' : step.type === 'event' ? 'Event' : 'Custom'}
                              </Badge>
                            </div>
                            <div
                              className="h-1.5 bg-primary/10 rounded-full mt-1.5 overflow-hidden"
                              style={{ width: `${widthPct}%` }}
                            >
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: '100%' }}
                              />
                            </div>
                          </div>
                        </div>
                        {!isLast && (
                          <div className="flex items-center ml-3 py-1">
                            <div className="w-px h-3 bg-border" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground pt-2 border-t border-border/60">
                Created {new Date(funnel.created_at).toLocaleDateString()} · {steps.length} steps
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function FunnelManagement({ websiteId, dateRange, onCreateWorkflow }: FunnelManagementProps) {
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<Funnel | null>(null);
  const [detailFunnel, setDetailFunnel] = useState<Funnel | null>(null);

  const { data: funnels = [], isLoading: funnelsLoading, error: funnelsError } = useFunnels(websiteId);

  const createFunnelMutation = useCreateFunnel();
  const updateFunnelMutation = useUpdateFunnel();
  const deleteFunnelMutation = useDeleteFunnel();

  const handleCreateFunnel = (funnelData: Omit<Funnel, 'id' | 'website_id' | 'created_at' | 'updated_at'>) => {
    createFunnelMutation.mutate(
      { websiteId, funnelData },
      {
        onSuccess: () => setIsBuilderOpen(false),
        onError: (error) => console.error('Failed to create funnel:', error),
      }
    );
  };

  const handleUpdateFunnel = (funnelData: Omit<Funnel, 'id' | 'website_id' | 'created_at' | 'updated_at'>) => {
    if (!editingFunnel) return;
    updateFunnelMutation.mutate(
      { websiteId, funnelId: editingFunnel.id, funnelData },
      {
        onSuccess: () => {
          setEditingFunnel(null);
          setIsBuilderOpen(false);
        },
      }
    );
  };

  const handleDeleteFunnel = (funnelId: string) => {
    if (!confirm('Delete this funnel?')) return;
    deleteFunnelMutation.mutate({ websiteId, funnelId });
  };

  const handleToggleStatus = (funnel: Funnel) => {
    updateFunnelMutation.mutate({
      websiteId,
      funnelId: funnel.id,
      funnelData: { is_active: !funnel.is_active }
    });
  };

  if (funnelsLoading) {
    return (
      <Card className="border border-border/60 bg-card shadow-sm">
        <CardContent className="p-5">
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (funnelsError) {
    return (
      <Card className="border border-border/60 bg-card shadow-sm">
        <CardContent className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Failed to load funnels.</p>
          <Button onClick={() => window.location.reload()} size="sm" variant="outline" className="mt-3 h-7 text-xs">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border border-border/60 bg-card shadow-sm">
        <CardHeader className="p-5 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Conversion Funnels</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {funnels.length} funnel{funnels.length !== 1 ? 's' : ''} configured
              </p>
            </div>
            <Button
              onClick={() => { setEditingFunnel(null); setIsBuilderOpen(true); }}
              size="sm"
              className="h-7 px-2.5 text-xs font-medium rounded-lg gap-1.5 shadow-sm transition-transform active:scale-95"
            >
              <Plus className="h-3 w-3" />
              New Funnel
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {funnels.length === 0 ? (
            <div className="py-10 text-center">
              <div className="text-muted-foreground text-sm mb-1">No funnels yet</div>
              <p className="text-xs text-muted-foreground/70 mb-4">
                Track user journeys from landing to conversion
              </p>
              <Button
                onClick={() => { setEditingFunnel(null); setIsBuilderOpen(true); }}
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
              >
                <Plus className="h-3 w-3" />
                Create Your First Funnel
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {funnels.map((funnel) => (
                <div
                  key={funnel.id}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer group"
                  onClick={() => setDetailFunnel(funnel)}
                >
                  {/* Status dot */}
                  <div className={`w-2 h-2 rounded-full shrink-0 ${funnel.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />

                  {/* Name + step flow */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{funnel.name}</span>
                      <Badge variant="outline" className="text-[9px] h-4 shrink-0 bg-background font-normal">
                        {funnel.steps?.length || 0} steps
                      </Badge>
                    </div>
                    {funnel.steps && funnel.steps.length > 0 && (
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground/70 truncate">
                        {funnel.steps.slice(0, 4).map((step, i) => (
                          <React.Fragment key={step.id || i}>
                            {i > 0 && <ArrowRight className="h-2.5 w-2.5 shrink-0 text-muted-foreground/40" />}
                            <span className="truncate">{step.name}</span>
                          </React.Fragment>
                        ))}
                        {funnel.steps.length > 4 && <span className="text-muted-foreground/50">+{funnel.steps.length - 4}</span>}
                      </div>
                    )}
                  </div>

                  {/* Inline stats */}
                  <FunnelRowStats funnel={funnel} dateRange={dateRange} websiteId={websiteId} />

                  {/* View button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity gap-1"
                    onClick={(e) => { e.stopPropagation(); setDetailFunnel(funnel); }}
                  >
                    <Eye className="h-3 w-3" />
                    View
                  </Button>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStatus(funnel);
                        }}
                      >
                        {funnel.is_active ? (
                          <><Pause className="h-3.5 w-3.5 mr-2" />Pause</>
                        ) : (
                          <><Play className="h-3.5 w-3.5 mr-2" />Activate</>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingFunnel(funnel);
                          setIsBuilderOpen(true);
                        }}
                      >
                        <Edit className="h-3.5 w-3.5 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFunnel(funnel.id);
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Funnel Modal */}
      <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto border border-border/60 bg-card rounded-lg shadow-xl p-0 gap-0">
          <DialogHeader className="p-5 pb-3 border-b border-border/60">
            <DialogTitle className="text-base font-semibold tracking-tight">
              {editingFunnel ? 'Edit Funnel' : 'Create New Funnel'}
            </DialogTitle>
          </DialogHeader>
          <div className="p-5">
            <FunnelBuilder
              websiteId={websiteId}
              existingFunnel={editingFunnel || undefined}
              onSave={editingFunnel ? handleUpdateFunnel : handleCreateFunnel}
              onCancel={() => {
                setIsBuilderOpen(false);
                setEditingFunnel(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Funnel Details Modal */}
      {detailFunnel && (
        <FunnelDetailModal
          funnel={detailFunnel}
          dateRange={dateRange}
          websiteId={websiteId}
          open={!!detailFunnel}
          onOpenChange={(open) => { if (!open) setDetailFunnel(null); }}
        />
      )}
    </>
  );
}
