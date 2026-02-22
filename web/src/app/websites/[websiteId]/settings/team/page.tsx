'use client';

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  UserPlus,
  Mail,
  Trash2,
  ShieldCheck,
  MoreVertical,
  Loader2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useParams, useRouter } from 'next/navigation';
import { isEnterprise } from '@/lib/features';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { cn } from '@/lib/utils';

export default function TeamSettings() {
  const params = useParams();
  const websiteId = params?.websiteId as string;
  const router = useRouter();

  useEffect(() => {
    if (!isEnterprise) {
      router.replace(`/websites/${websiteId}/settings`);
    }
  }, [router, websiteId]);

  if (!isEnterprise) return null;

  const teamMembers = [
    { name: 'Shohag Miah', email: 'shohag@seentics.com', role: 'Owner', status: 'Active' },
    { name: 'John Doe', email: 'john@example.com', role: 'Admin', status: 'Active' },
    { name: 'Sarah Wilson', email: 'sarah@design.co', role: 'Viewer', status: 'Pending' }
  ];

  return (
    <div className="p-4 sm:p-8 space-y-8 animate-in fade-in duration-500 max-w-[1440px] mx-auto">
      <DashboardPageHeader
        title="Team Management"
        description="Manage who has access to this website's analytics."
      >
        <Button size="sm" className="gap-1.5 text-xs font-medium">
          <UserPlus className="h-3.5 w-3.5" />
          Invite Member
        </Button>
      </DashboardPageHeader>

      {/* Team Members Table */}
      <div className="border border-border/60 rounded-lg overflow-hidden bg-card shadow-sm">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_180px_80px_80px] items-center px-5 py-2.5 border-b border-border/30 bg-muted/10 text-xs font-medium text-muted-foreground">
          <div className="pl-1">Member</div>
          <div>Email</div>
          <div className="text-center">Status</div>
          <div />
        </div>

        {/* Rows */}
        <div className="divide-y divide-border/20">
          {teamMembers.map((member, i) => (
            <div key={i} className="group grid grid-cols-[1fr_180px_80px_80px] items-center px-5 py-3 transition-colors hover:bg-muted/20">
              {/* Member */}
              <div className="flex items-center gap-3 min-w-0 pl-1">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-primary">{member.name.charAt(0)}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{member.name}</span>
                    {member.role === 'Owner' && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                        {member.role}
                      </span>
                    )}
                    {member.role !== 'Owner' && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {member.role}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-center gap-1.5 min-w-0">
                <Mail className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                <span className="text-xs text-muted-foreground truncate">{member.email}</span>
              </div>

              {/* Status */}
              <div className="flex items-center justify-center gap-1.5">
                <span className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  member.status === 'Active' ? 'bg-emerald-500' : 'bg-amber-500'
                )} />
                <span className={cn(
                  'text-xs font-medium',
                  member.status === 'Active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                )}>
                  {member.status}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-all">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem className="text-xs gap-2">
                      <ShieldCheck className="h-3.5 w-3.5" /> Change Role
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-xs gap-2 text-rose-600 focus:text-rose-600">
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="bg-muted/30 border border-border/40 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Role-Based Access</span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Invited members can view reports, manage goals, or configure tracking settings depending on their assigned role.
        </p>
      </div>
    </div>
  );
}
