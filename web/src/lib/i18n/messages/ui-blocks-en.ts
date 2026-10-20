/** UiBlocks in English. `ui-blocks-bn.ts` mirrors it. */
export const uiBlocksEn = {
  page: {
    title: 'UI Blocks',
    description: 'Copy-paste embeddable analytics widgets, badges, and charts for your product.',
    fullDocs: 'Full docs',
    searchPlaceholder: 'Search blocks...',
    noMatch: 'No blocks match your search.',
    comingSoon: 'Coming soon',
    showCode: 'Show Code',
    hideCode: 'Hide Code',
    copy: 'Copy',
    copied: 'Copied to clipboard',
    copyFailed: 'Could not copy',
    copyFailedBody: 'Use Show Code and copy it from there.',
    notAvailable: 'Not available yet — the embed script these widgets need is not published. For a live view today, use the Full Dashboard Embed.',
  },
  categories: {
    all: 'all',
    badge: 'badge',
    chart: 'chart',
    widget: 'widget',
    embed: 'embed',
  },
  blocks: {
    'live-visitors-badge': { name: 'Live Visitors Badge', description: 'Real-time active visitor count with animated pulse indicator.' },
    'pageviews-badge': { name: 'Page Views Badge', description: 'Today’s page view count — great for landing pages or marketing sites.' },
    sparkline: { name: 'Traffic Sparkline', description: 'Compact 7-day traffic trend line — inline, lightweight, and responsive.' },
    'stats-widget': { name: 'Stats Widget', description: '3-column summary strip: visitors, pageviews, and events.' },
    'top-pages-widget': { name: 'Top Pages Widget', description: 'Ranked list of your most viewed pages with a relative bar chart.' },
    'country-widget': { name: 'Country Breakdown', description: 'Top countries by visitor share with flag icons and progress bars.' },
    'full-embed': { name: 'Full Dashboard Embed', description: 'Embed the complete Seentics analytics dashboard inside any iframe.' },
    'react-component': { name: 'React Components', description: 'Render your data in your own React app with @seentics/ui (used from source until it is on npm).' },
  },
  setup: {
    createEmbed: 'Create embed link',
    readGuide: 'Read the guide',
  },
  preview: {
    live: (n: string) => `${n} live`,
    viewsToday: (v: string) => `${v} views today`,
    visitors: 'Visitors',
    pageviews: 'Pageviews',
    events: 'Events',
    topPages: 'Top Pages',
    topCountries: 'Top Countries',
    iframeEmbed: 'iframe embed',
    countries: {
      us: 'United States',
      gb: 'United Kingdom',
      de: 'Germany',
      fr: 'France',
    },
  },
  codeBlock: {
    copied: 'Copied to clipboard',
    copy: 'Copy code',
  },
};

export type UiBlocksMessages = typeof uiBlocksEn;
