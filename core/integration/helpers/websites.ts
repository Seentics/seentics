import { addMember, seedUser, seedWebsite, type SeededUser, type SeededWebsite } from "../harness";

export const W = "/api/v1/websites";

export type Team = {
  site: SeededWebsite;
  owner: SeededUser;
  admin: SeededUser;
  member: SeededUser;
  viewer: SeededUser;
  stranger: SeededUser;
};

/** A site with one person at every role, plus a signed-in stranger with no access. */
export async function seedTeam(): Promise<Team> {
  const [owner, admin, member, viewer, stranger] = await Promise.all([seedUser(), seedUser(), seedUser(), seedUser(), seedUser()]);
  const site = await seedWebsite(owner.id);
  await addMember(site.id, admin.id, "admin");
  await addMember(site.id, member.id, "member");
  await addMember(site.id, viewer.id, "viewer");
  return { site, owner, admin, member, viewer, stranger };
}

/** A well-formed uuid no row will ever have. */
export const MISSING_ID = "00000000-0000-4000-8000-000000000000";
