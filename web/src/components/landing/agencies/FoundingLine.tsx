'use client';

import { FOUNDING_OFFER, foundingNote } from '@/features/plans/pricing-spec';
import { useFoundingSpots } from '@/features/plans/queries';

/**
 * The founding offer in one line. Availability comes from `foundingNote`, the same rules as the
 * pricing cards: hidden when the offer is closed or used up, a count only once enough are claimed.
 */
export function FoundingLine({ className = '' }: { className?: string }) {
  const { data: spots } = useFoundingSpots();
  const note = foundingNote(spots);
  if (!note.show) return null;

  return (
    <p data-testid="founding-line" className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${className}`}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
      <span style={{ color: 'var(--lx-text)' }}>
        {FOUNDING_OFFER.percentOff}% off for life with code{' '}
        <span className="lx-mono rounded border px-1.5 py-0.5 text-[12px]" style={{ borderColor: 'var(--lx-line-strong)' }}>
          {FOUNDING_OFFER.code}
        </span>
      </span>
      <span className={note.emphasised ? 'font-medium text-primary' : 'lx-dim'}>· {note.text}</span>
    </p>
  );
}
