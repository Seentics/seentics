'use client';

import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Eye, 
  ChevronRight,
  Sparkles,
  Info,
  Loader2,
  MousePointer2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGoals, deleteGoal, Goal } from '@/lib/websites-api';
import { AddGoalModal } from '../websites/modals/AddGoalModal';
import { toast } from 'sonner';

interface GoalsSettingsComponentProps {
  websiteId: string;
}

export function GoalsSettingsComponent({ websiteId }: GoalsSettingsComponentProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals', websiteId],
    queryFn: () => getGoals(websiteId),
    enabled: !!websiteId,
  });

  const deleteMutation = useMutation({
    mutationFn: (goalId: string) => deleteGoal(websiteId, goalId),
    onSuccess: () => {
      toast.success('Goal deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['goals', websiteId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete goal');
    },
  });

  const handleDelete = (goalId: string) => {
    if (confirm('Are you sure you want to delete this goal?')) {
      deleteMutation.mutate(goalId);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Goal Conversions</h2>
          <p className="text-muted-foreground text-sm">Define what success looks like for your website.</p>
        </div>
        <Button 
          onClick={() => setIsAddModalOpen(true)}
          className="h-10 px-5 font-bold rounded gap-2 shadow-lg shadow-primary/20 transition-transform active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Create New Goal
        </Button>
      </div>

      {/* Goals List */}
      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : goals.length === 0 ? (
          <div className="text-center py-12 bg-muted/20 rounded border border-dashed">
            <p className="text-muted-foreground">No goals defined yet. Create your first goal to track success.</p>
          </div>
        ) : (
          goals.map((goal: Goal) => (
            <div 
              key={goal.id} 
              className="group bg-card/50 backdrop-blur-sm p-4 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-border/50 hover:border-primary/30 transition-all hover:bg-card/80"
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded flex items-center justify-center border transition-all duration-500 shadow-sm",
                  goal.type === 'event' ? "bg-indigo-500/10 border-indigo-500/20" : "bg-emerald-500/10 border-emerald-500/20"
                )}>
                  {goal.type === 'event' ? (
                    <MousePointer2 className="h-5 w-5 text-indigo-500" />
                  ) : (
                    <Eye className="h-5 w-5 text-emerald-500" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-bold text-foreground">{goal.name}</h3>
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest px-1.5 h-4 bg-muted/50 border-muted-foreground/10">
                      {goal.type === 'event' ? 'Custom Event' : 'Page Visit'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                    <span className="opacity-50">Identity:</span> {goal.identifier}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-8 sm:gap-12 ml-auto sm:ml-0">
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5 opacity-60">Status</p>
                  <p className="text-sm font-bold text-emerald-500">Active</p>
                </div>
                <div className="h-10 w-px bg-border/40 hidden sm:block mx-2" />
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDelete(goal.id)}
                    className="h-9 w-9 rounded hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )
        ))}
      </div>

      <div className="flex items-center gap-4 p-4 rounded bg-muted/30 border border-border/50">
        <Info className="h-5 w-5 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground font-medium">
          New goals may take up to 5 minutes to appear in your dashboard after the first event is received.
        </p>
      </div>

      <AddGoalModal 
        open={isAddModalOpen} 
        onOpenChange={setIsAddModalOpen} 
        websiteId={websiteId} 
      />
    </div>
  );
}
