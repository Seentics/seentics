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
