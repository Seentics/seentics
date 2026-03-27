'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listClients,
  createClient,
  deleteClient,
  AgencyClient,
  AgencyClientFeatures,
  CreateClientRequest,
} from '@/lib/agency-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  Users,
  UserCheck,
  UserX,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Building2,
  Mail,
  Globe,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import Link from 'next/link';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<AgencyClient['status'], string> = {
  active:    'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  suspended: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  archived:  'bg-muted text-muted-foreground border-border',
};

const FEATURE_LABELS: Array<{ key: keyof AgencyClientFeatures; label: string }> = [
  { key: 'analytics',   label: 'Analytics' },
  { key: 'heatmaps',    label: 'Heatmaps' },
  { key: 'replays',     label: 'Replays' },
  { key: 'funnels',     label: 'Funnels' },
  { key: 'automations', label: 'Automations' },
];

const DEFAULT_FEATURES: AgencyClientFeatures = {
  analytics: true,
  heatmaps: true,
  replays: true,
  funnels: true,
  automations: true,
};

// ─── Create Dialog ────────────────────────────────────────────────────────────

interface CreateClientDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

function CreateClientDialog({ open, onOpenChange, onCreated }: CreateClientDialogProps) {
  const [name, setName]           = useState('');
  const [company, setCompany]     = useState('');
  const [email, setEmail]         = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [note, setNote]           = useState('');
  const [features, setFeatures]   = useState<AgencyClientFeatures>({ ...DEFAULT_FEATURES });

  const mutation = useMutation({
    mutationFn: (req: CreateClientRequest) => createClient(req),
    onSuccess: () => {
      toast.success('Client created successfully');
      onCreated();
      resetForm();
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create client');
    },
  });

  const resetForm = () => {
    setName(''); setCompany(''); setEmail('');
    setWebsiteUrl(''); setNote('');
    setFeatures({ ...DEFAULT_FEATURES });
  };

  const handleSubmit = () => {
    if (!name.trim() || !email.trim()) return;
    mutation.mutate({
      name: name.trim(),
      company: company.trim(),
      email: email.trim(),
      websiteUrl: websiteUrl.trim(),
      status: 'active',
      note: note.trim(),
      featuresEnabled: features,
    });
  };

  const toggleFeature = (key: keyof AgencyClientFeatures) =>
    setFeatures(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-md bg-card border border-border rounded-xl p-0 gap-0">
        <DialogHeader className="px-6 py-5 border-b border-border">
          <DialogTitle className="text-base font-semibold">Add Client</DialogTitle>
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

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Email <span className="text-destructive">*</span></Label>
            <Input type="email" placeholder="jane@acme.com" value={email} onChange={e => setEmail(e.target.value)} className="h-9 text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Website URL</Label>
            <Input placeholder="https://acme.com" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} className="h-9 text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Note</Label>
            <Textarea placeholder="Internal notes…" value={note} onChange={e => setNote(e.target.value)} className="text-sm resize-none h-20" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Features Enabled</Label>
            <div className="grid grid-cols-2 gap-2">
              {FEATURE_LABELS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={features[key]}
                    onChange={() => toggleFeature(key)}
                    className="rounded border-border accent-primary h-4 w-4"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!name.trim() || !email.trim() || mutation.isPending}>
            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            Add Client
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgencyOverviewPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['agency-clients'],
    queryFn: listClients,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => {
      toast.success('Client deleted');
      queryClient.invalidateQueries({ queryKey: ['agency-clients'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete client');
    },
  });

  const handleDelete = (client: AgencyClient) => {
    if (!confirm(`Delete client "${client.name}"? This cannot be undone.`)) return;
    deleteMutation.mutate(client.id);
  };

  const total     = clients.length;
  const active    = clients.filter(c => c.status === 'active').length;
  const inactive  = clients.filter(c => c.status !== 'active').length;

  const recentClients = [...clients]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return (
    <div className="p-6 max-w-[1100px] mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Agency Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your clients and agency settings.</p>
        </div>
        <Button size="sm" className="h-9 gap-1.5" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add Client
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Clients',       value: total,    icon: Users,     color: 'text-foreground' },
          { label: 'Active',              value: active,   icon: UserCheck, color: 'text-green-600' },
          { label: 'Suspended / Archived',value: inactive, icon: UserX,     color: 'text-muted-foreground' },
        ].map(s => (
          <Card key={s.label} className="border border-border/60">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={cn('h-5 w-5 shrink-0', s.color)} />
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent clients */}
      <Card className="border border-border/60">
        <CardHeader className="px-5 py-4 border-b border-border/40 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Recent Clients</CardTitle>
          <Link href="/agency/clients" className="text-xs text-primary hover:underline">View all</Link>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : recentClients.length === 0 ? (
            <div className="py-14 text-center">
              <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No clients yet. Add your first client.</p>
              <Button size="sm" className="mt-4 gap-1.5" onClick={() => setShowCreate(true)}>
                <Plus className="h-3.5 w-3.5" />
                Add Client
              </Button>
            </div>
          ) : (
            recentClients.map(client => (
              <div
                key={client.id}
                className="flex items-start gap-4 px-5 py-4 border-b border-border/40 last:border-0"
              >
                {/* Avatar */}
                <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">
                    {client.name.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{client.name}</span>
                    <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border capitalize', STATUS_STYLES[client.status])}>
                      {client.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
                    {client.company && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3 opacity-60" />
                        {client.company}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3 opacity-60" />
                      {client.email}
                    </span>
                    {client.websiteUrl && (
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3 opacity-60" />
                        {client.websiteUrl}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 opacity-60" />
                      {client.createdAt ? format(new Date(client.createdAt), 'MMM d, yyyy') : '—'}
                    </span>
                  </div>

                  {/* Feature chips */}
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {FEATURE_LABELS.filter(f => client.featuresEnabled[f.key]).map(f => (
                      <span
                        key={f.key}
                        className="text-[10px] px-1.5 py-0 rounded-sm bg-muted text-muted-foreground border border-border/60"
                      >
                        {f.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Link href="/agency/clients">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(client)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <CreateClientDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['agency-clients'] })}
      />
    </div>
  );
}
