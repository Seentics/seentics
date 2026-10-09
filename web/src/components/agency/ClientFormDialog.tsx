'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { AgencyClient, AgencyClientFeatures } from '@/features/agency';
import { isDemoRefusal, useCreateClient, useUpdateClient } from '@/features/agency/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { CLIENT_FEATURE_LABELS, DEFAULT_CLIENT_FEATURES } from '@/features/agency/constants';

/**
 * Create-and-edit dialog for an agency client.
 *
 * 150 lines in the route file, and the only way to see the edit state was to open a
 * client and click edit. `initial` absent means create.
 */
export interface ClientFormDialogProps {
  websiteId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: AgencyClient | null;
}

export function ClientFormDialog({ websiteId, open, onOpenChange, initial }: ClientFormDialogProps) {
  const isEdit = !!initial;

  const [name, setName]             = useState(initial?.name ?? '');
  const [externalId, setExternalId] = useState(initial?.externalId ?? '');
  const [company, setCompany]       = useState(initial?.company ?? '');
  const [email, setEmail]           = useState(initial?.email ?? '');
  const [websiteUrl, setWebsiteUrl] = useState(initial?.websiteUrl ?? '');
  const [note, setNote]             = useState(initial?.note ?? '');
  const [status, setStatus]         = useState<AgencyClient['status']>(initial?.status ?? 'active');
  const [features, setFeatures]     = useState<AgencyClientFeatures>(
    initial?.featuresEnabled ? { ...initial.featuresEnabled } : { ...DEFAULT_CLIENT_FEATURES },
  );

  // Every time it opens: `useState` read `initial` only on first mount, so editing a second
  // client showed the first one's values.
  useEffect(() => {
    if (open) resetToInitial(initial);
  }, [open, initial]);

  const resetToInitial = (client?: AgencyClient | null) => {
    setName(client?.name ?? '');
    setExternalId(client?.externalId ?? '');
    setCompany(client?.company ?? '');
    setEmail(client?.email ?? '');
    setWebsiteUrl(client?.websiteUrl ?? '');
    setNote(client?.note ?? '');
    setStatus(client?.status ?? 'active');
    setFeatures(client?.featuresEnabled ? { ...client.featuresEnabled } : { ...DEFAULT_CLIENT_FEATURES });
  };

  const createMutation = useCreateClient(websiteId);
  const updateMutation = useUpdateClient(websiteId);
  const onError = (err: any) => {
    if (isDemoRefusal(err)) return;
    toast.error(err.response?.data?.error === 'external_id_taken'
      ? 'Another client already has that ID.'
      : err.message || 'Failed to save client');
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = () => {
    if (!name.trim()) return;
    const req = {
      name: name.trim(),
      externalId: externalId.trim() || null,
      company: company.trim(),
      email: email.trim(),
      websiteUrl: websiteUrl.trim(),
      status,
      note: note.trim(),
      featuresEnabled: features,
    };
    if (isEdit && initial) {
      updateMutation.mutate({ id: initial.id, req }, {
        onSuccess: () => { toast.success('Client updated'); onOpenChange(false); },
        onError,
      });
    } else {
      createMutation.mutate(req, {
        onSuccess: () => { toast.success('Client created'); onOpenChange(false); },
        onError,
      });
    }
  };

  const toggleFeature = (key: keyof AgencyClientFeatures) =>
    setFeatures(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border border-border rounded-lg p-0 gap-0">
        <DialogHeader className="px-6 py-5 border-b border-border">
          <DialogTitle className="text-base font-semibold">
            {isEdit ? 'Edit Client' : 'Add Client'}
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Name <span className="text-destructive">*</span></Label>
              <Input placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Company</Label>
              <Input placeholder="Acme Corp" value={company} onChange={e => setCompany(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Email</Label>
              <Input type="email" placeholder="jane@acme.com" value={email} onChange={e => setEmail(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Your ID for this client</Label>
              <Input placeholder="tenant_482" value={externalId} onChange={e => setExternalId(e.target.value)} className="h-9 text-sm font-mono" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Website URL</Label>
            <Input placeholder="https://acme.com" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} className="h-9 text-sm" />
          </div>

          {isEdit && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Status</Label>
              <Select value={status} onValueChange={v => setStatus(v as AgencyClient['status'])}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Note</Label>
            <Textarea placeholder="Internal notes…" value={note} onChange={e => setNote(e.target.value)} className="text-sm resize-none h-20" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Features Enabled</Label>
            <div className="grid grid-cols-2 gap-2">
              {CLIENT_FEATURE_LABELS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={features[key]}
                    onChange={() => toggleFeature(key)}
                    className="rounded-lg border-border accent-primary h-4 w-4"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!name.trim() || isPending}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            {isEdit ? 'Save Changes' : 'Add Client'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
