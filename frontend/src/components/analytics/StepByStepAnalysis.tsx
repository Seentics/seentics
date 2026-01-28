'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Users, 
  Target,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

interface StepAnalytics {
  step_id: string;
  step_name: string;
  step_order: number;
  visitors_reached: number;
  conversion_rate: number;
  drop_off_rate: number;
  avg_time_on_step?: number;
}

interface StepByStepAnalysisProps {
  stepAnalytics: StepAnalytics[];
  totalVisitors: number;
}

// Helper function to format time with proper precision
function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00.00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const wholeSeconds = Math.floor(remainingSeconds);
  const milliseconds = Math.round((remainingSeconds - wholeSeconds) * 100);
  
  return `${minutes}:${wholeSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
}

export function StepByStepAnalysis({ stepAnalytics, totalVisitors }: StepByStepAnalysisProps) {
  if (!stepAnalytics || stepAnalytics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Step-by-Step Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No step data available yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxVisitors = Math.max(...stepAnalytics.map(step => step.visitors_reached));
  const bestPerformingStep = stepAnalytics.reduce((best, current) => 
    (isFinite(current.conversion_rate) ? current.conversion_rate : 0) > 
    (isFinite(best.conversion_rate) ? best.conversion_rate : 0) ? current : best
  );
  const biggestDropOff = stepAnalytics.reduce((worst, current) => 
    (isFinite(current.drop_off_rate) ? current.drop_off_rate : 0) > 
    (isFinite(worst.drop_off_rate) ? worst.drop_off_rate : 0) ? current : worst
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Step-by-Step Analysis
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Detailed breakdown of how visitors progress through each step
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {stepAnalytics.map((step, index) => {
              const isLast = index === stepAnalytics.length - 1;
              const nextStep = stepAnalytics[index + 1];
              const visitorsLost = nextStep ? step.visitors_reached - nextStep.visitors_reached : 0;
              const percentageOfTotal = totalVisitors > 0 ? ((step.visitors_reached / totalVisitors) * 100) : 0;
              
              return (
                <div key={step.step_id} className="relative">
                  {/* Step Header */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl shadow-lg">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                        {step.step_name}
                      </h3>
                      <div className="flex items-center gap-2">
                        {isFinite(step.conversion_rate) && step.conversion_rate > 70 ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200 px-3 py-1">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Excellent
                          </Badge>
                        ) : isFinite(step.conversion_rate) && step.conversion_rate > 50 ? (
                          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 px-3 py-1">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Good
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 border-red-200 px-3 py-1">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Needs Attention
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Metrics Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    {/* Visitors Card */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Visitors</span>
                      </div>
                      <div className="text-3xl font-bold text-blue-900 dark:text-blue-100 mb-1">
                        {step.visitors_reached.toLocaleString()}
                      </div>
                      <div className="text-sm text-blue-700 dark:text-blue-400">
                        {percentageOfTotal.toFixed(1)}% of total
                      </div>
                    </div>
                    
                    {/* Conversion Card */}
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800 dark:text-green-300">Conversion</span>
                      </div>
                      <div className="text-3xl font-bold text-green-900 dark:text-green-100 mb-1">
                        {isFinite(step.conversion_rate) ? step.conversion_rate.toFixed(1) : '0.0'}%
                      </div>
                      <div className="text-sm text-green-700 dark:text-green-400">
                        {isLast ? 'Completed' : 'To next step'}
                      </div>
                    </div>
                    
                    {/* Drop-off Card */}
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium text-red-800 dark:text-red-300">Drop-off</span>
                      </div>
                      <div className="text-3xl font-bold text-red-900 dark:text-red-100 mb-1">
                        {isFinite(step.drop_off_rate) ? step.drop_off_rate.toFixed(1) : '0.0'}%
                      </div>
                      <div className="text-sm text-red-700 dark:text-red-400">
                        {visitorsLost.toLocaleString()} people
                      </div>
                    </div>
                    
                    {/* Time Card */}
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-purple-600" />
                        <span className="text-sm font-medium text-purple-800 dark:text-purple-300">Time</span>
                      </div>
                      <div className="text-3xl font-bold text-purple-900 dark:text-purple-100 mb-1">
                        {formatTime(step.avg_time_on_step || 0)}
                      </div>
                      <div className="text-sm text-purple-700 dark:text-purple-400">
                        Avg. time
                      </div>
                    </div>
                  </div>

                  {/* Progress Section */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Progress through funnel</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {percentageOfTotal.toFixed(1)}% of all visitors
                      </span>
                    </div>
                    <Progress 
                      value={(step.visitors_reached / maxVisitors) * 100} 
                      className="h-3 bg-gray-200 dark:bg-gray-700"
                    />
                    {visitorsLost > 0 && (
                      <div className="text-sm text-red-600 dark:text-red-400 mt-2">
                        {visitorsLost.toLocaleString()} people left ({((visitorsLost / step.visitors_reached) * 100).toFixed(1)}%)
                      </div>
                    )}
                  </div>

                  {/* Connection Line */}
                  {index < stepAnalytics.length - 1 && (
                    <div className="flex justify-center py-4">
                      <div className="w-px h-8 bg-gray-300 dark:bg-gray-600" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      
      {/* Key Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Key Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-800 dark:text-green-300">Best Performing Step</span>
              </div>
              <p className="text-sm text-green-700 dark:text-green-400">
                {bestPerformingStep.step_name}
              </p>
            </div>
            
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <span className="font-medium text-red-800 dark:text-red-300">Biggest Drop-off</span>
              </div>
              <p className="text-sm text-red-700 dark:text-red-400">
                {biggestDropOff.step_name}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
