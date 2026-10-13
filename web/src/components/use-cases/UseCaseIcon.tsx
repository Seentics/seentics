import type { UseCase } from '@/lib/use-cases';

/**
 * Each use case has its own colour, so the menu reads as fourteen distinct things instead
 * of one block of identical tinted squares. Solid gradient tile, white glyph.
 *
 * The class names are written out in full here, not built from a hue, because Tailwind
 * only generates classes it can see in the files it scans (`src/lib` is not one of them).
 */
const TINT: Record<string, string> = {
  'capture-leads': 'from-violet-500 to-violet-600',
  'recover-leaving-visitors': 'from-orange-500 to-orange-600',
  'get-more-bookings': 'from-sky-500 to-sky-600',
  'increase-online-sales': 'from-emerald-500 to-emerald-600',
  'promote-offers': 'from-pink-500 to-pink-600',
  'understand-your-traffic': 'from-blue-500 to-blue-600',
  'find-why-visitors-dont-convert': 'from-amber-500 to-amber-600',
  'improve-landing-pages': 'from-red-500 to-red-600',
  'debug-with-session-recordings': 'from-indigo-500 to-indigo-600',
  'catch-bugs-and-broken-forms': 'from-fuchsia-500 to-fuchsia-600',
  'measure-campaign-roi': 'from-teal-500 to-teal-600',
  'report-to-clients': 'from-cyan-500 to-cyan-600',
  'convert-free-users': 'from-yellow-500 to-yellow-600',
  'grow-subscriptions-and-donations': 'from-rose-500 to-rose-600',
};

const SIZES = {
  xs: { box: 'h-6 w-6 rounded-md', icon: 'h-3.5 w-3.5' },
  sm: { box: 'h-8 w-8 rounded-lg', icon: 'h-4 w-4' },
  md: { box: 'h-10 w-10 rounded-xl', icon: 'h-5 w-5' },
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
  const tint = TINT[useCase.slug] ?? 'from-primary to-primary';
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br text-white shadow-sm ring-1 ring-inset ring-white/20 ${tint} ${s.box} ${className}`}
    >
      <useCase.icon className={s.icon} strokeWidth={2.1} />
    </span>
  );
}
