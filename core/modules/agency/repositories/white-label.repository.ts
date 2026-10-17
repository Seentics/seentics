/** Persistence for white-label settings: one row per owner, plain reads and writes. */

import { sql } from "../../../db";
import type { WhiteLabelRepository, WhiteLabelSettings } from "../interfaces";
import { toDate } from "./row-dates";

type Row = {
  owner_id: string;
  brand_name: string;
  logo_url: string;
  primary_color: string;
  support_email: string;
  footer_text: string;
  hide_seentics: boolean;
  updated_at: string | Date;
};

function toSettings(r: Row): WhiteLabelSettings {
  return {
    ownerId: r.owner_id,
    brandName: r.brand_name,
    logoUrl: r.logo_url,
    primaryColor: r.primary_color,
    supportEmail: r.support_email,
    footerText: r.footer_text,
    hideSeentics: r.hide_seentics,
    updatedAt: toDate(r.updated_at),
  };
}

export class PostgresWhiteLabelRepository implements WhiteLabelRepository {
  async find(ownerId: string): Promise<WhiteLabelSettings | null> {
    const [row] = await sql<Row[]>`
      SELECT owner_id, brand_name, logo_url, primary_color, support_email, footer_text, hide_seentics, updated_at
      FROM agency_white_label WHERE owner_id = ${ownerId}::uuid
    `;
    return row ? toSettings(row) : null;
  }

  async upsert(s: WhiteLabelSettings): Promise<WhiteLabelSettings> {
    const [row] = await sql<Row[]>`
      INSERT INTO agency_white_label
        (owner_id, brand_name, logo_url, primary_color, support_email, footer_text, hide_seentics)
      VALUES (${s.ownerId}::uuid, ${s.brandName}, ${s.logoUrl}, ${s.primaryColor}, ${s.supportEmail},
              ${s.footerText}, ${s.hideSeentics})
      ON CONFLICT (owner_id) DO UPDATE SET
        brand_name = EXCLUDED.brand_name,
        logo_url = EXCLUDED.logo_url,
        primary_color = EXCLUDED.primary_color,
        support_email = EXCLUDED.support_email,
        footer_text = EXCLUDED.footer_text,
        hide_seentics = EXCLUDED.hide_seentics,
        updated_at = NOW()
      RETURNING owner_id, brand_name, logo_url, primary_color, support_email, footer_text, hide_seentics, updated_at
    `;
    return toSettings(row!);
  }
}
