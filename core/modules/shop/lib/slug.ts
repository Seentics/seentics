/** Store and page slugs: the path segments of seentics.shop/<store>/<page>. */

export const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

/** Paths the shop host keeps for itself, or that would read as ours. */
const RESERVED = new Set([
  "api", "admin", "static", "assets", "www", "seentics", "help", "support", "i", "img", "images",
  "order", "orders", "login", "signin", "signup", "account", "shop", "store", "stores", "app",
  "dashboard", "settings", "billing", "pricing", "terms", "privacy", "about", "contact", "favicon.ico",
  "robots.txt", "sitemap.xml", "health", "status", "blog", "docs", "new", "edit", "null", "undefined",
]);

export function isValidSlug(slug: string): boolean {
  return SLUG.test(slug) && !slug.includes("--") && !RESERVED.has(slug);
}

/** A starting slug from a name, Latin letters only; the seller can change it. Empty when nothing usable is left. */
export function suggestSlug(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
}
