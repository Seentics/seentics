import type { UseCase } from '@/lib/use-cases';

/**
 * Each use case has its own hue so the entries can be told apart, kept quiet on purpose: a
 * faint tinted tile with a coloured glyph, not a solid block. Fourteen saturated squares in
 * a tight list were hard on the eyes.
 *
 * The class names are written out in full here, not built from a hue, because Tailwind
 * only generates classes it can see in the files it scans (`src/lib` is not one of them).
 */
const TINT: Record<string, string> = {
  'capture-leads': 'bg-violet-500/10 text-violet-600 dark:bg-violet-400/10 dark:text-violet-400',
  'recover-leaving-visitors': 'bg-orange-500/10 text-orange-600 dark:bg-orange-400/10 dark:text-orange-400',
  'get-more-bookings': 'bg-sky-500/10 text-sky-600 dark:bg-sky-400/10 dark:text-sky-400',
  'increase-online-sales': 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400',
  'promote-offers': 'bg-pink-500/10 text-pink-600 dark:bg-pink-400/10 dark:text-pink-400',
  'understand-your-traffic': 'bg-blue-500/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400',
  'find-why-visitors-dont-convert': 'bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400',
  'improve-landing-pages': 'bg-red-500/10 text-red-600 dark:bg-red-400/10 dark:text-red-400',
  'debug-with-session-recordings': 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-400',
  'catch-bugs-and-broken-forms': 'bg-fuchsia-500/10 text-fuchsia-600 dark:bg-fuchsia-400/10 dark:text-fuchsia-400',
  'measure-campaign-roi': 'bg-teal-500/10 text-teal-600 dark:bg-teal-400/10 dark:text-teal-400',
  'report-to-clients': 'bg-cyan-500/10 text-cyan-600 dark:bg-cyan-400/10 dark:text-cyan-400',
  'convert-free-users': 'bg-yellow-500/10 text-yellow-600 dark:bg-yellow-400/10 dark:text-yellow-400',
  'grow-subscriptions-and-donations': 'bg-rose-500/10 text-rose-600 dark:bg-rose-400/10 dark:text-rose-400',
};

const SIZES = {
  xs: { box: 'h-6 w-6 rounded-md', icon: 'h-3.5 w-3.5' },
  sm: { box: 'h-9 w-9 rounded-lg', icon: 'h-[18px] w-[18px]' },
  md: { box: 'h-11 w-11 rounded-xl', icon: 'h-5 w-5' },
} as const;

export function UseCaseIcon({
  useCase,
  size = 'sm',
  className = '',
}: {
  useCase: Pick<UseCase, 'slug' | 'icon'>;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  const tint = TINT[useCase.slug] ?? 'bg-primary/10 text-primary';
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center ${tint} ${s.box} ${className}`}
    >
      <useCase.icon className={s.icon} strokeWidth={1.9} />
    </span>
  );
}
