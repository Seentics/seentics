'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Shield, 
  EyeOff, 
  Cookie, 
  Database, 
  Info,
  FileCheck,
  Download,
  Trash2,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { privacyAPI } from '@/lib/privacy-api';
import { useAuth } from '@/stores/useAuthStore';
import { toast } from 'sonner';

interface PrivacySettingsProps {
  websiteId?: string;
}

export function PrivacySettingsComponent({ websiteId }: PrivacySettingsProps) {
  const { user } = useAuth();
  const [isExporting, setIsExporting] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleExport = async () => {
    if (!user?.id) return;
    try {
      setIsExporting(true);
      const data = await privacyAPI.exportAnalyticsData(user.id);
      
      // Create and download file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `seentics-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Data export started successfully.');
    } catch (error) {
      toast.error('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!websiteId && !user?.id) return;
    
    const confirmMessage = websiteId 
      ? "Are you sure you want to delete ALL analytics data for THIS website? This action cannot be undone."
      : "Are you sure you want to delete ALL your analytics data? This action cannot be undone.";

    if (!window.confirm(confirmMessage)) return;

    try {
      setIsDeleting(true);
      if (websiteId) {
        await privacyAPI.deleteWebsiteAnalytics(websiteId);
        toast.success('Website analytics data deleted successfully.');
      } else if (user?.id) {
        await privacyAPI.deleteAnalyticsData(user.id);
        toast.success('All analytics data deleted successfully.');
      }
    } catch (error) {
      toast.error('Failed to delete data. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Privacy & GDPR</h2>
          <p className="text-muted-foreground text-sm">Configure data protection and compliance settings.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 w-fit">
           <Shield className="h-4 w-4 text-emerald-600" />
           <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">GDPR Compliant</span>
        </div>
      </div>

      <div className="space-y-6">
        {/* IP Anonymization */}
        <div className="flex items-start justify-between p-4 rounded-2xl border bg-muted/5 group transition-all hover:bg-muted/10">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-border/50 shrink-0">
              <EyeOff className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ip-anonymization" className="text-sm font-bold">IP Anonymization</Label>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
                Automatically mask the last octet of visitor IP addresses before they are stored. Recommended for GDPR compliance.
              </p>
            </div>
          </div>
          <Switch id="ip-anonymization" defaultChecked className="mt-1" />
        </div>

        {/* Cookie-less Tracking */}
        <div className="flex items-start justify-between p-4 rounded-2xl border bg-muted/5 group transition-all hover:bg-muted/10">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-border/50 shrink-0">
              <Cookie className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cookie-less" className="text-sm font-bold">Cookie-less Mode</Label>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
                Track unique visitors without using persistent cookies. This eliminates the need for cookie consent banners in most jurisdictions.
              </p>
            </div>
          </div>
          <Switch id="cookie-less" defaultChecked className="mt-1" />
        </div>

        {/* Data Management Section */}
        <div className="p-6 border rounded-3xl bg-muted/5 space-y-6">
           <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Data Management</h3>
           </div>
           
           <div className="grid sm:grid-cols-2 gap-6">
             <div className="p-6 rounded-2xl bg-background border shadow-sm group hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Download className="h-4 w-4" />
                  </div>
                  <h4 className="font-bold text-sm">Download My Data</h4>
                </div>
                <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
                  Export all your analytics data and configuration in a portable JSON format for your own records or portability.
                </p>
                <Button 
                  onClick={handleExport} 
                  disabled={isExporting}
                  className="w-full h-10 rounded-xl font-bold"
                >
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Start Export'}
                </Button>
             </div>

             <div className="p-6 rounded-2xl bg-background border shadow-sm group hover:border-red-500/30 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </div>
                  <h4 className="font-bold text-sm">Delete My Data</h4>
                </div>
                <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
                  Permanently delete your analytics history and settings. This action is irreversible and data cannot be recovered.
                </p>
                <Button 
                  variant="destructive" 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-full h-10 rounded-xl font-bold"
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Purge Data'}
                </Button>
             </div>
           </div>

           <div className="flex gap-4 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                 <p className="text-sm font-bold text-amber-700 dark:text-amber-400 font-bold">Caution</p>
                 <p className="text-xs text-muted-foreground leading-relaxed">
                    Data management actions are processed immediately. Deletion will remove all records from our primary database and backups within 30 days.
                 </p>
              </div>
           </div>
        </div>

        {/* Data Retention */}
        <div className="p-6 border rounded-3xl bg-muted/5 space-y-4">
           <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Data Retention</h3>
           </div>
           
           <div className="grid sm:grid-cols-2 gap-4">
             <div className="p-4 rounded-xl bg-background border shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Retention Period</p>
                <div className="flex items-center justify-between">
                   <p className="text-sm font-bold">12 Months</p>
                   <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold">CHANGE</Button>
                </div>
             </div>
             <div className="p-4 rounded-xl bg-background border shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Cleanup Interval</p>
                <p className="text-sm font-bold">Standard (Weekly)</p>
             </div>
           </div>
        </div>

        <div className="flex gap-4 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
           <Info className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
           <div className="space-y-1">
              <p className="text-sm font-bold">Privacy First by Default</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Seentics is designed to be privacy-friendly out of the box. We never track personally identifiable information (PII) of your visitors without explicit configuration.
              </p>
           </div>
        </div>
      </div>

      <div className="flex items-center gap-4 pt-4 border-t border-border/50">
         <Button className="h-10 px-8 font-bold rounded-xl shadow-lg shadow-primary/10 transition-transform active:scale-95">
           Apply Settings
         </Button>
         <Button variant="ghost" className="h-10 px-4 font-bold rounded-xl gap-2 text-muted-foreground">
           <FileCheck className="h-4 w-4" />
           Privacy Policy Generator
         </Button>
      </div>
    </div>
  );
}
