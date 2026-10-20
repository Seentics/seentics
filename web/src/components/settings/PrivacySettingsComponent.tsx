'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Trash2,
  AlertTriangle,
  Loader2,
  Info,
  Save,
  Clock,
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
import { privacyAPI, WebsitePrivacySettings } from '@/lib/privacy-api';
import { useAuth } from '@/stores/useAuthStore';
import { isEnterprise } from '@/lib/features';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { VisitorRequestCard } from './VisitorRequestCard';
import { useT } from '@/lib/i18n';

interface PrivacySettingsProps {
  websiteId?: string;
}

// --- Sub-components ---

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
    <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card/50 hover:bg-card/80 transition-all group">
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
  const tAll = useT();
  const t = tAll.settings.privacy;

  // --- Shared state ---
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingWebsite, setIsExportingWebsite] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // --- OSS: local privacy toggles ---
  const [ipAnonymization, setIpAnonymization] = useState(true);
  const [cookielessMode, setCookielessMode] = useState(true);
  const [respectDnt, setRespectDnt] = useState(true);
  const [botFiltering, setBotFiltering] = useState(true);

  // --- Enterprise: per-website settings ---
  const [privacySettings, setPrivacySettings] = useState<WebsitePrivacySettings | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);


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
      toast.success(t.settingUpdated);
    } catch {
      toast.error(t.settingFailed);
    }
  }, [ipAnonymization, cookielessMode, respectDnt, botFiltering, t]);

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

  // --- Handlers ---

  const handleSavePrivacy = async () => {
    if (!websiteId || !privacySettings) return;
    setIsSavingSettings(true);
    try {
      await privacyAPI.updateWebsitePrivacy(websiteId, privacySettings);
      toast.success(t.saved);
    } catch {
      toast.error(t.saveFailed);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Export all user data
  const handleExportAll = async () => {
    if (!user?.id) {
      toast.error(t.signedOut);
      return;
    }
    try {
      setIsExporting(true);
      const data = await privacyAPI.exportAnalyticsData(user.id);
      downloadJson(data, `seentics-all-data-export-${new Date().toISOString().split('T')[0]}.json`);
      toast.success(t.allExported);
    } catch {
      toast.error(t.exportFailed);
    } finally {
      setIsExporting(false);
    }
  };

  // Export website-specific data
  const handleExportWebsite = async () => {
    if (!websiteId) {
      toast.error(t.noWebsite);
      return;
    }
    try {
      setIsExportingWebsite(true);
      const res = await privacyAPI.exportWebsiteData(websiteId);
      const exportData = res.data || res;
      downloadJson(exportData, `seentics-website-${websiteId}-export-${new Date().toISOString().split('T')[0]}.json`);
      toast.success(t.websiteExported);
    } catch {
      toast.error(t.websiteExportFailed);
    } finally {
      setIsExportingWebsite(false);
    }
  };

  const handleDelete = async () => {
    if (!websiteId && !user?.id) return;
    try {
      setIsDeleting(true);
      if (websiteId) {
        await privacyAPI.deleteWebsiteAnalytics(websiteId);
        toast.success(t.websiteDeleted);
      } else if (user?.id) {
        await privacyAPI.deleteAnalyticsData(user.id);
        toast.success(t.allDeleted);
      }
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    } catch {
      toast.error(t.deleteFailed);
    } finally {
      setIsDeleting(false);
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
              <h3 className="text-lg font-bold tracking-tight">{t.title}</h3>
              <p className="text-xs text-muted-foreground">{t.description}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{t.privacyFirst}</span>
          </div>
        </div>
      </div>

      {/* ====== Privacy Controls ====== */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">{t.controls}</h4>
        </div>

        {/* OSS mode: local toggles */}
        {!isEnterprise && (
          <div className="space-y-2">
            <PrivacyToggleCard
              icon={EyeOff}
              title={t.ipAnonymization}
              description={t.ipAnonymizationBody}
              checked={ipAnonymization}
              onToggle={(v) => handleOssToggle('ipAnonymization', v)}
              color="text-indigo-500"
              bgColor="bg-indigo-500/10"
            />
            <PrivacyToggleCard
              icon={Cookie}
              title={t.cookieless}
              description={t.cookielessBody}
              checked={cookielessMode}
              onToggle={(v) => handleOssToggle('cookielessMode', v)}
              color="text-indigo-500"
              bgColor="bg-indigo-500/10"
            />
            <PrivacyToggleCard
              icon={Globe}
              title={t.dnt}
              description={t.dntBody}
              checked={respectDnt}
              onToggle={(v) => handleOssToggle('respectDnt', v)}
              color="text-indigo-500"
              bgColor="bg-indigo-500/10"
            />
            <PrivacyToggleCard
              icon={Bot}
              title={t.bots}
              description={t.botsBody}
              checked={botFiltering}
              onToggle={(v) => handleOssToggle('botFiltering', v)}
              color="text-teal-500"
              bgColor="bg-teal-500/10"
            />
          </div>
        )}

        {/* Enterprise mode: per-website settings */}
        {isEnterprise && websiteId && privacySettings && (
          <Card className="border-border bg-card">
            <CardContent className="p-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <EyeOff className="h-3 w-3 text-indigo-500" />
                    {t.ipAnonymization}
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
                          <XCircle className="h-3 w-3 text-red-400" /> {t.ipNone}
                        </span>
                      </SelectItem>
                      <SelectItem value="partial">
                        <span className="flex items-center gap-2">
                          <EyeOff className="h-3 w-3 text-amber-500" /> {t.ipPartial}
                        </span>
                      </SelectItem>
                      <SelectItem value="full">
                        <span className="flex items-center gap-2">
                          <Fingerprint className="h-3 w-3 text-emerald-500" /> {t.ipFull}
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">{t.ipHint}</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Cookie className="h-3 w-3 text-indigo-500" />
                    {t.consentMode}
                  </Label>
                  <Select
                    value={privacySettings.consentMode}
                    onValueChange={(v) => setPrivacySettings(s => s ? { ...s, consentMode: v as WebsitePrivacySettings['consentMode'] } : s)}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cookieless">{t.consentCookieless}</SelectItem>
                      <SelectItem value="strict">{t.consentStrict}</SelectItem>
                      <SelectItem value="none">{t.consentNone}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    {privacySettings.consentMode === 'none'
                      ? t.consentNoneHint
                      : privacySettings.consentMode === 'strict'
                        ? t.consentStrictHint
                        : t.consentCookielessHint}
                    {privacySettings.consentMode !== 'none' && (
                      <>{t.consentCallBefore}<code>seentics.consent(true)</code>{t.consentCallAfter}</>
                    )}
                  </p>
                </div>
              </div>

              <Separator className="bg-border/40" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between rounded-lg border border-border p-4 bg-card/50">
                  <div>
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Globe className="h-3 w-3 text-indigo-500" />
                      {t.dnt}
                    </Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{t.dntHint}</p>
                  </div>
                  <Switch
                    checked={privacySettings.respectDnt}
                    onCheckedChange={(v) => setPrivacySettings(s => s ? { ...s, respectDnt: v } : s)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-orange-500" />
                    {t.retention}
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={3650}
                    value={privacySettings.dataRetentionDays ?? ''}
                    onChange={(e) => setPrivacySettings(s => s ? { ...s, dataRetentionDays: e.target.value ? parseInt(e.target.value) : null } : s)}
                    placeholder={t.retentionPlaceholder}
                    className="h-9 text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">{t.retentionHint}</p>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button size="sm" onClick={handleSavePrivacy} disabled={isSavingSettings} className="gap-1.5 text-xs font-semibold">
                  {isSavingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {t.savePrivacy}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ====== Data Export ====== */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Database className="h-3.5 w-3.5 text-muted-foreground" />
          <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">{t.dataExport}</h4>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Export All Data */}
          <Card className="border-border bg-card hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex flex-col h-full">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Download className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">{t.exportAll}</h4>
                  <p className="text-[10px] text-muted-foreground">{t.article20}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed flex-1">
                {t.exportAllBody}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportAll}
                disabled={isExporting || !user?.id}
                className="w-full gap-1.5 text-xs font-semibold"
              >
                {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                {isExporting ? t.exporting : t.exportAllButton}
              </Button>
            </CardContent>
          </Card>

          {/* Export Website Data */}
          {websiteId && (
            <Card className="border-border bg-card hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex flex-col h-full">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="h-9 w-9 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                    <Globe className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">{t.exportWebsite}</h4>
                    <p className="text-[10px] text-muted-foreground">{t.thisWebsiteOnly}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed flex-1">
                  {t.exportWebsiteBody}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportWebsite}
                  disabled={isExportingWebsite}
                  className="w-full gap-1.5 text-xs font-semibold"
                >
                  {isExportingWebsite ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  {isExportingWebsite ? t.exporting : t.exportWebsiteButton}
                </Button>
              </CardContent>
            </Card>
          )}

        </div>
        {websiteId && <VisitorRequestCard websiteId={websiteId} />}
      </div>

      {/* ====== Data Actions ====== */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
          <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">{t.dataActions}</h4>
        </div>

        <div className="grid gap-3">
          {/* Delete */}
          <Card className="border-border bg-card hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex flex-col h-full">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Trash2 className="h-4 w-4 text-red-500" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">{t.deleteData}</h4>
                  <p className="text-[10px] text-muted-foreground">{t.article17}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed flex-1">
                {websiteId ? t.deleteBodyWebsite : t.deleteBodyAll}
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting}
                className="w-full gap-1.5 text-xs font-semibold"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t.deleteAll}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">{t.irreversible}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                {t.irreversibleBody}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ====== Data Retention ====== */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">{t.dataRetention}</h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { ...t.retentionItems.analytics, icon: Database },
            { ...t.retentionItems.heatmaps, icon: Fingerprint },
            { ...t.retentionItems.replays, icon: FileText },
            { ...t.retentionItems.cleanup, icon: RefreshCw },
          ].map((item) => (
            <Card key={item.label} className="border-border bg-card/50">
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
      <div className="bg-gradient-to-r from-emerald-500/5 via-transparent to-indigo-500/5 border border-border rounded-lg p-5">
        <div className="flex gap-4">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Info className="h-4.5 w-4.5 text-emerald-600" />
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-bold">{t.byDesign}</h4>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {t.byDesignPoints.map((point, i) => (
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
              {t.confirmTitle}
            </DialogTitle>
            <DialogDescription>
              {websiteId ? t.confirmBodyWebsite : t.confirmBodyAll}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs font-medium">
              {t.typeBefore}<span className="font-bold text-red-600">delete my data</span>{t.typeAfter}
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
              {tAll.actions.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteConfirmText !== 'delete my data' || isDeleting}
              className="gap-1.5"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              {t.permanentlyDelete}
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
