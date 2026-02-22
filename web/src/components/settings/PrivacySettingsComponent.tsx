'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import {
  Shield,
  EyeOff,
  Cookie,
  Download,
  Trash2,
  AlertTriangle,
  Loader2,
  Info
} from 'lucide-react';
import { privacyAPI } from '@/lib/privacy-api';
import { useAuth } from '@/stores/useAuthStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
    } catch {
      toast.error('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!websiteId && !user?.id) return;

    const confirmMessage = websiteId
      ? "Are you sure you want to delete ALL analytics data for this website? This action cannot be undone."
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
    } catch {
      toast.error('Failed to delete data. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggles = [
    {
      id: 'ip-anonymization',
      title: 'IP Anonymization',
      description: 'Automatically mask the last octet of visitor IP addresses before storage. Recommended for GDPR compliance.',
      icon: EyeOff,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      defaultChecked: true,
    },
    {
      id: 'cookie-less',
      title: 'Cookie-less Mode',
      description: 'Track unique visitors without using persistent cookies. Eliminates the need for cookie consent banners in most jurisdictions.',
      icon: Cookie,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
      defaultChecked: true,
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Privacy & GDPR</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Configure data protection and compliance settings.</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 w-fit">
          <Shield className="h-3 w-3 text-emerald-600" />
          <span className="text-[10px] font-medium text-emerald-600">GDPR Compliant</span>
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-3">
        {toggles.map((item) => (
          <Card key={item.id} className="border border-border/60 bg-card shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0", item.bgColor)}>
                  <item.icon className={cn("h-4 w-4", item.color)} />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-md">{item.description}</p>
                </div>
              </div>
              <Switch id={item.id} defaultChecked={item.defaultChecked} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Data Management */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Data Management</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Card className="border border-border/60 bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center">
                  <Download className="h-4 w-4 text-primary" />
                </div>
                <h4 className="text-sm font-medium">Export Data</h4>
              </div>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                Download all your analytics data in a portable JSON format for your records or data portability.
              </p>
              <Button
                size="sm"
                onClick={handleExport}
                disabled={isExporting}
                className="w-full gap-1.5 text-xs font-medium"
              >
                {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                {isExporting ? 'Exporting...' : 'Start Export'}
              </Button>
            </CardContent>
          </Card>

          <Card className="border border-border/60 bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Trash2 className="h-4 w-4 text-red-500" />
                </div>
                <h4 className="text-sm font-medium">Delete Data</h4>
              </div>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                Permanently delete your analytics history. This action is irreversible and data cannot be recovered.
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full gap-1.5 text-xs font-medium"
              >
                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {isDeleting ? 'Deleting...' : 'Delete All Data'}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Caution</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                Data management actions are processed immediately. Deletion will remove all records from our primary database and backups within 30 days.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Data Retention */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Data Retention</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Card className="border border-border/60 bg-card shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Retention Period</p>
              <p className="text-sm font-medium">Based on your plan</p>
            </CardContent>
          </Card>
          <Card className="border border-border/60 bg-card shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Cleanup Schedule</p>
              <p className="text-sm font-medium">Automatic (Weekly)</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Info */}
      <div className="bg-muted/30 border border-border/40 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Privacy First</span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Seentics is privacy-friendly by default. We never track personally identifiable information (PII) of your visitors without explicit configuration.
        </p>
      </div>
    </div>
  );
}
