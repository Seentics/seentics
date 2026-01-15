
import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Website, updateWebsite } from '@/lib/websites-api';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/stores/useAuthStore';
import { Loader2, Shield, Lock, EyeOff, FileDown } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  website: Website;
}

export function PrivacyModal({ isOpen, onClose, website }: PrivacyModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [useIpAnonymization, setUseIpAnonymization] = React.useState(website?.settings?.useIpAnonymization || false);
  const [respectDoNotTrack, setRespectDoNotTrack] = React.useState(website?.settings?.respectDoNotTrack || false);
  const [allowRawDataExport, setAllowRawDataExport] = React.useState(website?.settings?.allowRawDataExport || false);

  // Sync state with prop if it changes
  React.useEffect(() => {
    if (website?.settings) {
        setUseIpAnonymization(website.settings.useIpAnonymization);
        setRespectDoNotTrack(website.settings.respectDoNotTrack);
        setAllowRawDataExport(website.settings.allowRawDataExport);
    }
  }, [website]);

  if (!website) return null;

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Website['settings']>) => {
      if (!user?.id) throw new Error('User not found');
      return updateWebsite(website.id, {
        settings: {
          ...website.settings,
          ...data
        }
      }, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['websites'] });
      toast({
        title: 'Privacy settings updated',
        description: 'Your changes have been saved successfully.',
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: 'Error updating settings',
        description: 'Failed to save privacy settings. Please try again.',
        variant: 'destructive',
      });
      console.error(error);
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      useIpAnonymization,
      respectDoNotTrack,
      allowRawDataExport
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <DialogTitle>Privacy & Compliance</DialogTitle>
          </div>
          <DialogDescription>
            Manage data privacy settings for {website.name}. Ensure compliance with GDPR, CCPA, and potential future regulations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
            
          {/* IP Anonymization */}
          <div className="flex items-start justify-between space-x-4 p-4 border rounded-lg bg-card/50">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <EyeOff className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="ip-anonymization" className="text-base font-medium">IP Anonymization</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Anonymize visitor IP addresses by dropping the last octet. This may reduce geolocation accuracy but improves privacy compliance.
              </p>
            </div>
            <Switch
              id="ip-anonymization"
              checked={useIpAnonymization}
              onCheckedChange={setUseIpAnonymization}
            />
          </div>

          {/* Do Not Track */}
          <div className="flex items-start justify-between space-x-4 p-4 border rounded-lg bg-card/50">
             <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="dnt" className="text-base font-medium">Respect "Do Not Track"</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Automatically ignore visitors who have enabled the "Do Not Track" setting in their browser.
              </p>
            </div>
            <Switch
              id="dnt"
              checked={respectDoNotTrack}
              onCheckedChange={setRespectDoNotTrack}
            />
          </div>

           {/* Raw Data Export */}
           <div className="flex items-start justify-between space-x-4 p-4 border rounded-lg bg-card/50">
             <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileDown className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="raw-export" className="text-base font-medium">Allow Raw Data Export</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Enable downloading raw event logs (CSV/JSON). Required for some external audits.
              </p>
            </div>
            <Switch
              id="raw-export"
              checked={allowRawDataExport}
              onCheckedChange={setAllowRawDataExport}
            />
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={updateMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
