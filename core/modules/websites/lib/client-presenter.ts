import { trackingSnippet, type Website } from "../interfaces";

/**
 * A site on the wire with the snippet that installs it — what a caller provisioning a
 * tenant's site needs and nothing else.
 */

export { trackingSnippet };

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
