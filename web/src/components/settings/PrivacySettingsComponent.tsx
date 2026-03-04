'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Shield,
  EyeOff,
  Cookie,
  Download,
  Trash2,
  AlertTriangle,
  Loader2,
  Info,
  Save,
  Clock,
  Ban,
  FileText,
} from 'lucide-react';
import { privacyAPI, WebsitePrivacySettings, GDPRRequestItem } from '@/lib/privacy-api';
import { useAuth } from '@/stores/useAuthStore';
import { isEnterprise } from '@/lib/features';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PrivacySettingsProps {
  websiteId?: string;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    completed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    cancelled: 'bg-muted text-muted-foreground border-border',
    rejected: 'bg-red-500/10 text-red-600 border-red-500/20',
  };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border', styles[status] || styles.pending)}>
      {status}
    </span>
  );
}

export function PrivacySettingsComponent({ websiteId }: PrivacySettingsProps) {
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Enterprise: per-website privacy settings
  const [privacySettings, setPrivacySettings] = useState<WebsitePrivacySettings | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Enterprise: GDPR requests
  const [gdprRequests, setGdprRequests] = useState<GDPRRequestItem[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  useEffect(() => {
    if (!isEnterprise || !websiteId) return;
    setIsLoadingSettings(true);
    privacyAPI.getWebsitePrivacy(websiteId)
      .then(res => setPrivacySettings(res.data))
      .catch(() => {
        // Set defaults if no settings exist yet
        setPrivacySettings({ ipAnonymization: 'none', respectDnt: false, consentMode: 'cookieless', dataRetentionDays: null });
      })
      .finally(() => setIsLoadingSettings(false));
  }, [websiteId]);

  useEffect(() => {
    if (!isEnterprise) return;
    setIsLoadingRequests(true);
    privacyAPI.getGDPRRequests()
      .then(res => setGdprRequests(res.data || []))
      .catch(() => {})
      .finally(() => setIsLoadingRequests(false));
  }, []);

  const handleSavePrivacy = async () => {
    if (!websiteId || !privacySettings) return;
    setIsSavingSettings(true);
    try {
      await privacyAPI.updateWebsitePrivacy(websiteId, privacySettings);
      toast.success('Privacy settings saved.');
    } catch {
      toast.error('Failed to save privacy settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCancelRequest = async (id: string) => {
    try {
      await privacyAPI.cancelGDPRRequest(id);
      setGdprRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'cancelled' } : r));
      toast.success('Request cancelled.');
    } catch {
      toast.error('Failed to cancel request.');
    }
  };

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

      {/* Enterprise: Per-website privacy settings */}
      {isEnterprise && websiteId && privacySettings && (
        <Card className="border border-border/60 bg-card shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Website Privacy Settings</h3>
                <p className="text-xs text-muted-foreground">Configure privacy enforcement for this website.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">IP Anonymization</Label>
                <Select
                  value={privacySettings.ipAnonymization}
                  onValueChange={(v) => setPrivacySettings(s => s ? { ...s, ipAnonymization: v as any } : s)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (pass full IP)</SelectItem>
                    <SelectItem value="partial">Partial (zero last octet)</SelectItem>
                    <SelectItem value="full">Full (SHA256 hash)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Consent Mode</Label>
                <Select
                  value={privacySettings.consentMode}
                  onValueChange={(v) => setPrivacySettings(s => s ? { ...s, consentMode: v as any } : s)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cookieless">Cookieless (no consent needed)</SelectItem>
                    <SelectItem value="strict">Strict (require consent)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <Label className="text-xs font-medium">Respect Do-Not-Track</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Block tracking when browser sends DNT:1</p>
                </div>
                <Switch
                  checked={privacySettings.respectDnt}
                  onCheckedChange={(v) => setPrivacySettings(s => s ? { ...s, respectDnt: v } : s)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Data Retention (days)</Label>
                <Input
                  type="number"
                  min={1}
                  max={3650}
                  value={privacySettings.dataRetentionDays ?? ''}
                  onChange={(e) => setPrivacySettings(s => s ? { ...s, dataRetentionDays: e.target.value ? parseInt(e.target.value) : null } : s)}
                  placeholder="Plan default"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button size="sm" onClick={handleSavePrivacy} disabled={isSavingSettings}>
                {isSavingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* OSS: Static toggles (not connected to API) */}
      {!isEnterprise && (
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
      )}

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

      {/* Enterprise: GDPR Request History */}
      {isEnterprise && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">GDPR Requests</h3>
          </div>

          {isLoadingRequests ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : gdprRequests.length === 0 ? (
            <Card className="border border-border/60 bg-card shadow-sm">
              <CardContent className="p-6 text-center">
                <Shield className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No GDPR requests yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Your data export and deletion requests will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {gdprRequests.map((req) => (
                <Card key={req.id} className="border border-border/60 bg-card shadow-sm">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                        {req.requestType === 'deletion' ? (
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <Download className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium capitalize">{req.requestType}</p>
                          <StatusBadge status={req.status} />
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3 text-muted-foreground/60" />
                          <p className="text-[11px] text-muted-foreground">{new Date(req.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                    {req.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelRequest(req.id)}
                        className="text-xs text-muted-foreground hover:text-destructive h-8"
                      >
                        <Ban className="h-3.5 w-3.5 mr-1" />
                        Cancel
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

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
