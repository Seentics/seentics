'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Users, 
  TrendingUp, 
  Clock,
  Target
} from 'lucide-react';

interface CohortData {
  cohort_date: string;
  cohort_size: number;
  conversions: number;
  conversion_rate: number;
  avg_time_to_convert: number;
}

interface CohortAnalysisProps {
  cohortData: CohortData[];
}

export function CohortAnalysis({ cohortData }: CohortAnalysisProps) {
  if (!cohortData || cohortData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Cohort Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No cohort data available yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sort cohort data by date (newest first)
  const sortedCohorts = [...cohortData].sort((a, b) => 
    new Date(b.cohort_date).getTime() - new Date(a.cohort_date).getTime()
  );

  // Calculate summary statistics
  const totalCohortSize = sortedCohorts.reduce((sum, cohort) => sum + cohort.cohort_size, 0);
  const totalConversions = sortedCohorts.reduce((sum, cohort) => sum + cohort.conversions, 0);
  const avgConversionRate = totalCohortSize > 0 ? (totalConversions / totalCohortSize) * 100 : 0;
  const avgTimeToConvert = sortedCohorts.reduce((sum, cohort) => sum + cohort.avg_time_to_convert, 0) / sortedCohorts.length;

  // Find best and worst performing cohorts
  const bestCohort = sortedCohorts.reduce((best, cohort) => 
    cohort.conversion_rate > best.conversion_rate ? cohort : best
  );
  const worstCohort = sortedCohorts.reduce((worst, cohort) => 
    cohort.conversion_rate < worst.conversion_rate ? cohort : worst
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Cohort Analysis
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Track how different user cohorts perform over time
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded">
            <div className="flex items-center justify-center mb-2">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold">{totalCohortSize.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Users</p>
          </div>
          
          <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded">
            <div className="flex items-center justify-center mb-2">
              <Target className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold">{totalConversions.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Conversions</p>
          </div>
          
          <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold">{avgConversionRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Avg Conversion Rate</p>
          </div>
          
          <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded">
            <div className="flex items-center justify-center mb-2">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
            <p className="text-2xl font-bold">
              {Math.floor(avgTimeToConvert / 60)}:{(avgTimeToConvert % 60).toString().padStart(2, '0')}
            </p>
            <p className="text-xs text-muted-foreground">Avg Time to Convert</p>
          </div>
        </div>

        {/* Cohort Performance Table */}
        <div className="space-y-4">
          <h4 className="font-semibold">Cohort Performance</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-right p-3 font-medium">Users</th>
                  <th className="text-right p-3 font-medium">Conversions</th>
                  <th className="text-right p-3 font-medium">Rate</th>
                  <th className="text-right p-3 font-medium">Avg Time</th>
                  <th className="text-center p-3 font-medium">Performance</th>
                </tr>
              </thead>
              <tbody>
                {sortedCohorts.map((cohort, index) => {
                  const isBest = cohort.cohort_date === bestCohort.cohort_date;
                  const isWorst = cohort.cohort_date === worstCohort.cohort_date;
                  
                  return (
                    <tr key={cohort.cohort_date} className="border-b hover:bg-muted/50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {new Date(cohort.cohort_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="text-right p-3 font-medium">
                        {cohort.cohort_size.toLocaleString()}
                      </td>
                      <td className="text-right p-3 font-medium">
                        {cohort.conversions.toLocaleString()}
                      </td>
                      <td className="text-right p-3">
                        <span className={`font-medium ${
                          cohort.conversion_rate > avgConversionRate ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {cohort.conversion_rate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="text-right p-3 text-muted-foreground">
                        {Math.floor(cohort.avg_time_to_convert / 60)}:{(cohort.avg_time_to_convert % 60).toString().padStart(2, '0')}
                      </td>
                      <td className="text-center p-3">
                        {isBest ? (
                          <Badge variant="default" className="bg-green-100 text-green-700">
                            Best
                          </Badge>
                        ) : isWorst ? (
                          <Badge variant="destructive" className="bg-red-100 text-red-700">
                            Needs Work
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            Average
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Insights */}
        <div className="pt-4 border-t">
          <h4 className="font-semibold mb-4">Key Insights</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">Best Performing Cohort</span>
              </div>
              <p className="text-sm text-green-800">
                {new Date(bestCohort.cohort_date).toLocaleDateString()} - {bestCohort.conversion_rate.toFixed(1)}% conversion rate
              </p>
            </div>
            
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-red-700">Opportunity for Improvement</span>
              </div>
              <p className="text-sm text-red-800">
                {new Date(worstCohort.cohort_date).toLocaleDateString()} - {worstCohort.conversion_rate.toFixed(1)}% conversion rate
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
