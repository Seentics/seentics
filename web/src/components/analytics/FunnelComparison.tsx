'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Users, 
  Target,
  Trophy,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { useCompareFunnels, useFunnels } from '@/lib/analytics-api';
import { useToast } from '@/hooks/use-toast';

interface FunnelComparisonResult {
  funnel_id: string;
  funnel_name: string;
  total_starts: number;
  total_conversions: number;
  conversion_rate: number;
  drop_off_rate: number;
  avg_time_to_convert?: number;
  performance_score: number;
}

interface FunnelComparisonProps {
  websiteId: string;
}

export function FunnelComparison({ websiteId }: FunnelComparisonProps) {
  const [selectedFunnels, setSelectedFunnels] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<number>(7);
  const [comparisonResults, setComparisonResults] = useState<FunnelComparisonResult[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  
  const { toast } = useToast();
  const { data: funnels = [] } = useFunnels(websiteId);
  const compareFunnelsMutation = useCompareFunnels();

  const handleFunnelToggle = (funnelId: string) => {
    setSelectedFunnels(prev => 
      prev.includes(funnelId) 
        ? prev.filter(id => id !== funnelId)
        : [...prev, funnelId]
    );
  };

  const handleCompare = async () => {
    if (selectedFunnels.length < 2) {
      toast({
        title: "Select at least 2 funnels",
        description: "Please select at least 2 funnels to compare.",
        variant: "destructive",
      });
      return;
    }

    setIsComparing(true);
    try {
      const result = await compareFunnelsMutation.mutateAsync({
        websiteId,
        funnelIds: selectedFunnels,
        dateRange,
      });
      
      setComparisonResults(result.data || []);
      
      toast({
        title: "Comparison Complete",
        description: `Successfully compared ${selectedFunnels.length} funnels.`,
      });
    } catch (error) {
      toast({
        title: "Comparison Failed",
        description: "Failed to compare funnels. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsComparing(false);
    }
  };

  const getPerformanceBadge = (score: number) => {
    if (score >= 80) {
      return <Badge className="bg-green-100 text-green-700"><Trophy className="h-3 w-3 mr-1" />Excellent</Badge>;
    } else if (score >= 60) {
      return <Badge className="bg-blue-100 text-blue-700"><CheckCircle className="h-3 w-3 mr-1" />Good</Badge>;
    } else if (score >= 40) {
      return <Badge variant="secondary"><TrendingUp className="h-3 w-3 mr-1" />Average</Badge>;
    } else {
      return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Needs Work</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Funnel Comparison
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Compare performance across multiple funnels
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Selection Controls */}
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-3">Select Funnels to Compare</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto">
              {funnels.map((funnel) => (
                <div key={funnel.id} className="flex items-center space-x-3 p-3 border rounded hover:bg-muted/50">
                  <Checkbox
                    id={funnel.id}
                    checked={selectedFunnels.includes(funnel.id)}
                    onCheckedChange={() => handleFunnelToggle(funnel.id)}
                  />
                  <label htmlFor={funnel.id} className="flex-1 cursor-pointer">
                    <div className="font-medium">{funnel.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {funnel.steps.length} steps • {funnel.is_active ? 'Active' : 'Paused'}
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Date Range</label>
              <Select value={dateRange.toString()} onValueChange={(value) => setDateRange(parseInt(value))}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1" />
            
            <Button 
              onClick={handleCompare}
              disabled={selectedFunnels.length < 2 || isComparing}
              className="mt-6"
            >
              {isComparing ? 'Comparing...' : `Compare ${selectedFunnels.length} Funnels`}
            </Button>
          </div>
        </div>

        {/* Comparison Results */}
        {comparisonResults.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-semibold">Comparison Results</h4>
            
            {/* Performance Ranking */}
            <div className="space-y-3">
              {comparisonResults.map((result, index) => (
                <div key={result.funnel_id} className="p-4 border rounded hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                        index === 0 ? 'bg-yellow-500' : 
                        index === 1 ? 'bg-gray-400' : 
                        index === 2 ? 'bg-orange-500' : 'bg-gray-300'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <h5 className="font-semibold">{result.funnel_name}</h5>
                        <p className="text-sm text-muted-foreground">
                          Performance Score: {result.performance_score.toFixed(1)}
                        </p>
                      </div>
                    </div>
                    {getPerformanceBadge(result.performance_score)}
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                      <div className="flex items-center justify-center mb-1">
                        <Users className="h-4 w-4 text-blue-600 mr-1" />
                        <span className="text-xs text-blue-600 font-medium">Visitors</span>
                      </div>
                      <p className="text-lg font-bold">{result.total_starts.toLocaleString()}</p>
                    </div>
                    
                    <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded">
                      <div className="flex items-center justify-center mb-1">
                        <Target className="h-4 w-4 text-green-600 mr-1" />
                        <span className="text-xs text-green-600 font-medium">Conversions</span>
                      </div>
                      <p className="text-lg font-bold">{result.total_conversions.toLocaleString()}</p>
                    </div>
                    
                    <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded">
                      <div className="flex items-center justify-center mb-1">
                        <TrendingUp className="h-4 w-4 text-purple-600 mr-1" />
                        <span className="text-xs text-purple-600 font-medium">Rate</span>
                      </div>
                      <p className="text-lg font-bold text-purple-600">
                        {result.conversion_rate.toFixed(1)}%
                      </p>
                    </div>
                    
                    <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded">
                      <div className="flex items-center justify-center mb-1">
                        <Clock className="h-4 w-4 text-orange-600 mr-1" />
                        <span className="text-xs text-orange-600 font-medium">Time</span>
                      </div>
                      <p className="text-lg font-bold">
                        {result.avg_time_to_convert ? 
                          `${Math.floor(result.avg_time_to_convert / 60)}:${(result.avg_time_to_convert % 60).toString().padStart(2, '0')}` : 
                          'N/A'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary Insights */}
            <div className="pt-4 border-t">
              <h4 className="font-semibold mb-4">Key Insights</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">Best Performing Funnel</span>
                  </div>
                  <p className="text-sm text-green-800">
                    {comparisonResults[0]?.funnel_name} with {comparisonResults[0]?.conversion_rate.toFixed(1)}% conversion rate
                  </p>
                </div>
                
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">Performance Gap</span>
                  </div>
                  <p className="text-sm text-blue-800">
                    {comparisonResults.length > 1 ? 
                      `${(comparisonResults[0]?.conversion_rate - comparisonResults[comparisonResults.length - 1]?.conversion_rate).toFixed(1)}% difference between best and worst` :
                      'Only one funnel selected'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
