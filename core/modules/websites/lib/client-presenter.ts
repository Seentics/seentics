import type { Website } from "../interfaces";
import type { ClientWithWebsites } from "../interfaces/client.interface";

/**
 * Clients and their sites on the wire: snake_case, ISO timestamps, and each site with the
 * snippet that installs it — a caller provisioning a tenant needs that and nothing else.
 */

export function trackingSnippet(scriptUrl: string, websiteId: string): string {
  return `<script defer data-website-id="${websiteId}" src="${scriptUrl}"></script>`;
}

export type ClientWebsiteResponse = {
  id: string;
  client_id: string | null;
  name: string;
  url: string;
  tracking_id: string;
  is_active: boolean;
  script_url: string;
  snippet: string;
  created_at: string;
};

export function presentClientWebsite(site: Website, scriptUrl: string): ClientWebsiteResponse {
  return {
    id: site.id,
    client_id: site.clientId,
    name: site.name,
    url: site.url,
    tracking_id: site.trackingId,
    is_active: site.isActive,
    script_url: scriptUrl,
    snippet: trackingSnippet(scriptUrl, site.id),
    created_at: site.createdAt.toISOString(),
  };
}

export function presentClient(client: ClientWithWebsites, scriptUrl: string) {
  return {
    id: client.id,
    external_id: client.externalId,
    name: client.name,
    company: client.company,
    email: client.email,
    website_url: client.websiteUrl,
    note: client.note,
    status: client.status,
    features_enabled: client.featuresEnabled,
    limits: client.limits,
    metadata: client.metadata,
    websites: client.websites.map((s) => presentClientWebsite(s, scriptUrl)),
    created_at: client.createdAt.toISOString(),
    updated_at: client.updatedAt.toISOString(),
  };
}
