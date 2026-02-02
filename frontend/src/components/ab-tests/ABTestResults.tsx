'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, ArrowUpRight, ArrowDownRight, Users, Target } from 'lucide-react';
import { useABTestResults, ABTest } from '@/lib/ab-tests-api';

interface ABTestResultsProps {
  test: ABTest;
}

export function ABTestResults({ test }: ABTestResultsProps) {
  const params = useParams();
  const websiteId = params.websiteId as string;
  const { data: results, isLoading } = useABTestResults(websiteId, test.id!);

  if (isLoading) {
    return <div className="h-64 bg-muted animate-pulse rounded" />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider">Total Visitors</CardDescription>
            <CardTitle className="text-2xl">{results?.reduce((sum, r) => sum + r.visitors, 0).toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider">Total Conversions</CardDescription>
            <CardTitle className="text-2xl">{results?.reduce((sum, r) => sum + r.conversions, 0).toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider">Goal</CardDescription>
            <CardTitle className="text-lg truncate">{test.goal_event_type || test.goal_path}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Variant Performance</CardTitle>
          <CardDescription>How each variant compares to the baseline.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variant</TableHead>
                <TableHead className="text-center">Visitors</TableHead>
                <TableHead className="text-center">Conversions</TableHead>
                <TableHead className="text-right">Conv. Rate</TableHead>
                <TableHead className="text-right">Improvement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results?.map((result, idx) => (
                <TableRow key={result.variant_id} className={result.is_winner ? "bg-emerald-500/5" : ""}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{result.variant_name}</span>
                      {result.is_winner && (
                        <Badge variant="default" className="bg-emerald-500 text-white">
                          <Trophy className="h-3 w-3 mr-1" /> Winner
                        </Badge>
                      )}
                      {idx === 0 && <Badge variant="outline">Control</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-mono">{result.visitors.toLocaleString()}</TableCell>
                  <TableCell className="text-center font-mono">{result.conversions.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="space-y-1">
                      <div className="font-bold">{result.conversion_rate.toFixed(2)}%</div>
                      <Progress value={result.conversion_rate} className="h-1" />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {idx === 0 ? (
                      <span className="text-muted-foreground">-</span>
                    ) : (
                      <div className={`flex items-center justify-end font-bold ${
                        (result.improvement || 0) > 0 ? "text-emerald-600" : "text-red-600"
                      }`}>
                        {(result.improvement || 0) > 0 ? <ArrowUpRight className="h-4 w-4 mr-1" /> : <ArrowDownRight className="h-4 w-4 mr-1" />}
                        {Math.abs(result.improvement || 0).toFixed(1)}%
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
