'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWebsites, deleteWebsite, Website } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { 
  Globe, 
  ExternalLink, 
  Settings, 
  BarChart3, 
  Trash2, 
  Search,
  Plus,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { AddWebsiteModal } from '@/components/websites/AddWebsiteModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function WebsitesManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [siteToDelete, setSiteToDelete] = useState<Website | null>(null);

  const { data: websites = [], isLoading } = useQuery({
    queryKey: ['websites', user?.id],
    queryFn: getWebsites,
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: (siteId: string) => deleteWebsite(siteId, user?.id || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['websites', user?.id] });
      toast({ title: 'Success', description: 'Website deleted successfully' });
      setSiteToDelete(null);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to delete website', 
        variant: 'destructive' 
      });
    }
  });

  const filteredWebsites = websites.filter((site: Website) => 
    site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    site.url.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Websites</h1>
          <p className="text-muted-foreground text-sm">View and configure all your tracked properties.</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="h-10 px-5 font-bold rounded-xl gap-2 shadow-lg shadow-primary/10">
          <Plus className="h-4 w-4" />
          Add Website
        </Button>
      </div>

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="Search websites by name or URL..." 
          className="pl-12 h-12 bg-muted/20 border-none shadow-none focus-visible:ring-1 text-sm font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="border rounded-3xl overflow-hidden bg-background/50 backdrop-blur-sm border-muted-foreground/10">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/30 border-b border-muted-foreground/10">
              <th className="px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Website</th>
              <th className="px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground hidden md:table-cell">Created</th>
              <th className="px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-muted-foreground/5">
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-6"><div className="h-5 w-48 bg-muted rounded-lg" /></td>
                  <td className="px-6 py-6 hidden md:table-cell"><div className="h-4 w-24 bg-muted rounded-lg" /></td>
                  <td className="px-6 py-6"><div className="h-9 w-32 bg-muted rounded-lg ml-auto" /></td>
                </tr>
              ))
            ) : filteredWebsites.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-20 text-center">
                   <div className="flex flex-col items-center gap-2 max-w-xs mx-auto">
                      <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground mb-2">
                        <Globe size={24} />
                      </div>
                      <p className="font-bold text-slate-900 dark:text-white">No websites found</p>
                      <p className="text-sm text-muted-foreground">
                        {searchTerm ? "Try searching for something else or add a new property." : "Add your first website to start collecting analytics data."}
                      </p>
                      {!searchTerm && (
                         <Button variant="outline" size="sm" className="mt-4 rounded-xl font-bold" onClick={() => setShowAddModal(true)}>
                           Add Website
                         </Button>
                      )}
                   </div>
                </td>
              </tr>
            ) : (
                filteredWebsites.map((website: Website) => (
                <tr key={website.id} className="hover:bg-muted/5 transition-colors group">
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:scale-105 transition-transform shrink-0">
                        <Globe className="h-6 w-6 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 dark:text-white truncate">{website.name}</p>
                        <a href={website.url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-muted-foreground hover:text-primary flex items-center gap-1.5 mt-0.5 transition-colors">
                          {website.url.replace(/^https?:\/\//, '')}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6 hidden md:table-cell">
                    <div className="flex items-center gap-2 text-muted-foreground font-bold text-[10px] uppercase tracking-wider">
                       {format(new Date(website.createdAt), 'MMM d, yyyy')}
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex justify-end gap-2">
                      <Link href={`/websites/${website.id}`}>
                        <Button variant="secondary" size="sm" className="h-9 px-4 text-[11px] font-black gap-2 rounded-xl shadow-sm border border-border/50">
                          <BarChart3 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">ANALYTICS</span>
                        </Button>
                      </Link>
                      <Link href={`/websites/${website.id}/settings`}>
                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl hover:bg-muted hover:text-foreground">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button 
                        onClick={() => setSiteToDelete(website)}
                        variant="ghost" 
                        size="sm" 
                        className="h-9 w-9 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Website Modal Integration */}
      <AddWebsiteModal 
        open={showAddModal} 
        onOpenChange={setShowAddModal}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['websites', user?.id] });
          setShowAddModal(false);
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!siteToDelete} onOpenChange={(open) => !open && setSiteToDelete(null)}>
        <AlertDialogContent className="rounded-3xl border-muted-foreground/10">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 text-rose-500 mb-2">
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertTriangle size={20} />
              </div>
              <AlertDialogTitle className="font-black">Delete Website?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="font-medium">
                This will permanently delete <span className="font-black text-slate-900 dark:text-white">{siteToDelete?.name}</span> and all associated analytics data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl font-bold h-11 border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction 
                onClick={() => siteToDelete && deleteMutation.mutate(siteToDelete.id)}
                className="rounded-xl font-black h-11 bg-rose-500 hover:bg-rose-600 text-white border-0"
                disabled={deleteMutation.isPending}
            >
                {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                )}
                Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
