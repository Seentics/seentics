'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Loader2, Trash2, Edit, ExternalLink, Globe, Shield } from 'lucide-react';
import { PrivacyModal } from './modals/PrivacyModal';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { SettingsModal } from './modals/SettingsModal';
import { format } from 'date-fns';

interface WebsitesManageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WebsitesManageModal({ isOpen, onClose }: WebsitesManageModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  // Fetch websites
  const { data: websites = [], isLoading } = useQuery({
    queryKey: ['websites', user?.id],
    queryFn: getWebsites,
    enabled: isOpen && !!user,
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

  const handleEdit = (website: Website) => {
      setSelectedWebsite(website);
      setIsSettingsOpen(true);
  };

  const handlePrivacy = (website: Website) => {
    setSelectedWebsite(website);
    setIsPrivacyOpen(true);
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Websites</DialogTitle>
          <DialogDescription>
            View and manage all your tracked websites.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : websites.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No websites found. Add your first website to get started.
            </div>
          ) : (
            <div className="border rounded overflow-hidden">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {websites.map((website: Website) => (
                    <TableRow key={website.id}>
                        <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                                <Globe className="h-4 w-4 text-muted-foreground" />
                                {website.name}
                            </div>
                        </TableCell>
                        <TableCell>
                            <a href={website.url} target="_blank" rel="noopener noreferrer" className="flex items-center hover:underline text-muted-foreground text-sm">
                                {website.url}
                                <ExternalLink className="ml-1 h-3 w-3" />
                            </a>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(website.createdAt), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                            <Badge variant={website.isActive ? "default" : "secondary"} className={website.isActive ? "bg-green-500/10 text-green-600 hover:bg-green-500/20 border-0" : ""}>
                                {website.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                             <Button variant="ghost" size="icon" onClick={() => handlePrivacy(website)} title="Privacy & GDPR">
                                <Shield className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(website)} title="Settings">
                                <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
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
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {selectedWebsite && (
        <SettingsModal 
            isOpen={isSettingsOpen} 
            onClose={() => {
                setIsSettingsOpen(false);
                setSelectedWebsite(null);
            }}
            website={selectedWebsite} // Verify SettingsModal accepts this prop, likely need to update it
        />
    )}
    
    {selectedWebsite && (
      <PrivacyModal
        isOpen={isPrivacyOpen}
        onClose={() => {
          setIsPrivacyOpen(false);
          setSelectedWebsite(null);
        }}
        website={selectedWebsite}
      />
    )}
    </>
  );
}
