'use client';

import { MoreHorizontal, Pencil, Trash2, Copy, Loader2, Eye, Search, Target, TrendingUp, Users, Clock, BarChart3, Calendar } from 'lucide-react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { 
  useFunnels, 
  useFunnelAnalytics, 
  useDeleteFunnel, 
  useUpdateFunnel,
  type Funnel 
} from '@/lib/analytics-api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Switch } from './ui/switch';
import { usePathname, useParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMemo, useState } from 'react';

interface FunnelsTableProps {
  siteId: string | null | undefined;
}

// Helper function to format date
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  } catch {
    return 'Invalid Date';
  }
}

// Helper function to format conversion rate
function formatConversionRate(rate: number | undefined | null): string {
  if (rate === undefined || rate === null || isNaN(rate)) return '--';
  if (rate === 0) return '0%';
  if (rate < 1) return '<1%';
  return `${rate.toFixed(1)}%`;
}

// Component to display funnel performance metrics
function FunnelPerformanceCell({ funnelId }: { funnelId: string }) {
  const { data: analyticsResponse, isLoading, error } = useFunnelAnalytics(funnelId, 7); // Last 7 days
  
  // Debug logging
  console.log(`🔍 FunnelPerformanceCell - funnelId: ${funnelId}`);
  console.log(`🔍 FunnelPerformanceCell - analyticsResponse:`, analyticsResponse);
  console.log(`🔍 FunnelPerformanceCell - isLoading:`, isLoading);
  console.log(`🔍 FunnelPerformanceCell - error:`, error);
  
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground">Loading...</span>
      </div>
    );
  }
  
  // Handle different response structures
  let analytics: any[] = [];
  if (analyticsResponse) {
    // Check if it's the new response format
    if ('analytics' in analyticsResponse && Array.isArray(analyticsResponse.analytics)) {
      analytics = analyticsResponse.analytics;
    }
    // Check if it's the old format (direct array)
    else if (Array.isArray(analyticsResponse)) {
      analytics = analyticsResponse;
    }
    // Check if it's a single analytics object
    else if (analyticsResponse && typeof analyticsResponse === 'object') {
      analytics = [analyticsResponse];
    }
  }
  
  console.log(`🔍 FunnelPerformanceCell - processed analytics:`, analytics);
  
  if (error || !analytics || analytics.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-1 text-green-600">
            <TrendingUp className="h-3 w-3" />
            <span className="font-medium">0%</span>
          </div>
          <span className="text-muted-foreground">|</span>
          <div className="flex items-center gap-1 text-blue-600">
            <Users className="h-3 w-3" />
            <span className="font-medium">0</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm mt-1">
          <div className="flex items-center gap-1 text-red-600">
            <BarChart3 className="h-3 w-3" />
            <span className="font-medium">0%</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">No events yet • Ready to track</p>
      </div>
    );
  }
  
  // Calculate aggregated metrics from the analytics array
  let totalVisitors = 0;
  let totalConversions = 0;
  let conversionRate = 0;
  
  if (Array.isArray(analytics) && analytics.length > 0) {
    totalVisitors = analytics.reduce((sum, item) => sum + (item.total_starts || 0), 0);
    totalConversions = analytics.reduce((sum, item) => sum + (item.total_conversions || 0), 0);
    if (totalVisitors > 0) {
      conversionRate = (totalConversions / totalVisitors) * 100;
    }
  }
  
  return (
    <div>
      <div className="flex items-center gap-2 text-sm">
        <div className="flex items-center gap-1 text-green-600">
          <TrendingUp className="h-3 w-3" />
          <span className="font-medium">{formatConversionRate(conversionRate)}</span>
        </div>
        <span className="text-muted-foreground">|</span>
        <div className="flex items-center gap-1 text-blue-600">
          <Users className="h-3 w-3" />
          <span className="font-medium">{totalVisitors > 0 ? totalVisitors.toLocaleString() : '0'}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm mt-1">
        <div className="flex items-center gap-1 text-red-600">
          <BarChart3 className="h-3 w-3" />
          <span className="font-medium">{totalVisitors > 0 ? ((totalVisitors - totalConversions) / totalVisitors * 100).toFixed(1) : '0'}%</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-1">Conv. Rate • Visitors • Drop-off</p>
    </div>
  );
}

