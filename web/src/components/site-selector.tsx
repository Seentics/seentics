
'use client';
import { getWebsites, addWebsite, type Website } from '@/lib/websites-api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Globe, Loader2, PlusCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/stores/useAuthStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface SiteSelectorProps {
  selectedSiteId: string | null;
  onSiteChange: (siteId: string) => void;
}

export function SiteSelector({ selectedSiteId, onSiteChange }: SiteSelectorProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteUrl, setNewSiteUrl] = useState('');

  const { data: websites = [], isLoading, refetch } = useQuery<Website[]>({
    queryKey: ['websites', user?.id],
    queryFn: () => getWebsites(),
    enabled: !!user,
  });

  const selectedSite = websites.find(site => site.id === selectedSiteId);

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleAddWebsite = async () => {
    if (!newSiteName || !newSiteUrl) {
      toast({ title: 'All fields are required', variant: 'destructive' });
      return;
    }
    if (!isValidUrl(newSiteUrl)) {
      toast({ title: 'Invalid URL', description: 'Please enter a valid URL (e.g., https://example.com).', variant: 'destructive' });
      return;
    }

    setIsAdding(true);
    try {
      const newWebsite = await addWebsite({ name: newSiteName, url: newSiteUrl }, user!.id);
      toast({ title: 'Website Added!', description: `Successfully created "${newSiteName}".` });
      await refetch(); // Refresh websites list
      setNewSiteName('');
      setNewSiteUrl('');
      setIsAddModalOpen(false);
      
      // Select the new website
      if (newWebsite && newWebsite.id) {
        onSiteChange(newWebsite.id);
        router.push(`/websites/${newWebsite.id}`);
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to add the website.', variant: 'destructive' });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedSiteId ?? ''}
        onValueChange={onSiteChange}
        disabled={isLoading || websites?.length === 0}
      >
        <SelectTrigger className="w-[200px] md:w-[250px] lg:w-[280px]">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4  text-blue-500" />
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SelectValue placeholder="Select a website" />
            )}
          </div>
        </SelectTrigger>
        <SelectContent>
          {websites?.map((site) => (
            <SelectItem key={site.id} value={site.id}>
              <div className="flex items-center gap-2">
                <span className="truncate">{site.name}</span>
                {site.url && (
                  <Badge variant="outline" className="text-xs">
                    {new URL(site.url).hostname}
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
          
          {/* Add New Website Option */}
          <div className="px-2 py-1.5">
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start h-8 px-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add New Website
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add a new website</DialogTitle>
                  <DialogDescription>
                    Enter your site's name and domain to get started with tracking and workflows.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Name
                    </Label>
                    <Input
                      id="name"
                      value={newSiteName}
                      onChange={(e) => setNewSiteName(e.target.value)}
                      className="col-span-3"
                      placeholder="e.g., My Awesome Project"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="url" className="text-right">
                      URL
                    </Label>
                    <Input
                      id="url"
                      value={newSiteUrl}
                      onChange={(e) => setNewSiteUrl(e.target.value)}
                      className="col-span-3"
                      placeholder="https://example.com"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleAddWebsite} disabled={isAdding} className="w-full">
                    {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isAdding ? 'Adding...' : 'Add website'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          
          {websites?.length === 0 && !isLoading && (
            <SelectItem value="no-sites" disabled>
              No websites found.
            </SelectItem>
          )}
        </SelectContent>
      </Select>
      
     
    </div>
  );
}
