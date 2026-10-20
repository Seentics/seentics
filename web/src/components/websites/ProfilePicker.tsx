'use client';

import { Contact, LayoutGrid, ShoppingBag, Store } from 'lucide-react';
import { WEBSITE_PROFILES, type WebsiteProfile } from '@/features/websites/types';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const ICONS: Record<WebsiteProfile, React.ElementType> = {
  fcommerce: ShoppingBag,
  store: Store,
  leads: Contact,
  other: LayoutGrid,
};

/**
 * "What is this website for?": four cards, one choice. Used when adding a website and in its
 * settings; the choice orders the sidebar (features/sidebar/profiles.ts).
 */
export function ProfilePicker({ value, onChange, disabled, name = 'website-profile' }: {
  value: WebsiteProfile | null;
  onChange: (profile: WebsiteProfile) => void;
  disabled?: boolean;
  /** The radio group's name; distinct per form on one page. */
  name?: string;
}) {
  const t = useT().dashboard.profiles;
  return (
    <div role="radiogroup" aria-label={t.question} className="grid gap-2 sm:grid-cols-2">
      {WEBSITE_PROFILES.map((p) => {
        const Icon = ICONS[p];
        const on = value === p;
        return (
          <label
            key={p}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
              on ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border hover:bg-muted/50',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <input
              type="radio"
              name={name}
              value={p}
              checked={on}
              disabled={disabled}
              onChange={() => onChange(p)}
              className="sr-only"
            />
            <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', on ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground/70')}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{t.options[p].label}</span>
              <span className="block text-xs leading-snug text-muted-foreground">{t.options[p].hint}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
