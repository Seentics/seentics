import Image from 'next/image';

// Map slug keywords → downloaded images in /public/blog/
const tagImageMap: Record<string, string> = {
  'heatmaps':        '/blog/heatmaps.jpg',
  'session-replay':  '/blog/session-replay.jpg',
  'session_replay':  '/blog/session-replay.jpg',
  'privacy':         '/blog/privacy-analytics.jpg',
  'gdpr':            '/blog/privacy-analytics.jpg',
  'conversion':      '/blog/conversion-optimization.jpg',
  'funnels':         '/blog/conversion-optimization.jpg',
  'agency':          '/blog/analytics-agencies.jpg',
  'automations':     '/blog/behavioral-automations.jpg',
  'guide':           '/blog/web-analytics.jpg',
  'analytics':       '/blog/web-analytics.jpg',
  'migration':       '/blog/google-analytics-alt.jpg',
  'google analytics':'/blog/google-analytics-alt.jpg',
};

const slugImageMap: Record<string, string> = {
  'what-is-web-analytics':                      '/blog/web-analytics.jpg',
  'session-replay-guide':                       '/blog/session-replay.jpg',
  'heatmaps-explained':                         '/blog/heatmaps.jpg',
  'why-switch-from-google-analytics':           '/blog/google-analytics-alt.jpg',
  'conversion-rate-optimization-with-analytics':'/blog/conversion-optimization.jpg',
  'privacy-first-analytics':                    '/blog/privacy-analytics.jpg',
  'behavioral-automations-guide':               '/blog/behavioral-automations.jpg',
  'analytics-for-agencies':                     '/blog/analytics-agencies.jpg',
};

export function resolveImage(slug?: string, tags?: string[], coverImage?: string): string {
  if (coverImage) return coverImage;
  if (slug && slugImageMap[slug]) return slugImageMap[slug];
  if (tags) {
    for (const tag of tags) {
      const key = tag.toLowerCase();
      if (tagImageMap[key]) return tagImageMap[key];
    }
  }
  return '/blog/web-analytics.jpg';
}

export default function BlogCover({
  slug,
  tags = [],
  coverImage,
  title,
  className = '',
  priority = false,
}: {
  slug?: string;
  tags?: string[];
  coverImage?: string;
  title: string;
  className?: string;
  priority?: boolean;
}) {
  const src = resolveImage(slug, tags, coverImage);

  return (
    <div className={`relative overflow-hidden bg-muted ${className}`}>
      <Image
        src={src}
        alt={title}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px"
        priority={priority}
      />
      {/* Subtle dark overlay so text stays readable on top if needed */}
      <div className="absolute inset-0 bg-black/10" />
    </div>
  );
}
