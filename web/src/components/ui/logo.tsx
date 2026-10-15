import { cn } from '@/lib/utils';

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

/**
 * The Seentics mark: a blue tile with a white cursor. One drawing for both themes — the
 * colours are its own, not the page's — so it reads the same in the sidebar, a browser
 * tab and a link preview. Source: seentics/logo.svg.
 */
function LogoIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="3" y="3" width="26" height="26" rx="7" fill="#2563eb" />
      <path d="M12 9.5 L12 22 L15.4 18.8 L19.2 23.4 L21.4 21.6 L17.5 17.1 L22 15.3 Z" fill="#fff" stroke="#fff" strokeWidth="0.6" strokeLinejoin="round" />
    </svg>
  );
}

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
        <LogoIcon size={logoSize} />
        <span className={cn("font-extrabold tracking-tight text-foreground", textSize, textClassName)}>
          Seentics
        </span>
      </div>
    );
  }

  return (
    <span className={cn("inline-flex", className)}>
      <LogoIcon size={logoSize} />
    </span>
  );
}
