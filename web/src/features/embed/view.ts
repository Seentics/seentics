import type { EmbedSection } from '@/features/agency/types';

/** Where the embed is, inside the one iframe: a section, and within it a list or one item. */
export type View =
  | { section: 'analytics' }
  | { section: 'recordings'; sessionId?: string }
  | { section: 'heatmaps'; slug?: string };

/** The in-app links the shared pages push, turned into a view change inside the iframe. */
export function viewFromHref(href: string): View | null {
  const path = href.split('?')[0]!;
  const replay = /^\/websites\/[^/]+\/replays(?:\/([^/]+))?$/.exec(path);
  if (replay) return { section: 'recordings', sessionId: replay[1] };
  const heatmap = /^\/websites\/[^/]+\/heatmaps(?:\/([^/]+))?$/.exec(path);
  if (heatmap) return { section: 'heatmaps', slug: heatmap[1] };
  return null;
}

export const EMBED_TAB_ORDER: EmbedSection[] = ['analytics', 'recordings', 'heatmaps'];

/** The tabs a link allows, in display order. A single section shows no tab strip. */
export function allowedTabs(sections: EmbedSection[]): EmbedSection[] {
  return EMBED_TAB_ORDER.filter(id => sections.includes(id));
}

/** The section on screen: the current one if the link allows it, else the first allowed. */
export function resolveActiveSection(current: EmbedSection, sections: EmbedSection[]): EmbedSection {
  return sections.includes(current) ? current : (allowedTabs(sections)[0] ?? 'analytics');
}

export const showTabStrip = (sections: EmbedSection[]) => allowedTabs(sections).length > 1;
