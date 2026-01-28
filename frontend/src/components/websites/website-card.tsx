'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Globe, MoreVertical, Trash2, Code, BarChart3, Workflow, ExternalLink } from 'lucide-react';
import { Website } from '@/lib/websites-api';

interface WebsiteCardProps {
  website: Website;
  stats: { pageviews: number; unique: number };
  onDelete: (siteId: string, siteName: string) => Promise<void>;
  onShowTrackingCode: (siteId: string) => void;
}

export function WebsiteCard({ website, stats, onDelete, onShowTrackingCode }: WebsiteCardProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive 
      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800'
      : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400 border-gray-200 dark:border-gray-800';
  };

  const getTrackingColor = (isEnabled: boolean) => {
    return isEnabled
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800'
      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
  };

  return (
    <Card className="group flex flex-col h-full hover:shadow-lg transition-all duration-200 border hover:border-primary/20 dark:bg-gray-800 rounded">
      <Link href={`/websites/${website.id}`} className="flex flex-col flex-grow">
        <CardHeader className="flex-row items-start justify-between pb-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-3 text-lg">
              <span className="truncate">{website.name}</span>
              {website.isVerified && (
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800">
                  Verified
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="truncate mt-2 text-sm">
              {website.url}
            </CardDescription>
          </div>
          
          <AlertDialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="w-8 h-8 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" 
                  onClick={(e) => { e.preventDefault(); }}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.preventDefault()}>
                <DropdownMenuItem onSelect={() => onShowTrackingCode(website.id)}>
                  <Code className="mr-2 h-4 w-4" />
                  <span>Tracking Code</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/websites/${website.id}/analytics`}>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    <span>Analytics</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/websites/${website.id}/workflows`}>
                    <Workflow className="mr-2 h-4 w-4" />
                    <span>Workflows</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </AlertDialogTrigger>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Website</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete "{website.name}" and all of its associated workflows and analytics data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete(website.id, website.name);
                  }} 
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardHeader>
        
        <CardContent className="flex-grow space-y-4">
          {/* Quick Stats */}
          {/* <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 p-3 rounded border">
              <div className="text-lg font-semibold text-foreground">
                {formatNumber(stats.pageviews)}
              </div>
              <div className="text-xs text-muted-foreground">Pageviews</div>
            </div>
            <div className="bg-muted/50 p-3 rounded border">
              <div className="text-lg font-semibold text-foreground">
                {formatNumber(stats.unique)}
              </div>
              <div className="text-xs text-muted-foreground">Visitors</div>
            </div>
          </div> */}

          {/* Status Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={getStatusColor(website.isActive)}>
              {website.isActive ? 'Active' : 'Inactive'}
            </Badge>
            <Badge variant="outline" className={getTrackingColor(website.settings.trackingEnabled)}>
              {website.settings.trackingEnabled ? 'Tracking On' : 'Tracking Off'}
            </Badge>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" className="h-8 text-xs" asChild>
              <Link href={`/websites/${website.id}/analytics`}>
                <BarChart3 className="mr-1 h-3 w-3" />
                Analytics
              </Link>
            </Button>
            <Button variant="secondary" size="sm" className="h-8 text-xs" asChild>
              <Link href={`/websites/${website.id}/workflows`}>
                <Workflow className="mr-1 h-3 w-3" />
                Workflows
              </Link>
            </Button>
          </div>
        </CardContent>
        
        <CardFooter className="bg-muted/30 p-3 rounded-b-xl border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="h-4 w-4" />
            <span>View Dashboard</span>
            <ExternalLink className="h-3 w-3 ml-auto" />
          </div>
        </CardFooter>
      </Link>
    </Card>
  );
}