export function FunnelsTable({ siteId }: FunnelsTableProps) {
  // No demo mode - only show real data
  if (!siteId) {
    return (
      <Card className="bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            No Site Selected
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Please select a website to view funnels.</p>
        </CardContent>
      </Card>
    );
  }

  const { toast } = useToast();
  const pathname = usePathname();
  const params = useParams();
  const websiteId = params.websiteId as string;
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Paused'>('All');

  const { data: funnels = [], isLoading } = useFunnels(siteId);
  const deleteFunction = useDeleteFunnel();
  const updateFunnel = useUpdateFunnel();

  const filteredFunnels = useMemo(() => {
    if (!Array.isArray(funnels) || funnels.length === 0) return [];
    
    return funnels.filter(funnel => {
      const matchesSearch = !searchQuery || 
        (funnel.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (funnel.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || 
        (statusFilter === 'Active' && funnel.is_active) ||
        (statusFilter === 'Paused' && !funnel.is_active);
      
      return matchesSearch && matchesStatus;
    });
  }, [funnels, searchQuery, statusFilter]);

  const handleToggleStatus = async (funnel: Funnel) => {
    try {
      await updateFunnel.mutateAsync({
        funnelId: funnel.id,
        funnelData: { is_active: !funnel.is_active }
      });
      toast({
        title: "Status Updated",
        description: `"${funnel.name}" is now ${!funnel.is_active ? 'active' : 'paused'}.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update funnel status.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteFunnel = async (funnelId: string) => {
    try {
      await deleteFunction.mutateAsync(funnelId);
      toast({
        title: "Funnel Deleted",
        description: "The funnel has been permanently deleted.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete funnel.",
        variant: "destructive",
      });
    }
  };

  const handleDuplicateFunnel = async (funnel: Funnel) => {
    try {
      // For now, just show a toast - implement duplication logic later
      toast({
        title: "Coming Soon",
        description: "Funnel duplication will be available in the next update.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to duplicate funnel.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Loading Funnels...
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">Conversion Funnels</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Track and optimize user conversion paths ({(Array.isArray(funnels) ? funnels.length : 0)} funnel{(Array.isArray(funnels) ? funnels.length : 0) !== 1 ? 's' : ''})
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search funnels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 w-64"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value: 'All' | 'Active' | 'Paused') => setStatusFilter(value)}>
              <SelectTrigger className="w-32 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Paused">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filteredFunnels.length === 0 ? (
          <div className="p-8 text-center">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No funnels found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || statusFilter !== 'All' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Create your first funnel to start tracking conversions.'
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b bg-muted/20">
                  <TableHead className="font-semibold text-foreground">Name & Description</TableHead>
                  <TableHead className="font-semibold text-foreground">Status</TableHead>
                  <TableHead className="font-semibold text-foreground">Performance</TableHead>
                  <TableHead className="font-semibold text-foreground">Steps</TableHead>
                  <TableHead className="font-semibold text-foreground">Created</TableHead>
                  <TableHead className="font-semibold text-foreground w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFunnels.map((funnel) => (
                  <TableRow key={funnel.id} className="hover:bg-muted/30 transition-colors cursor-pointer group">
                    <TableCell className="font-medium">
                      <Link href={`/websites/${websiteId}/funnels/${funnel.id}`} className="flex items-center gap-3 group-hover:text-primary transition-colors">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded">
                          <Target className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{funnel.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {funnel.description || 'Funnel Analysis'}
                          </p>
                        </div>
                      </Link>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={funnel.is_active ? 'default' : 'secondary'} className="font-medium">
                          {funnel.is_active ? 'Active' : 'Paused'}
                        </Badge>
                        <Switch
                          checked={funnel.is_active}
                          onCheckedChange={() => handleToggleStatus(funnel)}
                          disabled={updateFunnel.isPending}
                          className="ml-2"
                          aria-label={`Toggle ${funnel.name} status`}
                        />
                      </div>
                    </TableCell>

                    <TableCell>
                      <FunnelPerformanceCell funnelId={funnel.id} />
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {funnel.steps?.length || 0} step{(funnel.steps?.length || 0) !== 1 ? 's' : ''}
                        </Badge>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <BarChart3 className="h-3 w-3" />
                          <span className="text-xs">
                            {funnel.steps && funnel.steps.length > 0 ? funnel.steps[0]?.type || 'Custom' : 'Custom'}
                          </span>
                        </div>
                      </div>
                      {funnel.steps && funnel.steps.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          {funnel.steps.slice(0, 3).map((step, index) => (
                            <div key={index} className="w-2 h-2 bg-blue-400 rounded-full"></div>
                          ))}
                          {funnel.steps.length > 3 && (
                            <span className="text-xs text-muted-foreground">+{funnel.steps.length - 3}</span>
                          )}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-medium">{formatDate(funnel.created_at)}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-muted/50"
                        >
                          <Link href={`/websites/${websiteId}/funnels/${funnel.id}`}>
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View Details</span>
                          </Link>
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-muted/50"
                          onClick={() => window.open(`/websites/${websiteId}/funnels/edit/${funnel.id}`, '_blank')}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit Funnel</span>
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted/50">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuGroup>
                              <DropdownMenuItem onClick={() => handleDuplicateFunnel(funnel)} className="flex items-center gap-2">
                                <Copy className="h-4 w-4" />
                                Duplicate
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="flex items-center gap-2 text-destructive focus:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                  Delete Funnel
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the funnel "{funnel.name}" and all its analytics data.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteFunnel(funnel.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

