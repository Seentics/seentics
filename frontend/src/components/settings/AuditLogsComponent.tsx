'use client';

import { useState, useEffect } from 'react';
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
    Activity, 
    User, 
    Globe, 
    Calendar, 
    Shield, 
    Clock,
    ArrowRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface AuditLog {
  id: string;
  user_id: string;
  website_id?: string;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata: any;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

export function AuditLogsComponent({ websiteId }: { websiteId?: string }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchLogs();
  }, [websiteId]);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const url = websiteId 
        ? `/user/websites/${websiteId}/audit-logs` 
        : '/user/users/audit-logs';
      
      const response = await api.get(url);
      setLogs(response.data.data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load audit logs',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    if (action.includes('created')) return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">CREATE</Badge>;
    if (action.includes('deleted')) return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">DELETE</Badge>;
    if (action.includes('updated')) return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">UPDATE</Badge>;
    return <Badge variant="outline">{action.toUpperCase()}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>Keep track of all critical actions and security events.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center">
              <Activity className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No audit logs found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 dark:bg-white/[0.01] hover:bg-slate-50/50 dark:hover:bg-white/[0.01] border-b border-slate-200 dark:border-white/5">
                    <TableHead className="font-bold py-4">Action</TableHead>
                    <TableHead className="font-bold">Resource</TableHead>
                    <TableHead className="font-bold">Performed By</TableHead>
                    <TableHead className="font-bold">Context</TableHead>
                    <TableHead className="font-bold text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                      <TableCell className="py-4">
                        <div className="flex flex-col gap-1">
                          {getActionBadge(log.action)}
                          <span className="text-xs text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">{log.action}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="font-mono text-[10px] py-0">{log.resource_type}</Badge>
                          <span className="font-mono text-xs text-slate-500">{log.resource_id}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                <User className="h-3 w-3 text-slate-500" />
                            </div>
                            <span className="text-sm font-medium">{log.user_id ? 'Authenticated User' : 'System'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Globe className="h-3 w-3" />
                                <span>{log.ip_address || 'Unknown IP'}</span>
                            </div>
                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                                <div className="text-[10px] text-slate-400 max-w-[200px] truncate">
                                    {JSON.stringify(log.metadata)}
                                </div>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </div>
                          <span className="text-[10px] text-slate-400">{new Date(log.created_at).toLocaleString()}</span>
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
    </div>
  );
}
