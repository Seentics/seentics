import type { ClientBrand } from './types';

/** `#7c3aed` (or `#abc`) as the `H S% L%` triplet the theme's `--primary` holds; `null` if not a hex colour. */
export function hexToHslTriplet(hex: string | null | undefined): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex ?? '').trim());
  if (!m) return null;
  const v = m[1]!.length === 3 ? m[1]!.split('').map(c => c + c).join('') : m[1]!;
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Only https logos are shown, as in the workspace's branding preview. */
export const brandLogo = (brand: Pick<ClientBrand, 'logo_url'> | null | undefined): string | null =>
  brand?.logo_url && brand.logo_url.startsWith('https://') ? brand.logo_url : null;

/** The CSS variables a brand colour sets, for an element's `style` or the document root. */
export function brandColorVars(color: string | null | undefined): Record<string, string> {
  const hsl = hexToHslTriplet(color);
  return hsl ? { '--primary': hsl, '--ring': hsl, '--sidebar-primary': hsl } : {};
}
