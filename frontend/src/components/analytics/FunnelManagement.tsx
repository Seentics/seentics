'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Target, 
  Plus, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Play, 
  Pause, 
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  AlertCircle
} from 'lucide-react';
import { FunnelBuilder } from './FunnelBuilder';
import { EnhancedFunnelChart } from './EnhancedFunnelChart';
import { 
  useFunnels, 
  useFunnelAnalytics, 
  useCreateFunnel, 
  useUpdateFunnel, 
  useDeleteFunnel,
  type Funnel 
} from '@/lib/analytics-api';

interface FunnelManagementProps {
  websiteId: string;
  dateRange: number;
  onCreateWorkflow?: (step: string) => void;
}

export function FunnelManagement({ websiteId, dateRange, onCreateWorkflow }: FunnelManagementProps) {
  const [selectedFunnel, setSelectedFunnel] = useState<string | null>(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<Funnel | null>(null);

  // API hooks
  const { data: funnels = [], isLoading: funnelsLoading, error: funnelsError } = useFunnels(websiteId);
  const { data: funnelAnalytics, isLoading: analyticsLoading } = useFunnelAnalytics(
    selectedFunnel || '', 
    dateRange
  );
  
  const createFunnelMutation = useCreateFunnel();
  const updateFunnelMutation = useUpdateFunnel();
  const deleteFunnelMutation = useDeleteFunnel();

  // Set default selected funnel
  React.useEffect(() => {
    if (funnels.length > 0 && !selectedFunnel) {
      setSelectedFunnel(funnels[0].id);
    }
  }, [funnels.length, selectedFunnel]);

  const handleCreateFunnel = (funnelData: Omit<Funnel, 'id' | 'website_id' | 'created_at' | 'updated_at'>) => {
    createFunnelMutation.mutate(
      { websiteId, funnelData },
      {
        onSuccess: (newFunnel) => {
          setSelectedFunnel(newFunnel.id);
          setIsBuilderOpen(false);
        },
        onError: (error) => {
          console.error('Failed to create funnel:', error);
          alert('Failed to create funnel. Please try again.');
        }
      }
    );
  };

  const handleUpdateFunnel = (funnelData: Omit<Funnel, 'id' | 'website_id' | 'created_at' | 'updated_at'>) => {
    if (!editingFunnel) return;
    
    updateFunnelMutation.mutate(
      { funnelId: editingFunnel.id, funnelData },
      {
        onSuccess: () => {
          setEditingFunnel(null);
          setIsBuilderOpen(false);
        },
        onError: (error) => {
          console.error('Failed to update funnel:', error);
          alert('Failed to update funnel. Please try again.');
        }
      }
    );
  };

  const handleDeleteFunnel = (funnelId: string) => {
    if (!confirm('Are you sure you want to delete this funnel? This action cannot be undone.')) {
      return;
    }

    deleteFunnelMutation.mutate(funnelId, {
      onSuccess: () => {
        if (selectedFunnel === funnelId) {
          setSelectedFunnel(funnels.find(f => f.id !== funnelId)?.id || null);
        }
      },
      onError: (error) => {
        console.error('Failed to delete funnel:', error);
        alert('Failed to delete funnel. Please try again.');
      }
    });
  };

  const handleToggleFunnelStatus = (funnel: Funnel) => {
    updateFunnelMutation.mutate({
      funnelId: funnel.id,
      funnelData: { is_active: !funnel.is_active }
    });
  };

  const selectedFunnelData = funnels.find(f => f.id === selectedFunnel);

  if (funnelsLoading) {
    return (
      <Card className="bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            <div className="h-4 bg-muted rounded animate-pulse w-32"></div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded animate-pulse"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (funnelsError) {
    return (
      <Card className="bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            Failed to Load Funnels
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Unable to load funnel data. Please check your connection and try again.
          </p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Funnel Management Header */}
      <Card className="bg-card shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              <CardTitle>Conversion Funnels</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {funnels.length} funnel{funnels.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingFunnel(null)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Funnel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingFunnel ? 'Edit Funnel' : 'Create New Funnel'}
                  </DialogTitle>
                </DialogHeader>
                <FunnelBuilder
                  websiteId={websiteId}
                  existingFunnel={editingFunnel || undefined}
                  onSave={editingFunnel ? handleUpdateFunnel : handleCreateFunnel}
                  onCancel={() => {
                    setIsBuilderOpen(false);
                    setEditingFunnel(null);
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        {funnels.length > 0 && (
          <CardContent>
            <div className="space-y-4">
              {/* Funnel Selector */}
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">Selected Funnel:</label>
                <Select value={selectedFunnel || ''} onValueChange={setSelectedFunnel}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select a funnel" />
                  </SelectTrigger>
                  <SelectContent>
                    {funnels.map(funnel => (
                      <SelectItem key={funnel.id} value={funnel.id}>
                        <div className="flex items-center gap-2">
                          <span>{funnel.name}</span>
                          <Badge 
                            variant={funnel.is_active ? "default" : "secondary"} 
                            className="text-xs"
                          >
                            {funnel.is_active ? 'Active' : 'Paused'}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Funnel Quick Stats */}
              {selectedFunnelData && (
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded">
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-sm font-medium">{selectedFunnelData.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedFunnelData.steps.length} steps • Created {new Date(selectedFunnelData.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {funnelAnalytics && funnelAnalytics.analytics && funnelAnalytics.analytics.length > 0 && (
                      <>
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-600">
                            {funnelAnalytics.analytics[0].total_starts?.toLocaleString() || '0'}
                          </div>
                          <div className="text-xs text-muted-foreground">Total Visitors</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600">
                            {funnelAnalytics.analytics[0].conversion_rate?.toFixed(1) || '0'}%
                          </div>
                          <div className="text-xs text-muted-foreground">Conversion Rate</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-orange-600">
                            {funnelAnalytics.analytics[0].drop_off_rate?.toFixed(1) || '0'}%
                          </div>
                          <div className="text-xs text-muted-foreground">Drop-off Rate</div>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleToggleFunnelStatus(selectedFunnelData)}
                      size="sm"
                      variant="outline"
                      disabled={updateFunnelMutation.isPending}
                    >
                      {selectedFunnelData.is_active ? (
                        <>
                          <Pause className="w-4 h-4 mr-2" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Activate
                        </>
                      )}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingFunnel(selectedFunnelData);
                            setIsBuilderOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Funnel
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteFunnel(selectedFunnelData.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Funnel
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Funnel Visualization */}
      {selectedFunnelData && funnelAnalytics && funnelAnalytics.analytics ? (
        <EnhancedFunnelChart
          funnel={selectedFunnelData}
          analytics={{
            funnelId: selectedFunnelData.id,
            totalVisitors: funnelAnalytics.analytics[0]?.total_starts || 0,
            steps: [],
            overallConversionRate: funnelAnalytics.analytics[0]?.conversion_rate || 0,
            biggestDropOff: {
              stepName: 'Unknown',
              dropOffRate: funnelAnalytics.analytics[0]?.drop_off_rate || 0
            },
            dateRange: {
              startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              endDate: new Date().toISOString()
            }
          }}
          isLoading={analyticsLoading}
          onCreateWorkflow={onCreateWorkflow}
        />
      ) : funnels.length === 0 ? (
        <Card className="bg-card shadow-sm">
          <CardContent className="py-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-muted rounded-full">
                <Target className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium text-lg">No Funnels Created</h3>
                <p className="text-muted-foreground">
                  Create your first conversion funnel to start tracking user journeys
                </p>
              </div>
              <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Funnel
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Funnel</DialogTitle>
                  </DialogHeader>
                  <FunnelBuilder
                    websiteId={websiteId}
                    onSave={handleCreateFunnel}
                    onCancel={() => setIsBuilderOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
