import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** A two-state filter chip. `aria-pressed` is what makes it a toggle to a screen reader. */
export function SignalFilter({
  pressed,
  onPressedChange,
  label,
  title,
  icon,
  activeClass,
}: {
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
  label: string;
  title: string;
  icon: React.ReactNode;
  activeClass: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={pressed}
      title={title}
      onClick={() => onPressedChange(!pressed)}
      className={cn('h-8 gap-1.5 px-2.5 text-xs', pressed && activeClass)}
    >
      {icon}
      {label}
    </Button>
  );
}
