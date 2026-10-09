'use client';

import { useCallback, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  /** The action button's label — say what happens: "Delete funnel", not "OK". */
  confirmLabel?: string;
  /** Red action button and warning icon, for anything that destroys or revokes. */
  destructive?: boolean;
};

/**
 * An in-app confirmation, in place of the browser's `confirm()`.
 *
 * ```tsx
 * const [confirm, confirmDialog] = useConfirm();
 * if (await confirm({ title: 'Delete funnel?', destructive: true })) remove();
 * return <>…{confirmDialog}</>;
 * ```
 *
 * Promise-based so a call site reads like the `confirm()` it replaces. Dismissing the
 * dialog any way other than the action button resolves `false`.
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    resolver.current?.(false);
    setOptions(opts);
    return new Promise<boolean>(resolve => { resolver.current = resolve; });
  }, []);

  const settle = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  };

  const dialog = (
    <Dialog open={!!options} onOpenChange={open => { if (!open) settle(false); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            {options?.destructive && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
            )}
            <div className="space-y-1.5 text-left">
              <DialogTitle>{options?.title}</DialogTitle>
              {options?.description && (
                <DialogDescription className="text-sm leading-relaxed">{options.description}</DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => settle(false)}>Cancel</Button>
          <Button
            size="sm"
            variant={options?.destructive ? 'destructive' : 'default'}
            onClick={() => settle(true)}
            autoFocus
          >
            {options?.confirmLabel ?? 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return [confirm, dialog] as const;
}
