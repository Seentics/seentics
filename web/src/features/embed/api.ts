import { getApiUrl } from '@/lib/config';
import type { EmbedSection } from '@/features/agency/types';

export class EmbedTokenError extends Error {}

/**
 * The demo links carry a token starting "demo", which means sample data rather than a real read.
 * `demo` shows every section; `demo-analytics` only analytics, as a client-wide sample does.
 */
export const isSampleToken = (token: string) => token.startsWith('demo');
const sampleSections = (token: string): EmbedSection[] =>
  token === 'demo' ? ['analytics', 'recordings', 'heatmaps'] : ['analytics'];

export type EmbedInfo = { website: { name: string; url: string }; sections: EmbedSection[] };

/**
 * Plain `fetch`, not the dashboard's api client: an embed has no session, and that
 * client answers a 401 by redirecting to sign-in — inside someone else's iframe.
 * (The analytics themselves go through the api client, which sends the embed token.)
 */
export async function fetchEmbedInfo(websiteId: string, token: string): Promise<EmbedInfo> {
  if (isSampleToken(token)) {
    return { website: { name: 'Seentics Production', url: 'seentics.com' }, sections: sampleSections(token) };
  }
  const res = await fetch(getApiUrl(`/embed/${websiteId}/info`), { headers: { 'X-Embed-Token': token } });
  if (res.status === 401) throw new EmbedTokenError('This embed link is no longer valid.');
  if (!res.ok) throw new Error(`The embed could not load (${res.status}).`);
  return ((await res.json()) as { data: EmbedInfo }).data;
}

export type EmbedClientSites = {
  client: { name: string };
  websites: { id: string; name: string; url: string }[];
  sections: EmbedSection[];
};

/** The websites a client-wide link covers, for its switcher. */
export async function fetchEmbedClientSites(clientId: string, token: string): Promise<EmbedClientSites> {
  if (isSampleToken(token)) {
    return {
      client: { name: 'Northwind Coffee' },
      websites: [
        { id: 'demo-a', name: 'shop.northwind.coffee', url: 'shop.northwind.coffee' },
        { id: 'demo-b', name: 'blog.northwind.coffee', url: 'blog.northwind.coffee' },
      ],
      sections: sampleSections(token),
    };
  }
  const res = await fetch(getApiUrl(`/embed/client/${clientId}/websites`), { headers: { 'X-Embed-Token': token } });
  if (res.status === 401) throw new EmbedTokenError('This embed link is no longer valid.');
  if (!res.ok) throw new Error(`The embed could not load (${res.status}).`);
  return ((await res.json()) as { data: EmbedClientSites }).data;
}
