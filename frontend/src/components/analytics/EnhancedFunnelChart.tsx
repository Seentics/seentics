'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Clock, 
  Users, 
  Activity, 
  AlertTriangle,
  Lightbulb,
  Plus
} from 'lucide-react';
import type { FunnelAnalytics, Funnel } from '@/lib/analytics-api';

interface EnhancedFunnelChartProps {
  funnel: Funnel;
  analytics: FunnelAnalytics;
  isLoading?: boolean;
  onCreateWorkflow?: (step: string) => void;
}

export function EnhancedFunnelChart({ 
  funnel, 
  analytics, 
  isLoading = false,
  onCreateWorkflow 
}: EnhancedFunnelChartProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'insights' | 'opportunities'>('overview');
  
  if (isLoading) {
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
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse"></div>
                <div className="h-6 bg-muted rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...analytics.steps.map(step => step.count));

  const getStepColor = (index: number): string => {
    const colors = [
      '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', 
      '#EC4899', '#06B6D4', '#84CC16', '#F97316'
    ];
    return colors[index % colors.length];
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getWorkflowOpportunities = () => {
    return analytics.steps
      .filter(step => step.dropOffRate > 30)
      .map(step => ({
        step: step.name,
        dropOffRate: step.dropOffRate,
        opportunity: step.dropOffRate > 50 ? 'High Priority' : 'Medium Priority',
        suggestedActions: [
          'Exit intent popup',
          'Email follow-up sequence',
          'Retargeting campaign'
        ]
      }));
  };

  return (
    <Card className="bg-card shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            <CardTitle className="text-foreground">{funnel.name}</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {analytics?.totalVisitors?.toLocaleString() || '0'} visitors
            </Badge>
          </div>
        </div>
        {funnel.description && (
          <p className="text-sm text-muted-foreground">{funnel.description}</p>
        )}
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
            <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
          {/* Funnel Visualization */}
          <div className="space-y-4">
            {analytics.steps.map((step, index) => {
              const widthPercentage = (step.count / maxCount) * 100;
              const isFirst = index === 0;
              
              return (
                <div key={step.stepId} className="relative">
                  {/* Step Label and Metrics */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-6 h-6 rounded-full text-xs font-medium flex items-center justify-center text-white font-semibold"
                        style={{ backgroundColor: getStepColor(index) }}
                      >
                        {index + 1}
                      </div>
                      <span className="font-medium text-sm text-foreground">{step.name}</span>
                    </div>
                    <div className="flex items-center space-x-3 text-sm">
                      <span className="text-muted-foreground">
                        {step.count?.toLocaleString() || '0'}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {(step.conversionRate || 0).toFixed(1)}%
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatTime(step.avgTimeOnStep)}
                      </div>
                      {!isFirst && (
                        <div className="flex items-center space-x-1">
                          {step.dropOffRate > 0 ? (
                            <TrendingDown className="w-3 h-3 text-red-500" />
                          ) : (
                            <TrendingUp className="w-3 h-3 text-green-500" />
                          )}
                          <span className={`text-xs ${
                            step.dropOffRate > 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {(step.dropOffRate || 0) > 0 ? '-' : '+'}{Math.abs(step.dropOffRate || 0).toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Funnel Bar */}
                  <div className="relative">
                    <div className="h-6 bg-muted rounded overflow-hidden">
                      <div 
                        className="h-full transition-all duration-500 ease-out"
                        style={{ 
                          width: `${widthPercentage}%`,
                          backgroundColor: getStepColor(index)
                        }}
                      />
                    </div>
                    
                    {/* Width indicator */}
                    <div className="absolute top-0 right-0 h-full flex items-center pr-2">
                      <span className="text-xs text-white font-medium">
                        {(widthPercentage || 0).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Drop-off indicator and workflow opportunity */}
                  {index < analytics.steps.length - 1 && (
                    <div className="flex items-center justify-center mt-2 space-x-2">
                      <div className="w-px h-3 bg-border"></div>
                      {step.dropOffRate > 30 && onCreateWorkflow && (
                        <Button
                          onClick={() => onCreateWorkflow(step.name)}
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Create Workflow
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary Stats */}
          <div className="mt-6 pt-4 border-t border-border">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-xl font-bold text-blue-600">
                  {analytics.steps?.[analytics.steps?.length - 1]?.count?.toLocaleString() || '0'}
                </div>
                <div className="text-xs text-muted-foreground">Final Conversions</div>
              </div>
              <div>
                <div className="text-xl font-bold text-green-600">
                  {(analytics?.overallConversionRate || 0).toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">Overall Conversion</div>
              </div>
              <div>
                <div className="text-xl font-bold text-orange-600">
                  {(analytics?.biggestDropOff?.dropOffRate || 0).toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">Biggest Drop-off</div>
              </div>
              <div>
                <div className="text-xl font-bold text-purple-600">
                  {Math.round(analytics.steps.reduce((acc, step) => acc + step.avgTimeOnStep, 0) / analytics.steps.length)}s
                </div>
                <div className="text-xs text-muted-foreground">Avg Time/Step</div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid gap-4">
            {/* Performance Insights */}
            <Card className="p-4">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Performance Insights
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                  <div>
                    <p className="text-sm font-medium">Biggest Drop-off Point</p>
                    <p className="text-xs text-muted-foreground">{analytics.biggestDropOff.stepName}</p>
                  </div>
                  <Badge variant="destructive" className="text-xs">
                    -{(analytics?.biggestDropOff?.dropOffRate || 0).toFixed(1)}%
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                  <div>
                    <p className="text-sm font-medium">Best Performing Step</p>
                    <p className="text-xs text-muted-foreground">
                      {analytics.steps.reduce((best, step) => 
                        step.conversionRate > best.conversionRate ? step : best
                      ).name}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {analytics.steps.reduce((best, step) => 
                      step.conversionRate > best.conversionRate ? step : best
                    )?.conversionRate?.toFixed(1) || '0'}%
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                  <div>
                    <p className="text-sm font-medium">Time Efficiency</p>
                    <p className="text-xs text-muted-foreground">
                      Users spend {formatTime(analytics.steps.reduce((acc, step) => acc + step.avgTimeOnStep, 0))} total
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {analytics.steps.filter(step => step.avgTimeOnStep > 180).length} slow steps
                  </Badge>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="opportunities" className="space-y-4">
          <div className="space-y-4">
            {getWorkflowOpportunities().length > 0 ? (
              getWorkflowOpportunities().map((opportunity, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded">
                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">{opportunity.step}</h3>
                        <p className="text-xs text-muted-foreground">
                          {(opportunity?.dropOffRate || 0).toFixed(1)}% drop-off rate
                        </p>
                        <div className="mt-2 space-y-1">
                          <p className="text-xs font-medium">Suggested actions:</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {opportunity.suggestedActions.map((action, i) => (
                              <li key={i} className="flex items-center gap-1">
                                <Lightbulb className="w-3 h-3" />
                                {action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge 
                        variant={opportunity.opportunity === 'High Priority' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {opportunity.opportunity}
                      </Badge>
                      {onCreateWorkflow && (
                        <Button
                          onClick={() => onCreateWorkflow(opportunity.step)}
                          size="sm"
                          className="ml-2 h-6 px-2 text-xs"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Create Workflow
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-6 text-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="font-medium">Great Performance!</h3>
                  <p className="text-sm text-muted-foreground">
                    Your funnel is performing well with no major drop-off points detected.
                  </p>
                </div>
              </Card>
            )}
          </div>
        </TabsContent>
          </Tabs>
      </CardContent>
    </Card>
  );
}
