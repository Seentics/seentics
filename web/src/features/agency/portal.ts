import { getApiUrl } from '@/lib/config';
import type { EmbedSection, PortalBrand, PortalSession } from './types';

/** Every refusal of a portal link — unknown, expired, revoked, suspended — is this one 401. */
export class PortalTokenError extends Error {}

type WirePortalSession = {
  client: { id: string; name: string; company: string; status: string; features_enabled: Record<string, boolean> };
  websites: { id: string; name: string; url: string }[];
  sections: EmbedSection[];
  brand: {
    brand_name: string;
    logo_url: string;
    primary_color: string;
    support_email: string;
    footer_text: string;
    hide_seentics: boolean;
  };
  client_user: { name: string; email: string } | null;
  expires_at: string;
  embed_url: string;
};

function mapBrand(b: WirePortalSession['brand']): PortalBrand {
  return {
    brandName: b.brand_name, logoUrl: b.logo_url, primaryColor: b.primary_color,
    supportEmail: b.support_email, footerText: b.footer_text, hideSeentics: b.hide_seentics,
  };
}

/**
 * `POST /agency/portal/validate`. Plain `fetch` at the gateway's absolute URL, not the dashboard's
 * api client: the portal has no session (that client redirects a 401 to sign-in), and on an agency's
 * own domain there is no same-origin `/api` to call.
 */
export async function validatePortalToken(token: string): Promise<PortalSession> {
  const res = await fetch(getApiUrl('/agency/portal/validate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (res.status === 401 || res.status === 400) throw new PortalTokenError('This link is invalid or has expired.');
  if (!res.ok) throw new Error(`The portal could not load (${res.status}).`);
  const d = ((await res.json()) as { data: WirePortalSession }).data;
  return {
    client: { id: d.client.id, name: d.client.name, company: d.client.company, status: d.client.status, featuresEnabled: d.client.features_enabled },
    websites: d.websites,
    sections: d.sections,
    brand: mapBrand(d.brand),
    clientUser: d.client_user,
    expiresAt: d.expires_at,
    embedUrl: d.embed_url,
  };
}

/** `#rrggbb` as the `h s% l%` triple the theme's `--primary` takes; `null` for anything else. */
export function hexToHslTriple(hex: string): string | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
