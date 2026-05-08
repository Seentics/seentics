'use client';

import { useQuery } from '@tanstack/react-query';
import { getMyRole, WebsiteRole } from '@/lib/websites-api';
import { isValidId } from '@/lib/utils';

/**
 * Hook that fetches the current user's role for a given website.
 * Returns permission helpers for role-based UI rendering.
 *
 * Roles hierarchy: owner > admin > viewer
 * - owner: full control (billing, delete, manage members/roles)
 * - admin: manage settings, members, analytics (cannot change roles or delete website)
 * - viewer: read-only access to all analytics
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

    // Role checks
    isOwner: role === 'owner',
    isAdmin: role === 'admin',
    isViewer: role === 'viewer',
    isMember: role !== '',

    // Permission checks (what can the user do?)
    canEdit: role === 'owner' || role === 'admin',
    canManageMembers: role === 'owner' || role === 'admin',
    canChangeRoles: role === 'owner',
    canDeleteWebsite: role === 'owner',
    canManageBilling: role === 'owner',
    canInviteMembers: role === 'owner' || role === 'admin',
    canViewAnalytics: role === 'owner' || role === 'admin' || role === 'viewer',
  };
}
