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

function DarkIcon({ size }: { size: number }) {
  const h = Math.round(size * 46 / 48);
  return (
    <svg width={size} height={h} viewBox="0 0 48 46" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="4" width="42" height="38" rx="6" fill="#1a2240" stroke="#3b82f6" strokeWidth="1.8"/>
      <rect x="3" y="4" width="42" height="9" rx="6" fill="#2563eb"/>
      <rect x="3" y="10" width="42" height="3" fill="#2563eb"/>
      <circle cx="11" cy="8.5" r="1.5" fill="white" opacity="0.35"/>
      <circle cx="17" cy="8.5" r="1.5" fill="white" opacity="0.35"/>
      <circle cx="23" cy="8.5" r="1.5" fill="white" opacity="0.35"/>
      <circle cx="25" cy="28" r="10" fill="#3b82f6" opacity="0.08"/>
      <circle cx="25" cy="28" r="6" fill="#3b82f6" opacity="0.15"/>
      <circle cx="25" cy="28" r="2.5" fill="#3b82f6" opacity="0.3"/>
      <path d="M21 19 L21 34 L25.8 29.5 L31.5 36 L34.5 33.5 L28.5 27 L34 23 Z" fill="white"/>
    </svg>
  );
}

function LightIcon({ size }: { size: number }) {
  const h = Math.round(size * 46 / 48);
  return (
    <svg width={size} height={h} viewBox="0 0 48 46" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="4" width="42" height="38" rx="6" fill="#e8edf6" stroke="#2563eb" strokeWidth="1.8"/>
      <rect x="3" y="4" width="42" height="9" rx="6" fill="#2563eb"/>
      <rect x="3" y="10" width="42" height="3" fill="#2563eb"/>
      <circle cx="11" cy="8.5" r="1.5" fill="white" opacity="0.4"/>
      <circle cx="17" cy="8.5" r="1.5" fill="white" opacity="0.4"/>
      <circle cx="23" cy="8.5" r="1.5" fill="white" opacity="0.4"/>
      <circle cx="25" cy="28" r="10" fill="#3b82f6" opacity="0.06"/>
      <circle cx="25" cy="28" r="6" fill="#3b82f6" opacity="0.12"/>
      <circle cx="25" cy="28" r="2.5" fill="#3b82f6" opacity="0.25"/>
      <path d="M21 19 L21 34 L25.8 29.5 L31.5 36 L34.5 33.5 L28.5 27 L34 23 Z" fill="#1a1d2e"/>
    </svg>
  );
}

function LogoIcon({ size }: { size: number }) {
  return (
    <>
      <span className="hidden dark:inline-flex"><DarkIcon size={size} /></span>
      <span className="inline-flex dark:hidden"><LightIcon size={size} /></span>
    </>
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
