'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getWhiteLabel, updateWhiteLabel, WhiteLabelSettings } from '@/lib/agency-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Paintbrush, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

function isValidHex(value: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value);
}

export default function WhiteLabelPage() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading, isError } = useQuery({
    queryKey: ['agency-white-label'],
    queryFn: getWhiteLabel,
  });

  // Form state
  const [brandName, setBrandName]       = useState('');
  const [logoUrl, setLogoUrl]           = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [hexInput, setHexInput]         = useState('#6366f1');
  const [supportEmail, setSupportEmail] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [hideSeentics, setHideSeentics] = useState(false);

  // Sync form state when data loads
  useEffect(() => {
    if (settings) {
      setBrandName(settings.brandName);
      setLogoUrl(settings.logoUrl);
      setPrimaryColor(settings.primaryColor || '#6366f1');
      setHexInput(settings.primaryColor || '#6366f1');
      setSupportEmail(settings.supportEmail);
      setCustomDomain(settings.customDomain);
      setHideSeentics(settings.hideSeentics);
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (req: Partial<WhiteLabelSettings>) => updateWhiteLabel(req),
    onSuccess: (updated) => {
      toast.success('White label settings saved');
      queryClient.setQueryData(['agency-white-label'], updated);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save settings');
    },
  });

  const handleSave = () => {
    mutation.mutate({
      brandName: brandName.trim(),
      logoUrl: logoUrl.trim(),
      primaryColor: isValidHex(hexInput) ? hexInput : primaryColor,
      supportEmail: supportEmail.trim(),
      customDomain: customDomain.trim(),
      hideSeentics,
    });
  };

  const handleColorPickerChange = (val: string) => {
    setPrimaryColor(val);
    setHexInput(val);
  };

  const handleHexInputChange = (val: string) => {
    setHexInput(val);
    if (isValidHex(val)) {
      setPrimaryColor(val);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 max-w-[700px] mx-auto">
        <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load white label settings. Please refresh the page.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[700px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">White Label</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Customize the branding shown to your clients.
        </p>
      </div>

      {/* Branding */}
      <Card className="border border-border/60">
        <CardHeader className="px-5 py-4 border-b border-border/40">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Paintbrush className="h-4 w-4 text-primary" />
            Brand Identity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Brand Name</Label>
            <Input
              placeholder="Your Agency Name"
              value={brandName}
              onChange={e => setBrandName(e.target.value)}
              className="h-9 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">Displayed in the sidebar header and email notifications.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Primary Color</Label>
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={e => handleColorPickerChange(e.target.value)}
                  className="h-9 w-12 rounded border border-border cursor-pointer bg-transparent p-0.5"
                />
              </div>
              <Input
                placeholder="#6366f1"
                value={hexInput}
                onChange={e => handleHexInputChange(e.target.value)}
                className={cn('h-9 text-sm font-mono w-32', !isValidHex(hexInput) && hexInput.length > 0 && 'border-destructive')}
                maxLength={7}
              />
              <div
                className="h-9 w-9 rounded border border-border/60 shrink-0"
                style={{ backgroundColor: isValidHex(hexInput) ? hexInput : primaryColor }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logo */}
      <Card className="border border-border/60">
        <CardHeader className="px-5 py-4 border-b border-border/40">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            Logo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Logo URL</Label>
            <Input
              placeholder="https://youragency.com/logo.png"
              value={logoUrl}
              onChange={e => setLogoUrl(e.target.value)}
              className="h-9 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">Use a PNG or SVG URL. Recommended size: 48×48px or larger.</p>
          </div>

          {/* Preview */}
          {logoUrl && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
              <img
                src={logoUrl}
                alt="Logo preview"
                className="h-10 w-10 object-contain rounded"
                onError={e => {
                  (e.target as HTMLImageElement).src = '';
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <p className="text-xs text-muted-foreground">Logo preview</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact & Domain */}
      <Card className="border border-border/60">
        <CardHeader className="px-5 py-4 border-b border-border/40">
          <CardTitle className="text-sm font-semibold">Contact & Domain</CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Support Email</Label>
            <Input
              type="email"
              placeholder="support@youragency.com"
              value={supportEmail}
              onChange={e => setSupportEmail(e.target.value)}
              className="h-9 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">Shown to clients on help and error pages.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Custom Domain</Label>
            <Input
              placeholder="analytics.youragency.com"
              value={customDomain}
              onChange={e => setCustomDomain(e.target.value)}
              className="h-9 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">Point a CNAME to our servers to host under your own domain.</p>
          </div>
        </CardContent>
      </Card>

      {/* Seentics branding */}
      <Card className="border border-border/60">
        <CardContent className="p-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Hide Seentics Branding</p>
            <p className="text-xs text-muted-foreground">
              Remove all references to Seentics in the UI. Your brand is shown exclusively.
            </p>
          </div>
          <Switch
            checked={hideSeentics}
            onCheckedChange={setHideSeentics}
            className="shrink-0 mt-0.5"
          />
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={mutation.isPending} className="gap-2">
          {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
