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
import { CLIENT_STATUS_STYLES, CLIENT_FEATURE_LABELS, DEFAULT_CLIENT_FEATURES } from '@/features/agency/constants';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Client Form Dialog ───────────────────────────────────────────────────────

import { ClientFormDialog } from '@/components/agency/ClientFormDialog';

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
            <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-primary">
                {client.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">{client.name}</h3>
                <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border capitalize', CLIENT_STATUS_STYLES[client.status as keyof typeof CLIENT_STATUS_STYLES])}>
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
          {CLIENT_FEATURE_LABELS.map(f => (
            <span
              key={f.key}
              className={cn(
                'text-[10px] px-1.5 py-0 rounded-sm border',
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
