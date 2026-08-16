'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Shield,
  ShieldCheck,
  EyeOff,
  Cookie,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  Loader2,
  Info,
  Save,
  Clock,
  Ban,
  FileText,
  Globe,
  Bot,
  Fingerprint,
  Lock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Database,
} from 'lucide-react';
import { privacyAPI, WebsitePrivacySettings, GDPRRequestItem, ImportResult } from '@/lib/privacy-api';
import { useAuth } from '@/stores/useAuthStore';
import { isEnterprise } from '@/lib/features';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PrivacySettingsProps {
  websiteId?: string;
}

// --- Sub-components ---

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    processing: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    completed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    cancelled: 'bg-muted text-muted-foreground border-border',
    failed: 'bg-red-500/10 text-red-600 border-red-500/20',
    rejected: 'bg-red-500/10 text-red-600 border-red-500/20',
  };
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-lg-full text-[10px] font-semibold border capitalize',
      styles[status] || styles.pending
    )}>
      {status}
    </span>
  );
}

function PrivacyToggleCard({
  icon: Icon,
  title,
  description,
  checked,
  onToggle,
  color,
  bgColor,
  disabled,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  checked: boolean;
  onToggle: (v: boolean) => void;
  color: string;
  bgColor: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-border/60 bg-card/50 hover:bg-card/80 transition-all group">
      <div className="flex items-center gap-3.5">
        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105', bgColor)}>
          <Icon className={cn('h-4.5 w-4.5', color)} />
        </div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-md leading-relaxed">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} disabled={disabled} />
    </div>
  );
}

// --- Main Component ---

