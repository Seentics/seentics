/**
 * An agency's white label: read with defaults, patched by merge.
 *
 * The owner is the authenticated user acting on their own agency; there is no way to name
 * another owner here, so there is nothing to check beyond who is asking.
 */

import {
  DEFAULT_PRIMARY_COLOR,
  type BrandView,
  type WhiteLabel,
  type WhiteLabelPatch,
  type WhiteLabelRepository,
  type WhiteLabelSettings,
} from "../interfaces";
import { presentBrand } from "../lib/presenters";

export function defaultWhiteLabel(ownerId: string): WhiteLabelSettings {
  return {
    ownerId,
    brandName: "",
    logoUrl: "",
    primaryColor: DEFAULT_PRIMARY_COLOR,
    supportEmail: "",
    footerText: "",
    hideSeentics: false,
    updatedAt: null,
  };
}

export class WhiteLabelService implements WhiteLabel {
  constructor(private readonly repo: WhiteLabelRepository) {}

  async get(ownerId: string): Promise<WhiteLabelSettings> {
    return (await this.repo.find(ownerId)) ?? defaultWhiteLabel(ownerId);
  }

  /**
   * Last write wins per row, not per field: two saves racing on different fields can lose
   * one. Acceptable for a settings form that always sends every field.
   */
  async update(ownerId: string, patch: WhiteLabelPatch): Promise<WhiteLabelSettings> {
    const current = await this.get(ownerId);
    const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as WhiteLabelPatch;
    return this.repo.upsert({ ...current, ...defined, ownerId });
  }

  async brandFor(ownerId: string): Promise<BrandView> {
    return presentBrand(await this.get(ownerId));
  }
}
