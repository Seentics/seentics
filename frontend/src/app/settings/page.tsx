'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getWebsites, Website } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { 
  Globe, 
  ExternalLink, 
  Settings, 
  BarChart3, 
  Trash2, 
  Search,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import Link from 'next/link';

export default function WebsitesManagement() {
  const { user } = useAuth();
  const { data: websites = [], isLoading } = useQuery({
    queryKey: ['websites', user?.id],
    queryFn: getWebsites,
    enabled: !!user,
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Websites</h1>
          <p className="text-muted-foreground text-sm">View and configure all your tracked properties.</p>
        </div>
        <Button className="h-10 px-5 font-bold rounded-xl gap-2 shadow-lg shadow-primary/10">
          <Plus className="h-4 w-4" />
          Add Website
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search websites..." className="pl-10 h-11 bg-muted/20 border-none shadow-none focus-visible:ring-1" />
      </div>

      <div className="border rounded-2xl overflow-hidden bg-background/50">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/30 border-b">
              <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground">Website</th>
              <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground">Created</th>
              <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i} className="animate-pulse border-b border-dashed last:border-0">
                  <td className="px-6 py-4"><div className="h-4 w-40 bg-muted rounded" /></td>
                  <td className="px-6 py-4"><div className="h-4 w-24 bg-muted rounded" /></td>
                  <td className="px-6 py-4"><div className="h-4 w-32 bg-muted rounded ml-auto" /></td>
                </tr>
              ))
            ) : websites.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-muted-foreground">
                  No websites found. Add your first site to start tracking.
                </td>
              </tr>
            ) : (
              websites.map((website: Website) => (
                <tr key={website.id} className="border-b border-dashed last:border-0 hover:bg-muted/10 transition-colors group">
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border group-hover:scale-110 transition-transform">
                        <Globe className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{website.name}</p>
                        <a href={website.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1">
                          {website.url.replace(/^https?:\/\//, '')}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-2 text-muted-foreground font-medium text-xs">
                      <Badge variant="outline" className="text-[9px] font-black uppercase bg-muted/30">
                        {format(new Date(website.createdAt), 'MMM d, yyyy')}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex justify-end gap-2">
                      <Link href={`/websites/${website.id}`}>
                        <Button variant="ghost" size="sm" className="h-9 px-3 text-xs font-bold gap-2 rounded-lg">
                          <BarChart3 className="h-3.5 w-3.5" />
                          ALALYTICS
                        </Button>
                      </Link>
                      <Link href={`/websites/${website.id}/settings`}>
                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-lg">
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
