'use client';

import type { ReactNode } from 'react';
import { Globe, Monitor, Smartphone, Tablet } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Pinned Devicon release — *-original.svg assets are full-color */
const DEVICON_TAG = 'v2.16.0';
const dv = (relPath: string) =>
  `https://cdn.jsdelivr.net/gh/devicons/devicon@${DEVICON_TAG}/icons/${relPath}`;

/** Simple Icons CDN with explicit brand hex for full-color glyphs (no # prefix) */
const siColor = (slug: string, hex: string) => `https://cdn.simpleicons.org/${slug}/${hex}`;

function browserIconSrc(slug: string): string | null {
  const m: Record<string, string> = {
    googlechrome: dv('chrome/chrome-original.svg'),
    firefox: dv('firefox/firefox-original.svg'),
    safari: dv('safari/safari-original.svg'),
    opera: dv('opera/opera-original.svg'),
    chromium: dv('chrome/chrome-original.svg'),
    internetexplorer: dv('ie10/ie10-original.svg'),
    microsoftedge:
      'https://upload.wikimedia.org/wikipedia/commons/9/98/Microsoft_Edge_logo_%282019%29.svg',
    brave: siColor('brave', 'FB542B'),
    vivaldi: siColor('vivaldi', 'EF3939'),
    duckduckgo: siColor('duckduckgo', 'DE5833'),
    /* Samsung Internet: Samsung wordmark color */
    samsunginternet: siColor('samsung', '1428A0'),
  };
  return m[slug] ?? null;
}

function osIconSrc(slug: string): string | null {
  const m: Record<string, string> = {
    windows: dv('windows11/windows11-original.svg'),
    apple: dv('apple/apple-original.svg'),
    android: dv('android/android-original.svg'),
    linux: dv('linux/linux-original.svg'),
    ubuntu: dv('ubuntu/ubuntu-original.svg'),
    debian: dv('debian/debian-original.svg'),
    fedora: dv('fedora/fedora-original.svg'),
    redhat: dv('redhat/redhat-original.svg'),
    archlinux: dv('archlinux/archlinux-original.svg'),
    googlechrome: dv('chrome/chrome-original.svg'),
    freebsd: siColor('freebsd', 'AB2B28'),
  };
  return m[slug] ?? null;
}

/** Drop trailing semver-style versions from Bowser-style labels (e.g. `Chrome 147.0.0.0` → `Chrome`). */
export function stripClientVersionLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  const without = t.replace(/\s+\d+(?:\.\d+)*$/, '').trim();
  return without || t;
}

function normalizeBrowser(raw: string): { slug: string | null; label: string } {
  const label = stripClientVersionLabel(raw?.trim() || '') || 'Unknown';
  const b = label.toLowerCase();
  if (!b || b === 'unknown') return { slug: null, label: 'Unknown browser' };
  if (b.includes('samsung')) return { slug: 'samsunginternet', label };
  if (b.includes('edge')) return { slug: 'microsoftedge', label };
  if (b.includes('opera')) return { slug: 'opera', label };
  if (b.includes('brave')) return { slug: 'brave', label };
  if (b.includes('vivaldi')) return { slug: 'vivaldi', label };
  if (b.includes('duckduckgo')) return { slug: 'duckduckgo', label };
  if (b.includes('chromium')) return { slug: 'chromium', label };
  if (b.includes('chrome')) return { slug: 'googlechrome', label };
  if (b.includes('firefox') || b.includes('mozilla')) return { slug: 'firefox', label };
  if (b.includes('safari')) return { slug: 'safari', label };
  if (b.includes('ie') || b.includes('internet explorer')) return { slug: 'internetexplorer', label };
  return { slug: null, label };
}

function normalizeOS(raw: string): { slug: string | null; label: string } {
  const label = stripClientVersionLabel(raw?.trim() || '') || 'Unknown';
  const o = label.toLowerCase();
  if (!o || o === 'unknown') return { slug: null, label: 'Unknown OS' };
  if (o.includes('iphone') || o.includes('ipad') || o.includes('ios')) return { slug: 'apple', label };
  if (o.includes('android')) return { slug: 'android', label };
  if (o.includes('windows')) return { slug: 'windows', label };
  if (o.includes('mac') || o.includes('os x') || o.includes('macos') || o === 'darwin') return { slug: 'apple', label };
  if (o.includes('ubuntu')) return { slug: 'ubuntu', label };
  if (o.includes('debian')) return { slug: 'debian', label };
  if (o.includes('fedora')) return { slug: 'fedora', label };
  if (o.includes('red hat') || o.includes('rhel')) return { slug: 'redhat', label };
  if (o.includes('arch')) return { slug: 'archlinux', label };
  if (o.includes('chrome os') || o.includes('chromeos')) return { slug: 'googlechrome', label };
  if (o.includes('linux')) return { slug: 'linux', label };
  if (o.includes('freebsd')) return { slug: 'freebsd', label };
  return { slug: null, label };
}

