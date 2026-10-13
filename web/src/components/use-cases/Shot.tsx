import { BrowserFrame } from './BrowserFrame';

export type Annotation = { x: number; y: number; label: string };

/**
 * A real screenshot of the Seentics dashboard running on its demo data, in the visitor's
 * current theme (the site's `dark` class picks which file shows). Numbered markers point at
 * the parts the caption explains; their positions are percentages of the image, so they stay
 * put at any width.
 *
 * Both files are lazy except where `priority` is set: a hidden `loading="lazy"` image is
 * never fetched, so only the visible theme's file downloads.
 */
export function Shot({
  name, alt, url, annotations = [], priority = false, className = '', crop,
}: {
  name: string;
  alt: string;
  url?: string;
  annotations?: Annotation[];
  priority?: boolean;
  className?: string;
  /** Show only the top `crop` pixels of the 900px-tall image, where the rest is empty. */
  crop?: number;
}) {
  const visible = crop && crop < 900 ? crop : 900;
  const img = (theme: 'light' | 'dark') => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/use-cases/${name}-${theme}.webp`}
      alt={theme === 'light' ? alt : ''}
      aria-hidden={theme === 'dark' ? true : undefined}
      width={1440}
      height={900}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={`h-auto w-full ${theme === 'light' ? 'block dark:hidden' : 'hidden dark:block'}`}
    />
  );
  return (
    <figure className={className}>
      <BrowserFrame url={url}>
        <div className="relative overflow-hidden" style={{ aspectRatio: `1440 / ${visible}` }}>
          {img('light')}
          {img('dark')}
          {annotations.map((a, i) => (
            <span
              key={a.label}
              className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-primary-foreground shadow-lg ring-4 ring-primary/25"
              style={{ left: `${a.x}%`, top: `${(a.y * 900) / visible}%` }}
              aria-hidden
            >
              {i + 1}
            </span>
          ))}
        </div>
      </BrowserFrame>
      {annotations.length > 0 && (
        <figcaption className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {annotations.map((a, i) => (
            <p key={a.label} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">{i + 1}</span>
              {a.label}
            </p>
          ))}
        </figcaption>
      )}
    </figure>
  );
}
