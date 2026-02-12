import { cn } from '@/lib/utils';
import Image from 'next/image';

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
  textClassName?: string;
}

const sizeMap = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 36,
};

const textSizeMap = {
  xs: 'text-sm',
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-xl',
  xl: 'text-2xl',
};

export function Logo({
  size = 'md',
  className,
  showText = false,
  textClassName
}: LogoProps) {
  const logoSize = sizeMap[size];
  const textSize = textSizeMap[size];

  if (showText) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Image
          src="/logo.png"
          width={logoSize}
          height={logoSize}
          alt="Seentics Logo"
          className="rounded"
        />
        <span className={cn("font-bold text-foreground", textSize, textClassName)}>
          Seentics
        </span>
      </div>
    );
  }

  return (
    <Image
      src="/logo.png"
      width={logoSize}
      height={logoSize}
      alt="Seentics Logo"
      className={cn("rounded", className)}
    />
  );
}
