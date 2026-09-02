'use client';

import { useId, useState, type ComponentProps, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';

/**
 * A labelled field, and a password field that can reveal itself.
 *
 * The leading icons are gone. Every input carried a `Mail` or `Lock` glyph pinned
 * inside it, which meant the label already said "Email", the placeholder said
 * "you@company.com", and then a third element said it again — three ways to name one
 * field. On a form this short the label alone is unambiguous, and dropping them lets
 * the inputs use their natural padding.
 *
 * `useId` rather than hand-written ids: reset-password and signup both needed a
 * confirm-password field, and hardcoded ids would collide the moment two live on one
 * page.
 */
export function AuthField({
  label,
  action,
  ...props
}: { label: string; action?: ReactNode } & ComponentProps<typeof Input>) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {action}
      </div>
      <Input id={id} {...props} />
    </div>
  );
}

export function PasswordField({
  label,
  action,
  ...props
}: { label: string; action?: ReactNode } & Omit<ComponentProps<typeof Input>, 'type'>) {
  const id = useId();
  const [shown, setShown] = useState(false);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {action}
      </div>
      <div className="relative">
        <Input id={id} type={shown ? 'text' : 'password'} className="pr-11" {...props} />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/** Inline form error. Was styled four different ways across the four pages. */
export function AuthError({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
    >
      {children}
    </div>
  );
}