/** Common English country names → ISO 3166-1 alpha-2 (lowercase) for flagcdn */
const COUNTRY_ISO2: Record<string, string> = {
  'afghanistan': 'af',
  'albania': 'al',
  'argentina': 'ar',
  'australia': 'au',
  'austria': 'at',
  'bangladesh': 'bd',
  'belgium': 'be',
  'brazil': 'br',
  'bulgaria': 'bg',
  'canada': 'ca',
  'chile': 'cl',
  'china': 'cn',
  'colombia': 'co',
  'croatia': 'hr',
  'czech republic': 'cz',
  'czechia': 'cz',
  'denmark': 'dk',
  'egypt': 'eg',
  'estonia': 'ee',
  'finland': 'fi',
  'france': 'fr',
  'germany': 'de',
  'greece': 'gr',
  'hong kong': 'hk',
  'hungary': 'hu',
  'india': 'in',
  'indonesia': 'id',
  'ireland': 'ie',
  'israel': 'il',
  'italy': 'it',
  'japan': 'jp',
  'kenya': 'ke',
  'latvia': 'lv',
  'lithuania': 'lt',
  'malaysia': 'my',
  'mexico': 'mx',
  'netherlands': 'nl',
  'new zealand': 'nz',
  'nigeria': 'ng',
  'norway': 'no',
  'pakistan': 'pk',
  'philippines': 'ph',
  'poland': 'pl',
  'portugal': 'pt',
  'romania': 'ro',
  'russia': 'ru',
  'saudi arabia': 'sa',
  'serbia': 'rs',
  'singapore': 'sg',
  'slovakia': 'sk',
  'slovenia': 'si',
  'south africa': 'za',
  'south korea': 'kr',
  'korea': 'kr',
  'spain': 'es',
  'sweden': 'se',
  'switzerland': 'ch',
  'taiwan': 'tw',
  'thailand': 'th',
  'turkey': 'tr',
  'ukraine': 'ua',
  'united arab emirates': 'ae',
  'uae': 'ae',
  'united kingdom': 'gb',
  'uk': 'gb',
  'great britain': 'gb',
  'england': 'gb',
  'united states': 'us',
  'usa': 'us',
  'us': 'us',
  'vietnam': 'vn',
};

function countryFlagUrl(name: string): string | null {
  const k = name.trim().toLowerCase();
  if (!k || k === 'unknown') return null;
  // Input is already an ISO 3166-1 alpha-2 code (e.g. "BD", "US")
  if (/^[a-z]{2}$/.test(k)) return `https://flagcdn.com/w40/${k}.png`;
  const code = COUNTRY_ISO2[k];
  if (!code) return null;
  return `https://flagcdn.com/w40/${code}.png`;
}

function IconBadge({
  src,
  label,
  childrenFallback,
  imgClassName,
}: {
  src: string | null;
  label: string;
  childrenFallback: ReactNode;
  /** Extra classes on the img (e.g. dark-mode fixes for monochrome marks) */
  imgClassName?: string;
}) {
  return (
    <span title={label} className="inline-flex h-6 w-6 shrink-0 items-center justify-center">
      {src ? (
        <img
          src={src}
          alt=""
          width={24}
          height={24}
          className={cn('h-6 w-6 object-contain rounded-lg-none', imgClassName)}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="flex items-center justify-center text-muted-foreground [&_svg]:size-[18px]">
          {childrenFallback}
        </span>
      )}
    </span>
  );
}

