import api from '@/lib/api';

/**
 * Suite-wide roles and permissions, served by the gateway.
 *
 * Distinct from the website members managed elsewhere in settings: a website
 * member is who may open *this site*, which Core owns. A suite role decides
 * what someone may do across Analytics, Uptime and Observability together, and
 * narrows their website role rather than replacing it — both checks run.
 */

export const ROLES = ['viewer', 'member', 'admin', 'owner'] as const;
export type Role = (typeof ROLES)[number];

export type SuiteTeam = { id: string; name: string; isPersonal: boolean; role: Role };
export type SuiteMember = { userId: string; name: string; email: string; role: Role };
export type CustomRole = { id: string; name: string; baseRole: Role; permissions: string[] };
export type Access = { teamId: string; role: Role; permissions: string[] };
export type PermissionCatalogue = { permissions: string[]; presets: Record<Role, string[]> };

const base = '/teams';

export async function listSuiteTeams(): Promise<SuiteTeam[]> {
  const { data } = await api.get(base);
  return data.data;
}

export async function getSuiteAccess(teamId: string): Promise<Access> {
  const { data } = await api.get(`${base}/${teamId}/me`);
  return data.data;
}

export async function getPermissionCatalogue(): Promise<PermissionCatalogue> {
  const { data } = await api.get(`${base}/permissions`);
  return data.data;
}

export async function listSuiteMembers(teamId: string): Promise<SuiteMember[]> {
  const { data } = await api.get(`${base}/${teamId}/members`);
  return data.data;
}

export async function listSuiteRoles(teamId: string): Promise<CustomRole[]> {
  const { data } = await api.get(`${base}/${teamId}/roles`);
  return data.data;
}

export async function createSuiteRole(
  teamId: string,
  input: { name: string; baseRole: Role; permissions: string[] },
): Promise<CustomRole> {
  const { data } = await api.post(`${base}/${teamId}/roles`, input);
  return data.data;
}

export async function updateSuiteRole(
  teamId: string,
  roleId: string,
  input: { name?: string; baseRole?: Role; permissions?: string[] },
): Promise<void> {
  await api.patch(`${base}/${teamId}/roles/${roleId}`, input);
}

export async function deleteSuiteRole(teamId: string, roleId: string): Promise<void> {
  await api.delete(`${base}/${teamId}/roles/${roleId}`);
}

export async function assignSuiteRole(
  teamId: string,
  userId: string,
  customRoleId: string | null,
): Promise<void> {
  await api.put(`${base}/${teamId}/members/${userId}/role`, { customRoleId });
}

/** `product:subject.action` — split for grouping in the editor. */
export function describePermission(key: string): { product: string; subject: string; action: string } {
  const [product = '', rest = ''] = key.split(':');
  const [subject = '', action = ''] = rest.split('.');
  return { product, subject, action };
}
