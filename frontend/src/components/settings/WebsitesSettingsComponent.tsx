'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWebsites, deleteWebsite, Website } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { AddWebsiteModal } from '@/components/websites/AddWebsiteModal';
import { EditWebsiteModal } from '@/components/websites/EditWebsiteModal';
import { cn } from '@/lib/utils';
import { Loader2, Trash2, Edit, ExternalLink, Globe, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export function WebsitesSettingsComponent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingWebsite, setEditingWebsite] = useState<Website | null>(null);

  // Fetch websites
  const { data: websites = [], isLoading } = useQuery({
    queryKey: ['websites', user?.id],
    queryFn: getWebsites,
    enabled: !!user,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (websiteId: string) => {
        if (!user?.id) throw new Error("User ID required");
        await deleteWebsite(websiteId, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['websites'] });
      toast.success('Website deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete website');
    },
  });

  const handleDelete = (websiteId: string) => {
    if (confirm('Are you sure you want to delete this website? This action cannot be undone.')) {
      deleteMutation.mutate(websiteId);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Manage Websites</h2>
          <p className="text-muted-foreground text-sm">View and manage all your tracked properties.</p>
        </div>
        <Button 
          onClick={() => setIsAddModalOpen(true)}
          className="h-10 px-5 font-bold rounded gap-2 shadow-lg shadow-primary/20 transition-transform active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Add New Property
        </Button>
      </div>

      <AddWebsiteModal 
        open={isAddModalOpen} 
        onOpenChange={setIsAddModalOpen} 
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['websites'] })}
      />

      <EditWebsiteModal
        open={!!editingWebsite}
        onOpenChange={(open) => !open && setEditingWebsite(null)}
        website={editingWebsite}
      />

      <div className="border rounded overflow-hidden bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : websites.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No websites found. Add your first property to get started.
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="px-6 h-14 text-[10px] font-black uppercase tracking-widest">Property Name</TableHead>
                <TableHead className="h-14 text-[10px] font-black uppercase tracking-widest">Public URL</TableHead>
                <TableHead className="h-14 text-[10px] font-black uppercase tracking-widest">Connected</TableHead>
                <TableHead className="h-14 text-[10px] font-black uppercase tracking-widest">Status</TableHead>
                <TableHead className="text-right px-6 h-14 text-[10px] font-black uppercase tracking-widest">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {websites.map((website: Website) => (
                <TableRow key={website.id} className="border-border/40 hover:bg-muted/30 transition-colors">
                  <TableCell className="px-6 py-4 font-bold text-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center border border-primary/20">
                            <Globe className="h-4 w-4 text-primary" />
                        </div>
                        {website.name}
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <a href={website.url} target="_blank" rel="noopener noreferrer" className="flex items-center hover:text-primary transition-colors text-muted-foreground text-[13px] font-medium group">
                        {website.url.replace(/^https?:\/\//, '')}
                        <ExternalLink className="ml-1.5 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  </TableCell>
                  <TableCell className="py-4 text-muted-foreground text-[13px] font-medium">
                    {format(new Date(website.createdAt), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge variant={website.isActive ? "default" : "secondary"} className={cn(
                        "h-5 text-[9px] font-black uppercase tracking-widest px-2 border-none",
                        website.isActive ? "bg-emerald-500/10 text-emerald-600" : ""
                    )}>
                      {website.isActive ? 'Active' : 'Halted'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right px-6 py-4">
                    <div className="flex justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 rounded hover:bg-muted" 
                        onClick={() => setEditingWebsite(website)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 rounded text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                        onClick={() => handleDelete(website.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
