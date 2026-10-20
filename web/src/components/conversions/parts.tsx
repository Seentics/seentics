'use client';

/** Small pieces the Conversions page shares. */
import { useId } from 'react';
import type { ConversionStatus, MatchKey } from '@/features/conversions/types';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { PLATFORMS, STATUS_META } from './conversion-format';

/**
 * A platform's own logo, on the tile its brand puts it on: Meta's and Google Analytics' marks on
 * white, TikTok's note on black, LinkedIn's "in" square as it is. Drawn from each brand's
 * published artwork, so it reads as the platform at a glance in either theme.
 */
export function PlatformMark({ platform, className }: { platform: keyof typeof PLATFORMS; className?: string }) {
  const id = useId().replace(/:/g, '');
  const tile = 'flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg';
  if (platform === 'linkedin') {
    return (
      <span aria-hidden className={cn(tile, 'bg-[#0A66C2]', className)}>
        <svg viewBox="0 0 72 72" className="h-full w-full">
          <path fill="#FFF" d="M62 62H51.32V43.8c0-4.99-1.9-7.78-5.85-7.78-4.3 0-6.54 2.9-6.54 7.78V62H28.63V27.33h10.3v4.67s3.1-5.73 10.45-5.73C56.74 26.27 62 30.76 62 40.05V62ZM16.35 22.79A6.37 6.37 0 0 1 10 16.4a6.37 6.37 0 0 1 6.35-6.4 6.37 6.37 0 0 1 6.35 6.4 6.37 6.37 0 0 1-6.35 6.4ZM11.03 62H21.77V27.33H11.03V62Z" />
        </svg>
      </span>
    );
  }
  if (platform === 'tiktok') {
    const note = 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z';
    return (
      <span aria-hidden className={cn(tile, 'bg-black ring-1 ring-inset ring-white/10', className)}>
        <svg viewBox="-1 -1 26 26" className="h-[62%] w-[62%]">
          <path d={note} fill="#25F4EE" transform="translate(-0.7 -0.6)" />
          <path d={note} fill="#FE2C55" transform="translate(0.7 0.6)" />
          <path d={note} fill="#FFF" />
        </svg>
      </span>
    );
  }
  return (
    <span aria-hidden className={cn(tile, 'border border-black/[0.08] bg-white dark:border-transparent', className)}>
      {platform === 'meta' ? (
        <svg viewBox="0 0 287.56 191" className="w-[70%]">
          <defs>
            <linearGradient id={`${id}a`} x1="61" y1="117" x2="259" y2="127" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0064e1" offset="0" />
              <stop stopColor="#0064e1" offset="0.4" />
              <stop stopColor="#0073ee" offset="0.83" />
              <stop stopColor="#0082fb" offset="1" />
            </linearGradient>
            <linearGradient id={`${id}b`} x1="45" y1="139" x2="45" y2="66" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0082fb" offset="0" />
              <stop stopColor="#0064e0" offset="1" />
            </linearGradient>
          </defs>
          <path fill="#0081fb" d="m31.06,125.96c0,10.98 2.41,19.41 5.56,24.51 4.13,6.68 10.29,9.51 16.57,9.51 8.1,0 15.51-2.01 29.79-21.76 11.44-15.83 24.92-38.05 33.99-51.98l15.36-23.6c10.67-16.39 23.02-34.61 37.18-46.96 11.56-10.08 24.03-15.68 36.58-15.68 21.07,0 41.14,12.21 56.5,35.11 16.81,25.08 24.97,56.67 24.97,89.27 0,19.38-3.82,33.62-10.32,44.87-6.28,10.88-18.52,21.75-39.11,21.75l0-31.02c17.63,0 22.03-16.2 22.03-34.74 0-26.42-6.16-55.74-19.73-76.69-9.63-14.86-22.11-23.94-35.84-23.94-14.85,0-26.8,11.2-40.23,31.17-7.14,10.61-14.47,23.54-22.7,38.13l-9.06,16.05c-18.2,32.27-22.81,39.62-31.91,51.75-15.95,21.24-29.57,29.29-47.5,29.29-21.27,0-34.72-9.21-43.05-23.09-6.8-11.31-10.14-26.15-10.14-43.06z" />
          <path fill={`url(#${id}a)`} d="m24.49,37.3c14.24-21.95 34.79-37.3 58.36-37.3 13.65,0 27.22,4.04 41.39,15.61 15.5,12.65 32.02,33.48 52.63,67.81l7.39,12.32c17.84,29.72 27.99,45.01 33.93,52.22 7.64,9.26 12.99,12.02 19.94,12.02 17.63,0 22.03-16.2 22.03-34.74l27.4-.86c0,19.38-3.82,33.62-10.32,44.87-6.28,10.88-18.52,21.75-39.11,21.75-12.8,0-24.14-2.78-36.68-14.61-9.64-9.08-20.91-25.21-29.58-39.71l-25.79-43.08c-12.94-21.62-24.81-37.74-31.68-45.04-7.39-7.85-16.89-17.33-32.05-17.33-12.27,0-22.69,8.61-31.41,21.78z" />
          <path fill={`url(#${id}b)`} d="m82.35,31.23c-12.27,0-22.69,8.61-31.41,21.78-12.33,18.61-19.88,46.33-19.88,72.95 0,10.98 2.41,19.41 5.56,24.51l-26.48,17.44c-6.8-11.31-10.14-26.15-10.14-43.06 0-30.75 8.44-62.8 24.49-87.55 14.24-21.95 34.79-37.3 58.36-37.3z" />
        </svg>
      ) : (
        <svg viewBox="0 0 192 192" className="w-[62%]">
          <path fill="#F9AB00" d="M130 29v132c0 14.77 10.19 23 21 23 10 0 21-7 21-23V30c0-13.54-10-22-21-22s-21 9.33-21 21z" />
          <path fill="#E37400" d="M75 96v65c0 14.77 10.19 23 21 23 10 0 21-7 21-23V97c0-13.54-10-22-21-22s-21 9.33-21 21z" />
          <circle fill="#E37400" cx="41" cy="163" r="21" />
        </svg>
      )}
    </span>
  );
}

export function StatusLabel({ status, className }: { status: ConversionStatus; className?: string }) {
  const meta = STATUS_META[status];
  const t = useT().conversions;
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]', className)}>
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} aria-hidden />
      {t.statuses[status]}
    </span>
  );
}

/** The keys a conversion was matched with, as quiet chips. */
export function MatchChips({ keys }: { keys: readonly MatchKey[] }) {
  const t = useT().conversions;
  if (keys.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex gap-1">
      {keys.map((k) => (
        <span key={k} className="whitespace-nowrap rounded border border-border px-1.5 py-px text-[11px] text-foreground/75">
          {t.match[k]}
        </span>
      ))}
    </span>
  );
}
