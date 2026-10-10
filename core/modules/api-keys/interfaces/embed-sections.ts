import { z } from "zod";

/**
 * The sections an embed link can expose. The one place to add a new one (funnels, goals...):
 * add its id here, mirror it in `db/sql/049_embed_link_sections.sql`'s CHECK, and gate its
 * embed routes with `requireSection`.
 */
export const EMBED_SECTIONS = ["analytics", "recordings", "heatmaps"] as const;

export type EmbedSection = (typeof EMBED_SECTIONS)[number];

/** What a new link exposes unless told otherwise. Recordings show real visitors: opt-in. */
export const DEFAULT_EMBED_SECTIONS: EmbedSection[] = ["analytics"];

export const isEmbedSection = (v: unknown): v is EmbedSection => typeof v === "string" && (EMBED_SECTIONS as readonly string[]).includes(v);

/** Known ids only, de-duplicated, in canonical order. */
export function normalizeSections(input: readonly string[]): EmbedSection[] {
  return EMBED_SECTIONS.filter((s) => input.includes(s));
}

/** A non-empty list of known section ids, as the dashboard and management API accept it. */
export const sectionsSchema = z.array(z.enum(EMBED_SECTIONS)).min(1, "Choose at least one section");