export function PrivacySettingsComponent({ websiteId }: PrivacySettingsProps) {
  const { user } = useAuth();

  // --- Shared state ---
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingWebsite, setIsExportingWebsite] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- OSS: local privacy toggles ---
  const [ipAnonymization, setIpAnonymization] = useState(true);
  const [cookielessMode, setCookielessMode] = useState(true);
  const [respectDnt, setRespectDnt] = useState(true);
  const [botFiltering, setBotFiltering] = useState(true);

  // --- Enterprise: per-website settings ---
  const [privacySettings, setPrivacySettings] = useState<WebsitePrivacySettings | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // --- Enterprise: GDPR requests ---
  const [gdprRequests, setGdprRequests] = useState<GDPRRequestItem[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  // --- OSS: load from localStorage ---
  useEffect(() => {
    if (isEnterprise) return;
    try {
      const saved = localStorage.getItem('seentics_oss_privacy');
      if (saved) {
        const parsed = JSON.parse(saved);
        setIpAnonymization(parsed.ipAnonymization ?? true);
        setCookielessMode(parsed.cookielessMode ?? true);
        setRespectDnt(parsed.respectDnt ?? true);
        setBotFiltering(parsed.botFiltering ?? true);
      }
    } catch { /* use defaults */ }
  }, []);

  const handleOssToggle = useCallback((key: string, value: boolean) => {
    const current = { ipAnonymization, cookielessMode, respectDnt, botFiltering };
    const updated = { ...current, [key]: value };

    if (key === 'ipAnonymization') setIpAnonymization(value);
    else if (key === 'cookielessMode') setCookielessMode(value);
    else if (key === 'respectDnt') setRespectDnt(value);
    else if (key === 'botFiltering') setBotFiltering(value);

    try {
      localStorage.setItem('seentics_oss_privacy', JSON.stringify(updated));
      toast.success('Privacy setting updated');
    } catch {
      toast.error('Failed to save setting');
    }
  }, [ipAnonymization, cookielessMode, respectDnt, botFiltering]);

  // --- Enterprise: load settings ---
  useEffect(() => {
    if (!isEnterprise || !websiteId) return;
    setIsLoadingSettings(true);
    privacyAPI.getWebsitePrivacy(websiteId)
      .then(res => setPrivacySettings(res.data))
      .catch(() => {
        setPrivacySettings({
          ipAnonymization: 'partial',
          respectDnt: true,
          consentMode: 'cookieless',
          dataRetentionDays: null,
        });
      })
      .finally(() => setIsLoadingSettings(false));
  }, [websiteId]);

  // --- Enterprise: load GDPR requests ---
  useEffect(() => {
    if (!isEnterprise) return;
    setIsLoadingRequests(true);
    privacyAPI.getGDPRRequests()
      .then(res => setGdprRequests(res.data || []))
      .catch(() => {})
      .finally(() => setIsLoadingRequests(false));
  }, []);

  // --- Handlers ---

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

  // Export all user data
  const handleExportAll = async () => {
    if (!user?.id) {
      toast.error('You must be logged in to export data.');
      return;
    }
    try {
      setIsExporting(true);
      const data = await privacyAPI.exportAnalyticsData(user.id);
      downloadJson(data, `seentics-all-data-export-${new Date().toISOString().split('T')[0]}.json`);
      toast.success('All data exported successfully.');
    } catch {
      toast.error('Failed to export data.');
    } finally {
      setIsExporting(false);
    }
  };

  // Export website-specific data
  const handleExportWebsite = async () => {
    if (!websiteId) {
      toast.error('No website selected.');
      return;
    }
    try {
      setIsExportingWebsite(true);
      const res = await privacyAPI.exportWebsiteData(websiteId);
      const exportData = res.data || res;
      downloadJson(exportData, `seentics-website-${websiteId}-export-${new Date().toISOString().split('T')[0]}.json`);
      toast.success('Website data exported successfully.');
    } catch {
      toast.error('Failed to export website data.');
    } finally {
      setIsExportingWebsite(false);
    }
  };

  // Import data from file
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !websiteId) return;

    if (!file.name.endsWith('.json')) {
      toast.error('Please select a JSON file.');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 100MB.');
      return;
    }

    try {
      setIsImporting(true);
      setImportResult(null);
      const result = await privacyAPI.importWebsiteData(websiteId, file);
      setImportResult(result.data);
      toast.success('Data imported successfully.');
    } catch {
      toast.error('Failed to import data. Check the file format.');
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!websiteId && !user?.id) return;
    try {
      setIsDeleting(true);
      if (websiteId) {
        await privacyAPI.deleteWebsiteAnalytics(websiteId);
        toast.success('Website analytics data deleted.');
      } else if (user?.id) {
        await privacyAPI.deleteAnalyticsData(user.id);
        toast.success('All analytics data deleted.');
      }
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    } catch {
      toast.error('Failed to delete data.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelGdprRequest = async (id: string) => {
    try {
      await privacyAPI.cancelGDPRRequest(id);
      setGdprRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'cancelled' } : r));
      toast.success('Request cancelled.');
    } catch {
      toast.error('Failed to cancel request.');
    }
  };

  const handleAnonymize = async () => {
    if (!user?.id) return;
    if (!window.confirm('This will anonymize all visitor data associated with your account. This cannot be undone.')) return;
    try {
      await privacyAPI.anonymizeAnalyticsData(user.id);
      toast.success('Data anonymization started. This may take a few minutes.');
    } catch {
      toast.error('Failed to anonymize data.');
    }
  };

  // --- Loading state for enterprise ---
  if (isEnterprise && isLoadingSettings) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl">

      {/* ====== Header ====== */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Shield className="h-4.5 w-4.5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight">Privacy & Data Protection</h3>
              <p className="text-xs text-muted-foreground">Control how visitor data is collected, stored, and processed.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg-full bg-emerald-500/10 border border-emerald-500/20">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Privacy-First</span>
          </div>
        </div>
      </div>

      {/* ====== Privacy Controls ====== */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Privacy Controls</h4>
        </div>

        {/* OSS mode: local toggles */}
        {!isEnterprise && (
          <div className="space-y-2">
            <PrivacyToggleCard
              icon={EyeOff}
              title="IP Anonymization"
              description="Mask the last octet of visitor IP addresses before storage. Recommended for GDPR compliance."
              checked={ipAnonymization}
              onToggle={(v) => handleOssToggle('ipAnonymization', v)}
              color="text-indigo-500"
              bgColor="bg-indigo-500/10"
            />
            <PrivacyToggleCard
              icon={Cookie}
              title="Cookie-less Tracking"
              description="Track unique visitors without persistent cookies. Eliminates the need for cookie consent banners."
              checked={cookielessMode}
              onToggle={(v) => handleOssToggle('cookielessMode', v)}
              color="text-indigo-500"
              bgColor="bg-indigo-500/10"
            />
            <PrivacyToggleCard
              icon={Globe}
              title="Respect Do-Not-Track"
              description="Honor the browser's DNT signal. When enabled, visitors with DNT:1 won't be tracked at all."
              checked={respectDnt}
              onToggle={(v) => handleOssToggle('respectDnt', v)}
              color="text-indigo-500"
              bgColor="bg-indigo-500/10"
            />
            <PrivacyToggleCard
              icon={Bot}
              title="Bot Filtering"
              description="Automatically exclude known bots and crawlers from your analytics data for cleaner metrics."
              checked={botFiltering}
              onToggle={(v) => handleOssToggle('botFiltering', v)}
              color="text-teal-500"
              bgColor="bg-teal-500/10"
            />
          </div>
        )}

        {/* Enterprise mode: per-website settings */}
        {isEnterprise && websiteId && privacySettings && (
          <Card className="border-border/60 bg-card">
            <CardContent className="p-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <EyeOff className="h-3 w-3 text-indigo-500" />
                    IP Anonymization
                  </Label>
                  <Select
                    value={privacySettings.ipAnonymization}
                    onValueChange={(v) => setPrivacySettings(s => s ? { ...s, ipAnonymization: v as WebsitePrivacySettings['ipAnonymization'] } : s)}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="flex items-center gap-2">
                          <XCircle className="h-3 w-3 text-red-400" /> None (full IP stored)
                        </span>
                      </SelectItem>
                      <SelectItem value="partial">
                        <span className="flex items-center gap-2">
                          <EyeOff className="h-3 w-3 text-amber-500" /> Partial (last octet zeroed)
                        </span>
                      </SelectItem>
                      <SelectItem value="full">
                        <span className="flex items-center gap-2">
                          <Fingerprint className="h-3 w-3 text-emerald-500" /> Full (SHA-256 hash)
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">Controls how visitor IPs are stored.</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Cookie className="h-3 w-3 text-indigo-500" />
                    Consent Mode
                  </Label>
                  <Select
                    value={privacySettings.consentMode}
                    onValueChange={(v) => setPrivacySettings(s => s ? { ...s, consentMode: v as WebsitePrivacySettings['consentMode'] } : s)}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cookieless">Cookieless (no consent needed)</SelectItem>
                      <SelectItem value="strict">Strict (explicit consent required)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">Determines whether visitor consent is required.</p>
                </div>
              </div>

              <Separator className="bg-border/40" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between rounded-lg border border-border/60 p-4 bg-card/50">
                  <div>
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Globe className="h-3 w-3 text-indigo-500" />
                      Respect Do-Not-Track
                    </Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Block tracking when browser sends DNT:1</p>
                  </div>
                  <Switch
                    checked={privacySettings.respectDnt}
                    onCheckedChange={(v) => setPrivacySettings(s => s ? { ...s, respectDnt: v } : s)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-orange-500" />
                    Data Retention (days)
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={3650}
                    value={privacySettings.dataRetentionDays ?? ''}
                    onChange={(e) => setPrivacySettings(s => s ? { ...s, dataRetentionDays: e.target.value ? parseInt(e.target.value) : null } : s)}
                    placeholder="Plan default"
                    className="h-9 text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">Leave empty to use your plan&apos;s default retention period.</p>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button size="sm" onClick={handleSavePrivacy} disabled={isSavingSettings} className="gap-1.5 text-xs font-semibold">
                  {isSavingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save Privacy Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ====== Data Export & Import ====== */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Database className="h-3.5 w-3.5 text-muted-foreground" />
          <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Data Export & Import</h4>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Export All Data */}
          <Card className="border-border/60 bg-card hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex flex-col h-full">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Download className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">Export All Data</h4>
                  <p className="text-[10px] text-muted-foreground">GDPR Article 20</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed flex-1">
                Download all analytics data across all websites — events, sessions, heatmaps, replays, goals, and funnels.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportAll}
                disabled={isExporting || !user?.id}
                className="w-full gap-1.5 text-xs font-semibold"
              >
                {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                {isExporting ? 'Exporting...' : 'Export All (JSON)'}
              </Button>
            </CardContent>
          </Card>

          {/* Export Website Data */}
          {websiteId && (
            <Card className="border-border/60 bg-card hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex flex-col h-full">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="h-9 w-9 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                    <Globe className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">Export Website</h4>
                    <p className="text-[10px] text-muted-foreground">This website only</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed flex-1">
                  Export all data for this specific website. Includes events, sessions, heatmaps, replays, goals, and funnels.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportWebsite}
                  disabled={isExportingWebsite}
                  className="w-full gap-1.5 text-xs font-semibold"
                >
                  {isExportingWebsite ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  {isExportingWebsite ? 'Exporting...' : 'Export Website (JSON)'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Import Data */}
          {websiteId && (
            <Card className="border-border/60 bg-card hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex flex-col h-full">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Upload className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">Import Data</h4>
                    <p className="text-[10px] text-muted-foreground">Restore from export</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed flex-1">
                  Import analytics data from a previously exported JSON file into this website. Supports events, sessions, goals, and funnels.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="w-full gap-1.5 text-xs font-semibold"
                >
                  {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {isImporting ? 'Importing...' : 'Import JSON'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Import result summary */}
        {importResult && (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Import Complete</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(importResult).map(([key, count]) => (
                  <div key={key} className="text-center">
                    <p className="text-lg font-bold">{count}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider capitalize">{key}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ====== Data Actions ====== */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
          <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Data Actions</h4>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {/* Anonymize */}
          <Card className="border-border/60 bg-card hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex flex-col h-full">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Fingerprint className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">Anonymize Data</h4>
                  <p className="text-[10px] text-muted-foreground">Pseudonymize all records</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed flex-1">
                Replace all identifiable visitor data with anonymous hashes while preserving aggregate analytics.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAnonymize}
                disabled={!user?.id}
                className="w-full gap-1.5 text-xs font-semibold"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Anonymize Data
              </Button>
            </CardContent>
          </Card>

          {/* Delete */}
          <Card className="border-border/60 bg-card hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex flex-col h-full">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Trash2 className="h-4 w-4 text-red-500" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">Delete Data</h4>
                  <p className="text-[10px] text-muted-foreground">GDPR Article 17</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed flex-1">
                Permanently delete all analytics data{websiteId ? ' for this website' : ''}. Includes events, sessions, heatmaps, replays, goals, and funnels. This is irreversible.
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting}
                className="w-full gap-1.5 text-xs font-semibold"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete All Data
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Irreversible Actions</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                Anonymize and delete operations are processed immediately. Deletion removes all data including events, sessions, heatmaps, replays, goals, and funnels. Backup copies are purged within 30 days.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ====== Enterprise: GDPR Request History ====== */}
      {isEnterprise && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">GDPR Data Requests</h4>
            </div>
            {gdprRequests.length > 0 && (
              <span className="text-[10px] text-muted-foreground">{gdprRequests.length} total</span>
            )}
          </div>

          {isLoadingRequests ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : gdprRequests.length === 0 ? (
            <Card className="border-dashed border-border/60">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <div className="h-12 w-12 rounded-lg-full bg-muted/30 flex items-center justify-center mb-3">
                  <Shield className="h-6 w-6 text-muted-foreground/30" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No data requests yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1 max-w-sm">
                  GDPR data export and deletion requests from your users will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {gdprRequests.map((req) => (
                <Card key={req.id} className="border-border/60 bg-card">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
                        req.requestType === 'deletion' ? 'bg-red-500/10' : 'bg-primary/10'
                      )}>
                        {req.requestType === 'deletion' ? (
                          <Trash2 className="h-4 w-4 text-red-500" />
                        ) : (
                          <Download className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold capitalize">{req.requestType} Request</p>
                          <StatusBadge status={req.status} />
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {req.userEmail && (
                            <p className="text-[11px] text-muted-foreground">{req.userEmail}</p>
                          )}
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground/50" />
                            <p className="text-[11px] text-muted-foreground">
                              {new Date(req.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    {req.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelGdprRequest(req.id)}
                        className="text-xs text-muted-foreground hover:text-destructive h-8 gap-1"
                      >
                        <Ban className="h-3 w-3" />
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

      {/* ====== Data Retention ====== */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Data Retention</h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Analytics', value: 'Plan-based', icon: Database },
            { label: 'Heatmaps', value: '90 days', icon: Fingerprint },
            { label: 'Replays', value: '30 days', icon: FileText },
            { label: 'Cleanup', value: 'Weekly', icon: RefreshCw },
          ].map((item) => (
            <Card key={item.label} className="border-border/60 bg-card/50">
              <CardContent className="p-4 flex items-center gap-3">
                <item.icon className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{item.label}</p>
                  <p className="text-sm font-bold">{item.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ====== Privacy Info ====== */}
      <div className="bg-gradient-to-r from-emerald-500/5 via-transparent to-indigo-500/5 border border-border/40 rounded-lg p-5">
        <div className="flex gap-4">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Info className="h-4.5 w-4.5 text-emerald-600" />
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-bold">Privacy by Design</h4>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {[
                'No personally identifiable information (PII) collected by default',
                'All data processed in GDPR-compliant infrastructure',
                'Cookie-less tracking option eliminates consent banners',
                'Full data portability and right-to-deletion support',
                'No data sold or shared with third parties',
                'Open-source tracker script for full transparency',
              ].map((point, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ====== Delete Confirmation Dialog ====== */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete All Analytics Data
            </DialogTitle>
            <DialogDescription>
              This will permanently delete {websiteId ? 'all analytics data for this website' : 'all your analytics data'} including events, sessions, heatmaps, replays, goals, and funnels.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs font-medium">
              Type <span className="font-bold text-red-600">delete my data</span> to confirm:
            </Label>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="delete my data"
              className="font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteConfirmText !== 'delete my data' || isDeleting}
              className="gap-1.5"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Permanently Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Helpers ---

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
