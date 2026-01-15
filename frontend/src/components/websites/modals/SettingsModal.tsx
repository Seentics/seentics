'use client';

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
import { AlertCircle, Globe, Save } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"


interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Website Settings</DialogTitle>
          <DialogDescription>
            Configure general settings for your website.
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
                        <Input id="name" defaultValue="Seentics Marketing Site" />
                    </div>
                    
                    <div className="grid gap-2">
                        <Label htmlFor="domain">Domain</Label>
                        <div className="relative">
                            <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input id="domain" defaultValue="seentics.com" className="pl-9" />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="timezone">Timezone</Label>
                        <Select defaultValue="utc">
                            <SelectTrigger>
                                <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="utc">UTC (Coordinated Universal Time)</SelectItem>
                                <SelectItem value="est">EST (Eastern Standard Time)</SelectItem>
                                <SelectItem value="pst">PST (Pacific Standard Time)</SelectItem>
                                <SelectItem value="ist">IST (Indian Standard Time)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                
                 <DialogFooter className="mt-6">
                    <Button type="submit">
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
                    <Button variant="destructive">Delete Website</Button>
                </div>
            </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
