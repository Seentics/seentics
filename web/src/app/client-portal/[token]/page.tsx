'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import { getApiUrl } from '@/lib/config';
import { AgencyClient, AgencyClientFeatures } from '@/lib/agency-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Globe, BarChart2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Feature badge list ───────────────────────────────────────────────────────

const FEATURE_LABELS: Array<{ key: keyof AgencyClientFeatures; label: string }> = [
  { key: 'analytics',   label: 'Analytics' },
  { key: 'heatmaps',    label: 'Heatmaps' },
  { key: 'replays',     label: 'Session Replays' },
  { key: 'funnels',     label: 'Funnels' },
  { key: 'automations', label: 'Automations' },
];

// ─── Portal Page ──────────────────────────────────────────────────────────────

type PortalState =
  | { status: 'loading' }
  | { status: 'valid'; client: AgencyClient; websiteIds: string[] }
  | { status: 'error'; message: string };

export default function ClientPortalPage() {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<PortalState>({ status: 'loading' });

  useEffect(() => {
    if (!token) {
      setState({ status: 'error', message: 'No portal token provided.' });
      return;
    }

    const validate = async () => {
      try {
        const response = await axios.post(
          `${getApiUrl()}/agency/portal/validate`,
          { token },
          { headers: { 'Content-Type': 'application/json' } },
        );
        const data = response.data?.data || response.data;
        const client = data as AgencyClient;
        // websiteIds may be returned separately in some backends, but the
        // validate endpoint returns the client — we show what's available
        setState({
          status: 'valid',
          client,
          websiteIds: (data as any).websiteIds || [],
        });
      } catch (err: any) {
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          'This portal link is invalid or has expired.';
        setState({ status: 'error', message: msg });
      }
    };

    validate();
  }, [token]);

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full border border-destructive/30">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="h-12 w-12 rounded-lg-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Access Denied</h2>
              <p className="text-sm text-muted-foreground mt-1">{state.message}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Please contact your agency to request a new access link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { client, websiteIds } = state;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/60 bg-card">
        <div className="max-w-[900px] mx-auto px-6 py-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary">
              {client.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-base font-semibold">{client.name}</h1>
            {client.company && (
              <p className="text-xs text-muted-foreground">{client.company}</p>
            )}
          </div>
          <div className="ml-auto">
            <Badge
              className={cn(
                'text-[10px] px-2 py-0.5 border capitalize',
                client.status === 'active'
                  ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800'
                  : 'bg-muted text-muted-foreground border-border',
              )}
            >
              {client.status}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6">
        {/* Features */}
        <Card className="border border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Your Account Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {FEATURE_LABELS.map(({ key, label }) => {
                const enabled = client.featuresEnabled[key];
                return (
                  <span
                    key={key}
                    className={cn(
                      'inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg-full border font-medium',
                      enabled
                        ? 'bg-primary/10 text-primary border-primary/20'
                        : 'bg-muted/30 text-muted-foreground border-border/40 line-through opacity-50',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-lg-full shrink-0',
                        enabled ? 'bg-primary' : 'bg-muted-foreground/40',
                      )}
                    />
                    {label}
                  </span>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Websites */}
        <Card className="border border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Your Websites</CardTitle>
          </CardHeader>
          <CardContent>
            {websiteIds.length === 0 ? (
              <div className="py-8 text-center">
                <Globe className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No websites assigned to your account yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Contact your agency to link your websites.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {websiteIds.map((id) => (
                  <div
                    key={id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/20"
                  >
                    <div className="flex items-center gap-2.5">
                      <Globe className="h-4 w-4 text-muted-foreground opacity-60" />
                      <span className="text-sm font-mono font-medium">{id}</span>
                    </div>
                    <Button
                      variant="outline" size="sm"
                      className="h-7 px-2 text-xs gap-1.5"
                      asChild
                    >
                      <Link href={`/websites/${id}`}>
                        <BarChart2 className="h-3.5 w-3.5" />
                        Analytics
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-[11px] text-center text-muted-foreground/60">
          This portal link is temporary. Contact your agency for a new link if it expires.
        </p>
      </div>
    </div>
  );
}
