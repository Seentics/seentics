import type { WebsiteRole } from "./website.interface";

export type CreateGoalBody = {
  name: string;
  type: string;
  identifier: string;
  selector?: string;
};

export type UpdateGoalPatch = Partial<{
  name: string;
  type: string;
  identifier: string;
  selector: string | null;
}>;

export type AddWebsiteMemberBody = {
  email: string;
  role?: string;
};

/** A goal the AI assistant drafted: a page reached, or a custom event fired. */
export type GoalDraft = { name: string; type: "pageview" | "event"; identifier: string };

/** A goal as the assistant reads it before drafting a change to it. */
export type GoalSnapshot = {
  id: string;
  name: string;
  type: string;
  identifier: string;
  /** `updated_at`, ISO: the version a drafted change is checked against when it is confirmed. */
  version: string;
};

/** The fields a drafted goal change may set. */
export type GoalDraftPatch = Partial<GoalDraft>;

/**
 * Validates, creates and changes goals someone approved in the assistant, with the goal endpoints'
 * own schemas. The AI module's whole write surface into goals: no delete — goals have no archived
 * state, and the assistant never removes anything.
 */
export interface GoalDraftPort {
  validate(draft: unknown): { ok: true; draft: GoalDraft } | { ok: false; error: string };
  createFromProposal(input: { websiteId: string; payload: unknown }): Promise<{ id: string }>;

  list(websiteId: string): Promise<GoalSnapshot[]>;
  /** `null` when no goal with that id belongs to this website. */
  get(websiteId: string, goalId: string): Promise<GoalSnapshot | null>;
  /**
   * A patch checked as the goal it would produce. A click goal (picked with a selector on the
   * settings screen) may only be renamed here.
   */
  validatePatch(current: GoalSnapshot, patch: unknown): { ok: true; patch: GoalDraftPatch } | { ok: false; error: string };
  /** Re-validated against the goal as it is now, then the goal endpoint's update. Throws when gone. */
  updateFromProposal(input: { websiteId: string; goalId: string; payload: unknown }): Promise<{ id: string }>;
}

/**
 * The per-site collection settings the assistant may draft a change to: exactly the tracking
 * fields `PUT /websites/:id` already edits (the website settings and tracking screens). Snake_case,
 * the wire shape that endpoint takes. Name, domain, activation and the owner-only privacy settings
 * are not here on purpose.
 */
export type SiteTrackingSettings = {
  automation_enabled: boolean;
  funnel_enabled: boolean;
  errors_enabled: boolean;
  heatmap_enabled: boolean;
  heatmap_layout_enabled: boolean;
  heatmap_include_patterns: string | null;
  heatmap_exclude_patterns: string | null;
  replay_enabled: boolean;
  /** Share of sessions recorded, 0 to 1. */
  replay_sampling_rate: number;
  replay_include_patterns: string | null;
  replay_exclude_patterns: string | null;
  mask_all_text: boolean;
  mask_text_patterns: string | null;
};

/**
 * Validates and applies site settings changes approved in the assistant, through the same patch
 * mapping and mutation `PUT /websites/:id` uses (so the tracker caches are invalidated the same
 * way). Admin-only is enforced by the caller, as on that endpoint.
 */
export interface SiteSettingsDraftPort {
  /** `null` when the site does not exist. `version` is the site's `updated_at`, ISO. */
  current(websiteId: string): Promise<{ settings: SiteTrackingSettings; version: string } | null>;
  validatePatch(patch: unknown): { ok: true; patch: Partial<SiteTrackingSettings> } | { ok: false; error: string };
  applyFromProposal(input: { websiteId: string; payload: unknown }): Promise<{ id: string }>;
}

export interface WebsiteGoalOperations {
  listWebsiteGoals(websiteId: string): Promise<unknown>;
  createWebsiteGoal(websiteId: string, body: CreateGoalBody): Promise<unknown>;
  updateWebsiteGoal(
    websiteId: string,
    goalId: string,
    body: UpdateGoalPatch,
  ): Promise<unknown | null>;
  deleteWebsiteGoal(websiteId: string, goalId: string): Promise<void>;
}

export interface WebsiteMemberOperations {
  list(websiteId: string): Promise<unknown>;
  add(
    websiteId: string,
    actorRole: WebsiteRole,
    body: AddWebsiteMemberBody,
  ): Promise<unknown>;
  remove(
    websiteId: string,
    actorUserId: string,
    actorRole: WebsiteRole,
    targetUserId: string,
  ): Promise<void>;
  updateRole(
    websiteId: string,
    actorUserId: string,
    actorRole: WebsiteRole,
    targetUserId: string,
    role: string,
  ): Promise<void>;
}

export interface WebsiteInvitationOperations {
  list(websiteId: string): Promise<unknown>;
  create(
    actorUserId: string,
    actorRole: WebsiteRole,
    websiteId: string,
    body: { email: string; role: string },
  ): Promise<unknown>;
  revoke(websiteId: string, invitationId: string): Promise<void>;
}
