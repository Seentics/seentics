'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useApiCatalogue } from '@/features/api-keys/queries';
import { MANAGEMENT_API } from '@/features/agency/management-api-spec';
import { EndpointReference, type EndpointDoc } from '@/components/developers/EndpointReference';

/** `/v1/websites/:website_id/analytics/top-pages` → "Top pages"; `/heatmap/points` → "Heatmap points". */
function titleFromPath(path: string): string {
  const rest = path.replace('/v1/websites/:website_id/', '').replace(/^analytics\//, '').replace(/[/-]/g, ' ')
    .replace(/\b(os|utm)\b/g, w => w.toUpperCase());
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/** The page's own origin, read after mount: the server render has none. */
function useOrigin() {
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  return origin;
}

export function ManagementApiTab() {
  const origin = useOrigin();
  return (
    <EndpointReference
      docs={MANAGEMENT_API}
      baseUrl={`${origin}/api/v1/manage`}
      intro={<>Send an <strong>account key</strong> as <code className="font-mono text-xs">X-API-Key</code>.</>}
    />
  );
}

/**
 * The Analytics API is described by the server's own catalogue — paths, parameters,
 * scopes and a real example response each — so this cannot document a route that no
 * longer exists.
 */
export function AnalyticsApiTab() {
  const origin = useOrigin();
  const { data: catalogue, isLoading, isError } = useApiCatalogue();

  const docs = useMemo<EndpointDoc[]>(
    () =>
      (catalogue?.data ?? []).map(e => ({
        method: e.method,
        path: e.path,
        group: e.group,
        title: titleFromPath(e.path),
        description: e.summary,
        access: e.scope,
        query: e.params.map(p => ({
          name: p.name,
          type: 'string',
          required: p.description.includes('Required'),
          description: p.description.replace(/\s*Required\.?$/, ''),
          default: p.default,
        })),
        status: 200,
        exampleResponse: e.example,
      })),
    [catalogue],
  );

  if (isLoading) {
    return (
      <div className="surface flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (isError || !catalogue) {
    return (
      <div className="surface flex items-center gap-3 p-5 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
        Couldn&apos;t load the Analytics API reference — the API did not answer. Refresh to try again.
      </div>
    );
  }

  return (
    <EndpointReference
      docs={docs}
      baseUrl={`${origin}${catalogue.meta.base_path}`}
      intro={<>Send an <strong>account key</strong> with the data scopes as <code className="font-mono text-xs">X-API-Key</code>.</>}
    />
  );
}
