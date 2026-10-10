'use client';

import { useState, type ReactNode } from 'react';
import { Globe, Monitor, Smartphone, Tablet } from 'lucide-react';
import { getBrowserImagePath, getOsImagePath } from '@/lib/analytics-icons';
import { getCountryFlag } from '@/utils/countries';
import { cn } from '@/lib/utils';

/** Drop trailing semver-style versions from Bowser-style labels (e.g. `Chrome 147.0.0.0` → `Chrome`). */
export function stripClientVersionLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  const without = t.replace(/\s+\d+(?:\.\d+)*$/, '').trim();
  return without || t;
}

/**
 * An icon from `/public/images`, with a glyph in its place if the file is missing.
 *
 * These came from three external CDNs (flagcdn, jsDelivr, Wikimedia) while the rest of the
 * dashboard serves the same images locally. A blocked or slow CDN left blank gaps in the
 * table, and every row sent a third party a request carrying the visitor's country.
 */
function LocalIcon({
  src,
  label,
  fallback,
  className,
}: {
  src: string | null;
  label: string;
  fallback: ReactNode;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span title={label} className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
      {src && !failed ? (
        <img
          src={src}
          alt=""
          width={16}
          height={16}
          className={cn('h-4 w-4 object-contain', className)}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="flex items-center justify-center text-muted-foreground [&_svg]:size-3.5">{fallback}</span>
      )}
    </span>
  );
}

function knownLabel(raw: string | undefined, unknown: string): { known: boolean; label: string } {
  const label = stripClientVersionLabel(raw?.trim() || '');
  if (!label || label.toLowerCase() === 'unknown') return { known: false, label: unknown };
  return { known: true, label };
}

export function SessionCountryVisual({ country }: { country: string }) {
  const { known, label } = knownLabel(country, 'Unknown');

  return (
    <div className="flex min-w-0 items-center gap-2" title={known ? label : 'Unknown location'}>
      <LocalIcon
        src={known ? getCountryFlag(label) : null}
        label={label}
        fallback={<Globe />}
        className="rounded-[2px]"
      />
      <span className={cn('max-w-[9rem] truncate text-sm', known ? 'font-medium text-foreground' : 'text-muted-foreground')}>
        {known ? label : '—'}
      </span>
    </div>
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
  const br = knownLabel(browser, 'Unknown browser');
  const osN = knownLabel(os, 'Unknown OS');

  const d = device?.trim().toLowerCase() ?? '';
  const deviceLabel = d && d !== 'unknown' ? d.charAt(0).toUpperCase() + d.slice(1) : 'Desktop';
  const deviceIcon =
    d === 'mobile' ? <Smartphone /> : d === 'tablet' ? <Tablet /> : <Monitor />;

  const dot = <span className="text-muted-foreground/40" aria-hidden>·</span>;

  return (
    <div
      className="flex min-w-0 items-center gap-2 text-[13px] text-foreground/90"
      title={`${br.label} · ${osN.label} · ${deviceLabel}`}
    >
      <LocalIcon src={br.known ? getBrowserImagePath(br.label) : null} label={br.label} fallback={<Globe />} />
      <span className="max-w-[7rem] truncate font-medium">{br.label}</span>
      {dot}
      <LocalIcon
        src={osN.known ? getOsImagePath(osN.label) : null}
        label={osN.label}
        fallback={<Globe />}
      />
      <span className="max-w-[6.5rem] truncate">{osN.label}</span>
      {dot}
      <LocalIcon src={null} label={deviceLabel} fallback={deviceIcon} />
      <span className="truncate text-muted-foreground">{deviceLabel}</span>
    </div>
  );
}
