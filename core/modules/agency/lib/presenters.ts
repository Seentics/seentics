/** The agency module on the wire: snake_case, ISO timestamps. */

import type { BrandView, ClientUser, IssuedPortalLink, PortalSession, WhiteLabelSettings } from "../interfaces";
import type { EmbedSection } from "../../api-keys/interfaces";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function presentWhiteLabel(s: WhiteLabelSettings) {
  return {
    user_id: s.ownerId,
    brand_name: s.brandName,
    logo_url: s.logoUrl,
    primary_color: s.primaryColor,
    support_email: s.supportEmail,
    footer_text: s.footerText,
    hide_seentics: s.hideSeentics,
    updated_at: iso(s.updatedAt),
  };
}

/** What a client may see of the agency's settings: no owner id. */
export function presentBrand(s: WhiteLabelSettings): BrandView {
  return {
    brand_name: s.brandName,
    logo_url: s.logoUrl,
    primary_color: s.primaryColor,
    support_email: s.supportEmail,
    footer_text: s.footerText,
    hide_seentics: s.hideSeentics,
  };
}

export function presentClientUser(u: ClientUser) {
  return {
    id: u.id,
    client_id: u.clientId,
    email: u.email,
    name: u.name,
    status: u.status,
    created_at: u.createdAt.toISOString(),
    updated_at: u.updatedAt.toISOString(),
    last_seen_at: iso(u.lastSeenAt),
    link_expires_at: iso(u.linkExpiresAt),
  };
}

export function portalUrl(frontendUrl: string, token: string): string {
  return `${frontendUrl}/client-portal/${token}`;
}

/** A link just made — the one response that carries its token. */
export function presentIssuedLink(link: IssuedPortalLink, frontendUrl: string) {
  return {
    id: link.record.id,
    client_id: link.record.clientId,
    token: link.token,
    portal_url: portalUrl(frontendUrl, link.token),
    expires_at: link.record.expiresAt.toISOString(),
    created_at: link.record.createdAt.toISOString(),
  };
}

/**
 * The portal page's data. `embed_url` is the existing client embed page, which reads the
 * websites below with this same token as its `X-Embed-Token`.
 */
export function presentPortalSession(s: PortalSession, token: string, frontendUrl: string) {
  return {
    client: {
      id: s.client.id,
      name: s.client.name,
      company: s.client.company,
      status: s.client.status,
      features_enabled: s.client.featuresEnabled,
    },
    websites: s.websites,
    sections: s.claim.sections satisfies EmbedSection[],
    brand: s.brand,
    client_user: s.clientUser,
    expires_at: s.claim.expiresAt.toISOString(),
    embed_url: `${frontendUrl}/embed/${s.client.id}?token=${token}&client=1`,
  };
}
