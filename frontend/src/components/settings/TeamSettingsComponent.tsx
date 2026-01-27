'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Mail, 
  Trash2, 
  UserPlus, 
  ShieldCheck,
  MoreVertical,
  Target
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export function TeamSettingsComponent() {
  const teamMembers = [
    { name: 'Shohag Miah', email: 'shohag@seentics.com', role: 'Owner', status: 'Active' },
    { name: 'John Doe', email: 'john@example.com', role: 'Admin', status: 'Active' },
    { name: 'Sarah Wilson', email: 'sarah@design.co', role: 'Viewer', status: 'Pending' }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Team Management</h2>
          <p className="text-muted-foreground text-sm">Manage who has access to this website's analytics.</p>
        </div>
        <Button className="h-10 px-5 font-bold rounded-xl gap-2 shadow-lg shadow-primary/10 transition-transform active:scale-95">
          <UserPlus className="h-4 w-4" />
          Invite Member
        </Button>
      </div>

      <div className="space-y-4">
        {teamMembers.map((member, i) => (
          <div key={i} className="flex items-center justify-between p-4 rounded-2xl border bg-muted/5 transition-all hover:bg-muted/10 group">
            <div className="flex items-center gap-4">
              <Avatar className="h-10 w-10 border border-border/50">
                <AvatarFallback className="bg-primary/10 text-primary font-black text-xs">
                    {member.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold truncate">{member.name}</p>
                  {member.role === 'Owner' && (
                    <Badge className="h-4 text-[9px] uppercase font-black bg-primary/10 text-primary hover:bg-primary/20 border-none">
                      {member.role}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <span className="text-xs">{member.email}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end">
                <Badge variant={member.status === 'Active' ? 'default' : 'secondary'} className={cn(
                  "h-5 text-[9px] font-bold uppercase tracking-widest px-2",
                  member.status === 'Active' ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-none" : ""
                )}>
                  {member.status}
                </Badge>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground rounded-lg hover:bg-muted">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 rounded-xl border-border/50 shadow-xl">
                  <DropdownMenuItem className="text-xs font-bold gap-2">
                    <ShieldCheck className="h-4 w-4" /> Change Role
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs font-bold gap-2 text-rose-600 focus:text-rose-600">
                    <Trash2 className="h-4 w-4" /> Remove User
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>

      <div className="p-8 rounded-3xl bg-muted/30 border border-dashed border-muted-foreground/20 flex flex-col items-center text-center space-y-4">
         <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center shadow-sm border border-border/50">
            <Target className="h-6 w-6 text-muted-foreground" />
         </div>
         <div className="space-y-1">
            <p className="text-sm font-bold">Collaborate with your team</p>
            <p className="text-xs text-muted-foreground max-w-[350px] leading-relaxed">
                Invited members can view reports, manage goals, or configure tracking settings depending on their assigned role.
            </p>
         </div>
      </div>
    </div>
  );
}
