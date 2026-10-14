import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { StatusTone } from '@/lib/integration-form';

export const TONE: Record<StatusTone, string> = {
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  muted: 'bg-muted text-muted-foreground',
};

/** One state word on a tinted pill, shared by destination cards, the delivery log and submission rows. */
export function StatusBadge({ label, tone, className }: { label: string; tone: StatusTone; className?: string }) {
  return <Badge variant="outline" className={cn('shrink-0 border-0 font-medium', TONE[tone], className)}>{label}</Badge>;
}
