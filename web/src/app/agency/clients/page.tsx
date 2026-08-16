'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listClients,
  createClient,
  updateClient,
  deleteClient,
  AgencyClient,
  AgencyClientFeatures,
  CreateClientRequest,
  UpdateClientRequest,
} from '@/lib/agency-api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import Link from 'next/link';
import {
  Users,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Building2,
  Mail,
  Globe,
  Calendar,
  FileText,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

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
  analytics: true, heatmaps: true, replays: true, funnels: true, automations: true,
};

// ─── Client Form Dialog ───────────────────────────────────────────────────────

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: AgencyClient | null;
  onDone: () => void;
}

function ClientFormDialog({ open, onOpenChange, initial, onDone }: ClientFormDialogProps) {
  const isEdit = !!initial;

  const [name, setName]             = useState(initial?.name ?? '');
  const [company, setCompany]       = useState(initial?.company ?? '');
  const [email, setEmail]           = useState(initial?.email ?? '');
  const [websiteUrl, setWebsiteUrl] = useState(initial?.websiteUrl ?? '');
  const [note, setNote]             = useState(initial?.note ?? '');
  const [status, setStatus]         = useState<AgencyClient['status']>(initial?.status ?? 'active');
  const [features, setFeatures]     = useState<AgencyClientFeatures>(
    initial?.featuresEnabled ? { ...initial.featuresEnabled } : { ...DEFAULT_FEATURES },
  );

  // Re-sync when `initial` changes (dialog re-opened with different client)
  const resetToInitial = (client?: AgencyClient | null) => {
    setName(client?.name ?? '');
    setCompany(client?.company ?? '');
    setEmail(client?.email ?? '');
    setWebsiteUrl(client?.websiteUrl ?? '');
    setNote(client?.note ?? '');
    setStatus(client?.status ?? 'active');
    setFeatures(client?.featuresEnabled ? { ...client.featuresEnabled } : { ...DEFAULT_FEATURES });
  };

  const createMutation = useMutation({
    mutationFn: (req: CreateClientRequest) => createClient(req),
    onSuccess: () => { toast.success('Client created'); onDone(); onOpenChange(false); },
    onError: (err: any) => toast.error(err.message || 'Failed to create client'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, req }: { id: string; req: UpdateClientRequest }) => updateClient(id, req),
    onSuccess: () => { toast.success('Client updated'); onDone(); onOpenChange(false); },
    onError: (err: any) => toast.error(err.message || 'Failed to update client'),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = () => {
    if (!name.trim() || !email.trim()) return;
    const req = {
      name: name.trim(),
      company: company.trim(),
      email: email.trim(),
      websiteUrl: websiteUrl.trim(),
      status,
      note: note.trim(),
      featuresEnabled: features,
    };
    if (isEdit && initial) {
      updateMutation.mutate({ id: initial.id, req });
    } else {
      createMutation.mutate(req);
    }
  };

  const toggleFeature = (key: keyof AgencyClientFeatures) =>
    setFeatures(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetToInitial(initial); }}>
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

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Email <span className="text-destructive">*</span></Label>
            <Input type="email" placeholder="jane@acme.com" value={email} onChange={e => setEmail(e.target.value)} className="h-9 text-sm" />
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
              {FEATURE_LABELS.map(({ key, label }) => (
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
          <Button size="sm" onClick={handleSubmit} disabled={!name.trim() || !email.trim() || isPending}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            {isEdit ? 'Save Changes' : 'Add Client'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Client Card ──────────────────────────────────────────────────────────────

interface ClientCardProps {
  client: AgencyClient;
  onEdit: (client: AgencyClient) => void;
  onDelete: (client: AgencyClient) => void;
  isDeleting: boolean;
}

function ClientCard({ client, onEdit, onDelete, isDeleting }: ClientCardProps) {
  return (
    <Card className="border border-border/60 hover:border-border transition-colors">
      <CardContent className="p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-primary">
                {client.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">{client.name}</h3>
                <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border capitalize', STATUS_STYLES[client.status])}>
                  {client.status}
                </Badge>
              </div>
              {client.company && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Building2 className="h-3 w-3 opacity-60" />
                  {client.company}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost" size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              asChild
            >
              <Link href={`/agency/clients/${client.id}`}>
                <Eye className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button
              variant="ghost" size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(client)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(client)}
              disabled={isDeleting}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Contact info */}
        <div className="space-y-1 text-[11px] text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <Mail className="h-3 w-3 opacity-60 shrink-0" />
            {client.email}
          </p>
          {client.websiteUrl && (
            <p className="flex items-center gap-1.5">
              <Globe className="h-3 w-3 opacity-60 shrink-0" />
              <a href={client.websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline truncate max-w-[200px]">
                {client.websiteUrl}
              </a>
            </p>
          )}
          {client.note && (
            <p className="flex items-start gap-1.5">
              <FileText className="h-3 w-3 opacity-60 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{client.note}</span>
            </p>
          )}
        </div>

        {/* Features */}
        <div className="flex flex-wrap gap-1">
          {FEATURE_LABELS.map(f => (
            <span
              key={f.key}
              className={cn(
                'text-[10px] px-1.5 py-0 rounded-lg-sm border',
                client.featuresEnabled[f.key]
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-muted/30 text-muted-foreground/50 border-border/40 line-through',
              )}
            >
              {f.label}
            </span>
          ))}
        </div>

        {/* Footer */}
        <p className="text-[11px] text-muted-foreground flex items-center gap-1 border-t border-border/40 pt-3">
          <Calendar className="h-3 w-3 opacity-50" />
          Added {client.createdAt ? format(new Date(client.createdAt), 'MMM d, yyyy') : '—'}
          {client.updatedAt && client.updatedAt !== client.createdAt && (
            <span className="ml-2 opacity-60">· Updated {format(new Date(client.updatedAt), 'MMM d, yyyy')}</span>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgencyClientsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm]     = useState(false);
  const [editTarget, setEditTarget] = useState<AgencyClient | null>(null);
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | AgencyClient['status']>('all');

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
    onError: (err: any) => toast.error(err.message || 'Failed to delete client'),
  });

  const handleDelete = (client: AgencyClient) => {
    if (!confirm(`Delete client "${client.name}"? This cannot be undone.`)) return;
    deleteMutation.mutate(client.id);
  };

  const handleEdit = (client: AgencyClient) => {
    setEditTarget(client);
    setShowForm(true);
  };

  const filtered = clients.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-6 max-w-[1100px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{clients.length} total client{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <Button
          size="sm" className="h-9 gap-1.5"
          onClick={() => { setEditTarget(null); setShowForm(true); }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Client
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Search by name, email, company…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-sm w-64"
        />
        <div className="flex items-center gap-1.5">
          {(['all', 'active', 'suspended', 'archived'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                'px-3 py-1 text-xs rounded-lg font-medium capitalize transition-colors',
                filterStatus === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border/50 rounded-lg">
          <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {clients.length === 0 ? 'No clients yet.' : 'No clients match your filters.'}
          </p>
          {clients.length === 0 && (
            <Button
              size="sm" className="mt-4 gap-1.5"
              onClick={() => { setEditTarget(null); setShowForm(true); }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Client
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(client => (
            <ClientCard
              key={client.id}
              client={client}
              onEdit={handleEdit}
              onDelete={handleDelete}
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}

      <ClientFormDialog
        open={showForm}
        onOpenChange={(v) => { setShowForm(v); if (!v) setEditTarget(null); }}
        initial={editTarget}
        onDone={() => queryClient.invalidateQueries({ queryKey: ['agency-clients'] })}
      />
    </div>
  );
}
