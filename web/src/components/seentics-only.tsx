'use client';

import type { ReactNode } from 'react';
import { useOnCustomHost } from '@/lib/seentics-host';

/**
 * Something of Seentics' own (a link to our docs, pricing or help) that an agency's own domain
 * never shows: its clients are the agency's, and our site is not served there.
 */
export function SeenticsOnly({ children }: { children: ReactNode }) {
  return useOnCustomHost() ? null : <>{children}</>;
}