export function SessionCountryVisual({
  country,
  compact,
}: {
  country: string;
  /** Tighter row height for dense tables (e.g. session list). */
  compact?: boolean;
}) {
  const raw = country?.trim() ?? '';
  const hasName = raw.length > 0 && raw.toLowerCase() !== 'unknown';
  const displayName = hasName ? raw : '—';
  const flag = countryFlagUrl(country);
  const title = hasName ? raw : 'Unknown location';

  if (compact) {
    return (
      <div className="flex min-h-[2.25rem] min-w-0 items-center gap-2" title={title}>
        <span title={title} className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
          {flag ? (
            <img
              src={flag}
              alt=""
              width={20}
              height={20}
              className="h-5 w-5 object-contain"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <Globe className="size-4 text-muted-foreground" />
          )}
        </span>
        <span
          className="max-w-[7.5rem] truncate text-xs font-medium text-foreground sm:max-w-[9rem]"
          title={hasName ? raw : undefined}
        >
          {displayName}
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-h-6 min-w-0 items-center gap-3" title={title}>
      <IconBadge src={flag} label={title} childrenFallback={<Globe className="size-[18px]" />} />
      <span className="max-w-[140px] truncate text-sm text-foreground sm:max-w-[180px]" title={hasName ? raw : undefined}>
        {displayName}
      </span>
    </div>
  );
}

function MicroIconBadge({
  src,
  label,
  childrenFallback,
  imgClassName,
}: {
  src: string | null;
  label: string;
  childrenFallback: ReactNode;
  imgClassName?: string;
}) {
  return (
    <span title={label} className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
      {src ? (
        <img
          src={src}
          alt=""
          width={16}
          height={16}
          className={cn('h-4 w-4 object-contain rounded-lg-none', imgClassName)}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="flex items-center justify-center text-muted-foreground [&_svg]:size-3.5">{childrenFallback}</span>
      )}
    </span>
  );
}

/** Single-line browser / OS / device: icon + label for each segment. */
export function SessionClientRowStack({
  browser,
  os,
  device,
}: {
  browser: string;
  os: string;
  device: string;
}) {
  const br = normalizeBrowser(browser);
  const osN = normalizeOS(os);
  const browserSrc = br.slug ? browserIconSrc(br.slug) : null;
  const osSrc = osN.slug ? osIconSrc(osN.slug) : null;

  const d = device.toLowerCase();
  const deviceLabel =
    device?.trim() && device !== 'Unknown'
      ? device.charAt(0).toUpperCase() + device.slice(1).toLowerCase()
      : 'Desktop';
  const deviceIcon =
    d === 'mobile' ? (
      <Smartphone className="size-3.5" />
    ) : d === 'tablet' ? (
      <Tablet className="size-3.5" />
    ) : (
      <Monitor className="size-3.5" />
    );

  const summary = `${br.label} · ${osN.label} · ${deviceLabel}`;

  const sep = (
    <span
      className="mx-0.5 inline-flex h-4 w-px shrink-0 self-center bg-border/60"
      aria-hidden
    />
  );

  return (
    <div className="flex w-full items-center justify-start py-0.5">
      <div
        className="flex min-w-0 max-w-full items-center text-xs leading-none text-foreground/90"
        title={summary}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <MicroIconBadge src={browserSrc} label={br.label} childrenFallback={<Globe className="size-3.5" />} />
          <span className="min-w-0 max-w-[7rem] truncate font-medium sm:max-w-[9rem]">{br.label}</span>
        </div>
        {sep}
        <div className="flex min-w-0 items-center gap-1.5">
          <MicroIconBadge
            src={osSrc}
            label={osN.label}
            imgClassName={osN.slug === 'apple' ? 'dark:invert dark:opacity-95' : undefined}
            childrenFallback={<Globe className="size-3.5" />}
          />
          <span className="min-w-0 max-w-[6.5rem] truncate sm:max-w-[8rem]">{osN.label}</span>
        </div>
        {sep}
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground"
            title={deviceLabel}
          >
            {deviceIcon}
          </span>
          <span className="min-w-0 max-w-[5rem] truncate sm:max-w-[6rem]">{deviceLabel}</span>
        </div>
      </div>
    </div>
  );
}

export function SessionClientVisuals({
  browser,
  os,
  device,
}: {
  browser: string;
  os: string;
  device: string;
}) {
  const br = normalizeBrowser(browser);
  const osN = normalizeOS(os);
  const browserSrc = br.slug ? browserIconSrc(br.slug) : null;
  const osSrc = osN.slug ? osIconSrc(osN.slug) : null;

  const d = device.toLowerCase();
  const deviceLabel =
    device?.trim() && device !== 'Unknown'
      ? device.charAt(0).toUpperCase() + device.slice(1).toLowerCase()
      : 'Desktop';
  const deviceIcon =
    d === 'mobile' ? (
      <Smartphone className="size-[18px]" />
    ) : d === 'tablet' ? (
      <Tablet className="size-[18px]" />
    ) : (
      <Monitor className="size-[18px]" />
    );

  return (
    <div className="flex items-center gap-5 pl-0.5" title={`${br.label} · ${osN.label} · ${deviceLabel}`}>
      <IconBadge src={browserSrc} label={br.label} childrenFallback={<Globe className="size-[18px]" />} />
      <IconBadge
        src={osSrc}
        label={osN.label}
        imgClassName={osN.slug === 'apple' ? 'dark:invert dark:opacity-95' : undefined}
        childrenFallback={<Globe className="size-[18px]" />}
      />
      <span title={deviceLabel} className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground">
        {deviceIcon}
      </span>
    </div>
  );
}
