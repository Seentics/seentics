'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, Globe, Save, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Website, updateWebsite, deleteWebsite } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  website: Website;
}

export function SettingsModal({ isOpen, onClose, website }: SettingsModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  
  // Local state for form
  const [formData, setFormData] = useState({
      name: '',
      url: '',
      trackingEnabled: true,
      dataRetentionDays: 365
  });

  useEffect(() => {
      if (website) {
          setFormData({
              name: website.name,
              url: website.url,
              trackingEnabled: website.settings?.trackingEnabled ?? true,
              dataRetentionDays: website.settings?.dataRetentionDays ?? 365
          });
      }
  }, [website]);

  const handleSave = async () => {
      if (!user?.id) return;
      
      setLoading(true);
      try {
          await updateWebsite(website.id, {
              name: formData.name,
              url: formData.url,
              settings: {
                  ...website.settings,
                  trackingEnabled: formData.trackingEnabled,
                  dataRetentionDays: formData.dataRetentionDays,
                  allowedOrigins: website.settings.allowedOrigins // Preserve existing
              }
          }, user.id);
          
          queryClient.invalidateQueries({ queryKey: ['websites'] });
          toast.success('Settings saved successfully');
          onClose();
      } catch (error) {
          toast.error('Failed to save settings');
      } finally {
          setLoading(false);
      }
  };

  const handleDelete = async () => {
      if (!user?.id) return;
      if (confirm(`Are you sure you want to delete ${website.name}? This cannot be undone.`)) {
          try {
              await deleteWebsite(website.id, user.id);
              queryClient.invalidateQueries({ queryKey: ['websites'] });
              toast.success('Website deleted successfully');
              onClose();
          } catch (error) {
              toast.error('Failed to delete website');
          }
      }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Website Settings</DialogTitle>
          <DialogDescription>
            Configure settings for {website?.name}.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full py-4">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="danger">Danger Zone</TabsTrigger>
            </TabsList>
            
            <TabsContent value="general" className="space-y-4 pt-4">
                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Website Name</Label>
                        <Input 
                            id="name" 
                            value={formData.name} 
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                        />
                    </div>
                    
                    <div className="grid gap-2">
                        <Label htmlFor="domain">Domain URL</Label>
                        <div className="relative">
                            <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                id="domain" 
                                value={formData.url} 
                                onChange={(e) => setFormData({...formData, url: e.target.value})}
                                className="pl-9" 
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                            <Label>Tracking Enabled</Label>
                            <p className="text-sm text-muted-foreground">Collect analytics data for this site</p>
                        </div>
                        <Switch 
                            checked={formData.trackingEnabled}
                            onCheckedChange={(checked) => setFormData({...formData, trackingEnabled: checked})}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="timezone">Data Retention</Label>
                        <Select 
                            value={formData.dataRetentionDays.toString()}
                            onValueChange={(val) => setFormData({...formData, dataRetentionDays: parseInt(val)})}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select retention period" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="30">30 Days</SelectItem>
                                <SelectItem value="90">90 Days</SelectItem>
                                <SelectItem value="365">1 Year</SelectItem>
                                <SelectItem value="730">2 Years</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                
                 <DialogFooter className="mt-6">
                    <Button type="submit" onClick={handleSave} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                    </Button>
                </DialogFooter>
            </TabsContent>

            <TabsContent value="danger" className="space-y-4 pt-4">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Warning</AlertTitle>
                    <AlertDescription>
                        This action cannot be undone. This will permanently delete your website
                        and remove all associated data from our servers.
                    </AlertDescription>
                </Alert>

                <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/20 flex items-center justify-between">
                    <div>
                        <h4 className="font-medium text-destructive">Delete Website</h4>
                        <p className="text-sm text-destructive/80">Permanently remove this site and all analytics data.</p>
                    </div>
                    <Button variant="destructive" onClick={handleDelete}>Delete Website</Button>
                </div>
            </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
