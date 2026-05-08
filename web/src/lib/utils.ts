import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Returns true only for non-empty IDs that are not the literal strings "undefined" or "null". */
export const isValidId = (id: string | undefined | null): boolean =>
  !!id && id !== 'undefined' && id !== 'null';
