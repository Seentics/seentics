'use client';

import { useQuery } from '@tanstack/react-query';
import { getMyRole, WebsiteRole } from '@/lib/websites-api';
import { isValidId } from '@/lib/utils';

/** Least privilege first, as the server orders them (core websites/interfaces roleAtLeast). */
const ROLE_ORDER = ['viewer', 'member', 'admin', 'owner'] as const;
const atLeast = (role: WebsiteRole, minimum: (typeof ROLE_ORDER)[number]) =>
  role !== '' && ROLE_ORDER.indexOf(role) >= ROLE_ORDER.indexOf(minimum);

/**
 * The current user's role on a website, and what it lets them do — the same rules the server
 * enforces, so the dashboard does not offer an action the server will refuse.
 *
 * - owner: everything, including billing, roles and deleting the website
 * - admin: settings and members as well
 * - member: creates, changes and deletes the site's data (automations, funnels, goals,
 *   heatmaps, recordings, error status)
 * - viewer: reads everything, changes nothing
 */
export function usePermissions(websiteId: string) {
  const { data: role = '', isLoading } = useQuery<WebsiteRole>({
    queryKey: ['my-role', websiteId],
    queryFn: () => getMyRole(websiteId),
    enabled: isValidId(websiteId),
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
    retry: 1,
  });

  return {
    role,
    isLoading,
    isOwner: role === 'owner',
    isAdmin: role === 'admin',
    isViewer: role === 'viewer',
    isMember: role !== '',
    // Until the role is known, offer nothing that changes data.
    canEdit: atLeast(role, 'member'),
    canManageMembers: atLeast(role, 'admin'),
    canChangeRoles: role === 'owner',
    canDeleteWebsite: role === 'owner',
    canManageBilling: role === 'owner',
    canInviteMembers: atLeast(role, 'admin'),
    canViewAnalytics: role !== '',
  };
}
