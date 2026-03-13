'use client';

import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  MoreVertical,
  Trash2,
  Shield,
  Mail,
  Loader2,
  Clock,
  SendHorizonal,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMembers, removeMember, updateMemberRole, listPendingInvitations, revokeInvitation, WebsiteMember, WebsiteInvitation } from '@/lib/websites-api';
import { InviteMemberModal } from '../websites/modals/InviteMemberModal';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/stores/useAuthStore';
import { isEnterprise } from '@/lib/features';
import { usePermissions } from '@/hooks/use-permissions';

interface TeamSettingsComponentProps {
  websiteId: string;
}

export function TeamSettingsComponent({ websiteId }: TeamSettingsComponentProps) {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { canManageMembers, canChangeRoles, canInviteMembers, isViewer, isLoading: permLoading } = usePermissions(websiteId);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', websiteId],
    queryFn: () => getMembers(websiteId),
    enabled: !!websiteId,
  });

  const { data: pendingInvitations = [] } = useQuery({
    queryKey: ['invitations', websiteId],
    queryFn: () => listPendingInvitations(websiteId),
    enabled: !!websiteId && canManageMembers,
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => removeMember(websiteId, userId),
    onSuccess: () => {
      toast.success('Member removed successfully');
      queryClient.invalidateQueries({ queryKey: ['members', websiteId] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || error.message || 'Failed to remove member');
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      updateMemberRole(websiteId, userId, role),
    onSuccess: () => {
      toast.success('Role updated successfully');
      queryClient.invalidateQueries({ queryKey: ['members', websiteId] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || error.message || 'Failed to update role');
    },
  });

  const revokeInvMutation = useMutation({
    mutationFn: (invitationId: string) => revokeInvitation(websiteId, invitationId),
    onSuccess: () => {
      toast.success('Invitation revoked');
      queryClient.invalidateQueries({ queryKey: ['invitations', websiteId] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || error.message || 'Failed to revoke invitation');
    },
  });

  const handleChangeRole = (memberUserId: string, newRole: string) => {
    roleMutation.mutate({ userId: memberUserId, role: newRole });
  };

  const handleRemoveMember = (memberUserId: string) => {
    if (confirm('Are you sure you want to remove this member?')) {
      deleteMutation.mutate(memberUserId);
    }
  };

  if (!isEnterprise) return null;

  if (permLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight">Team Management</h2>
          <p className="text-muted-foreground text-sm">
            {isViewer
              ? 'View team members with access to this website.'
              : 'Manage who has access to this website\'s analytics.'}
          </p>
        </div>
        {canInviteMembers && (
          <Button
            onClick={() => setIsInviteModalOpen(true)}
            className="h-10 px-5 font-bold rounded gap-2 shadow-lg shadow-primary/20 transition-transform active:scale-95"
          >
            <UserPlus className="h-4 w-4" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Member List */}
      <div className="grid grid-cols-1 gap-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-12 bg-muted/20 rounded border border-dashed">
            <p className="text-muted-foreground">No team members besides you. Invite someone to collaborate.</p>
          </div>
        ) : (
          members.map((member: WebsiteMember) => (
            <div
              key={member.id}
              className="group bg-card/50 backdrop-blur-sm p-4 rounded flex items-center justify-between border border-border/50 hover:border-primary/30 transition-all hover:bg-card/80"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-foreground">{member.userName || 'Unknown User'}</h4>
                    <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider px-1.5 h-4 bg-muted/50">
                      {member.role}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium">
                      <Mail className="h-3 w-3 opacity-50" />
                      {member.userEmail}
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <Clock className="h-3 w-3 opacity-50" />
                      Joined {format(new Date(member.createdAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {member.role !== 'owner' && member.userId !== user?.id && canManageMembers && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded">
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded p-2">
                      {canChangeRoles && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="rounded gap-2 cursor-pointer flex items-center">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            Change Role
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-36 rounded p-1">
                            <DropdownMenuItem
                              onClick={() => handleChangeRole(member.userId, 'admin')}
                              disabled={member.role === 'admin' || roleMutation.isPending}
                              className="rounded gap-2 cursor-pointer"
                            >
                              <Shield className="h-4 w-4 text-blue-500" />
                              Admin
                              {member.role === 'admin' && <span className="ml-auto text-[10px] text-muted-foreground">Current</span>}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleChangeRole(member.userId, 'viewer')}
                              disabled={member.role === 'viewer' || roleMutation.isPending}
                              className="rounded gap-2 cursor-pointer"
                            >
                              <Users className="h-4 w-4 text-muted-foreground" />
                              Viewer
                              {member.role === 'viewer' && <span className="ml-auto text-[10px] text-muted-foreground">Current</span>}
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      )}
                      <DropdownMenuItem
                        onClick={() => handleRemoveMember(member.userId)}
                        className="rounded gap-2 cursor-pointer text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove Member
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pending Invitations */}
      {canManageMembers && pendingInvitations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <SendHorizonal className="h-4 w-4 text-muted-foreground" />
            Pending Invitations
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {pendingInvitations.map((inv: WebsiteInvitation) => (
              <div key={inv.id} className="bg-muted/20 p-3 rounded flex items-center justify-between border border-dashed border-border/50">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{inv.email}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Invited as <span className="font-bold uppercase">{inv.role}</span> · Expires {format(new Date(inv.expiresAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                  onClick={() => revokeInvMutation.mutate(inv.id)}
                  disabled={revokeInvMutation.isPending}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-muted/30 p-4 rounded border border-border/50 flex gap-4">
        <Shield className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="space-y-1">
          <p className="text-xs font-bold text-foreground">Advanced Permissions</p>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Owners can manage billing and delete websites.
            Admins have full access to settings and reports.
            Viewers have read-only access to all analytics data.
          </p>
        </div>
      </div>

      {canInviteMembers && (
        <InviteMemberModal
          open={isInviteModalOpen}
          onOpenChange={setIsInviteModalOpen}
          websiteId={websiteId}
        />
      )}
    </div>
  );
}
