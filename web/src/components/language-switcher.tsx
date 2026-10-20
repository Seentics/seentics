'use client';

import { Languages } from 'lucide-react';
import { useLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * English / বাংলা. One button naming the other language, so it reads to someone who does not
 * read the current one. The choice is a cookie the sign-in pages share (lib/i18n/locale.ts).
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const t = useT();
  const next = locale === 'bn' ? 'en' : 'bn';
  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      aria-label={`${t.language.label}: ${t.language[next]}`}
      lang={next}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium text-foreground/70 transition-colors hover:bg-accent hover:text-foreground',
        className,
      )}
    >
      <Languages className="h-3.5 w-3.5" />
      {t.language[next]}
    </button>
  );
}
