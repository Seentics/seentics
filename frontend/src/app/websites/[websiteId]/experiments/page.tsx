'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { 
  Plus, 
  FlaskConical, 
  Play, 
  Pause, 
  Trash2, 
  TrendingUp, 
  Users, 
  Target,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  useABTests, 
  useABTestResults, 
  ABTest, 
  ABVariant, 
  createABTest, 
  updateABTestStatus, 
  deleteABTest 
} from '@/lib/ab-tests-api';
import { useToast } from '@/hooks/use-toast';
import { CreateABTestModal } from '@/components/ab-tests/CreateABTestModal';
import { ABTestResults } from '@/components/ab-tests/ABTestResults';

export default function ExperimentsPage() {
  const params = useParams();
  const websiteId = params.websiteId as string;
  const { toast } = useToast();
  const { data: tests, isLoading, refetch } = useABTests(websiteId);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<ABTest | null>(null);

  const handleStatusChange = async (testId: string, status: 'running' | 'paused' | 'completed') => {
    try {
      await updateABTestStatus(websiteId, testId, status);
      toast({ title: 'Status updated', description: `Experiment is now ${status}` });
      refetch();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  };

  const handleDelete = async (testId: string) => {
    if (!confirm('Are you sure you want to delete this experiment?')) return;
    try {
      await deleteABTest(websiteId, testId);
      toast({ title: 'Experiment deleted' });
      refetch();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete experiment', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-40 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">A/B Experiments</h1>
          <p className="text-muted-foreground">Test different versions of your site to optimize conversions.</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Experiment
        </Button>
      </div>

      {selectedTest ? (
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => setSelectedTest(null)}>
            <ChevronRight className="mr-2 h-4 w-4 rotate-180" />
            Back to list
          </Button>
          <ABTestResults test={selectedTest} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tests?.map((test) => (
            <Card key={test.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <Badge variant={
                    test.status === 'running' ? 'default' : 
                    test.status === 'completed' ? 'secondary' : 'outline'
                  }>
                    {test.status}
                  </Badge>
                  <div className="flex gap-2">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(test.id!)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="mt-2">{test.name}</CardTitle>
                <CardDescription>{test.description || 'No description'}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-muted-foreground">
                    <Target className="mr-2 h-4 w-4" />
                    Goal: {test.goal_event_type || test.goal_path}
                  </div>
                  <div className="flex items-center text-muted-foreground">
                    <Users className="mr-2 h-4 w-4" />
                    {test.variants?.length} Variants
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setSelectedTest(test)}>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Results
                </Button>
                {test.status === 'draft' || test.status === 'paused' ? (
                  <Button variant="outline" size="icon" onClick={() => handleStatusChange(test.id!, 'running')}>
                    <Play className="h-4 w-4" />
                  </Button>
                ) : test.status === 'running' ? (
                  <Button variant="outline" size="icon" onClick={() => handleStatusChange(test.id!, 'paused')}>
                    <Pause className="h-4 w-4" />
                  </Button>
                ) : null}
              </CardFooter>
            </Card>
          ))}

          {tests?.length === 0 && (
            <Card className="col-span-full py-12">
              <CardContent className="flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <FlaskConical className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold">No experiments yet</h3>
                  <p className="text-sm text-muted-foreground w-64">
                    Create your first A/B test to start optimizing your conversion rates.
                  </p>
                </div>
                <Button onClick={() => setIsCreateModalOpen(true)}>Create Experiment</Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <CreateABTestModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onSuccess={() => {
          setIsCreateModalOpen(false);
          refetch();
        }}
        websiteId={websiteId}
      />
    </div>
  );
}
