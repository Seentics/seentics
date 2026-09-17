'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useState } from 'react';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getClient,
  updateClient,
  listClientWebsites,
  assignWebsite,
  unassignWebsite,
  generatePortalToken,
  AgencyClient,
  AgencyClientFeatures,
  ClientLimits,
  ClientWebsite,
  PortalToken,
} from '@/lib/agency-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ArrowLeft,
  Loader2,
  Globe,
  Link2,
  Trash2,
  Plus,
  Copy,
  Check,
  KeyRound,
  Building2,
  Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CLIENT_STATUS_STYLES } from '@/features/agency/constants';

// ─── Status badge ─────────────────────────────────────────────────────────────


// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'websites' | 'portal';

// ─── Overview Tab ─────────────────────────────────────────────────────────────

import { OverviewTab, WebsitesTab, PortalAccessTab } from '@/components/agency/client-tabs';

export default function ClientDetailPage() {
  const params = { clientId: usePathSegment(2) ?? '' };
  const clientId = params.clientId as string;
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { data: client, isLoading, isError } = useQuery({
    queryKey: ['agency-client', clientId],
    queryFn: () => getClient(clientId),
    enabled: !!clientId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !client) {
    return (
      <div className="p-6 max-w-[800px] mx-auto">
        <div className="py-16 text-center border border-dashed border-border/50 rounded-lg">
          <p className="text-sm text-muted-foreground">Client not found or you don't have access.</p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link href="/agency/clients">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Back to Clients
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'websites', label: 'Websites' },
    { id: 'portal',   label: 'Portal Access' },
  ];

  return (
    <div className="p-6 max-w-[800px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/agency/clients"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Clients
        </Link>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary">
              {client.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{client.name}</h1>
              <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border capitalize', CLIENT_STATUS_STYLES[client.status])}>
                {client.status}
              </Badge>
            </div>
            {client.company && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <Building2 className="h-3 w-3 opacity-60" />
                {client.company}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border/60">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab client={client} />}
      {activeTab === 'websites' && <WebsitesTab client={client} />}
      {activeTab === 'portal'   && <PortalAccessTab client={client} />}
    </div>
  );
}
