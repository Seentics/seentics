'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/ui/logo';
import {
  ArrowLeft,
  Users,
  Plus,
  Mail,
  Shield,
  ShieldCheck,
  UserCog,
  User,
  Trash2,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

type Role = 'owner' | 'admin' | 'member' | 'viewer';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  joinedAt: string;
  avatar?: string;
}

const roleConfig: Record<Role, { label: string; icon: React.ElementType; color: string; description: string }> = {
  owner: { label: 'Owner', icon: ShieldCheck, color: 'text-amber-500', description: 'Full access, billing, can transfer ownership' },
  admin: { label: 'Admin', icon: Shield, color: 'text-blue-500', description: 'Full access, manage team members' },
  member: { label: 'Member', icon: UserCog, color: 'text-emerald-500', description: 'View and manage data, create resources' },
  viewer: { label: 'Viewer', icon: User, color: 'text-muted-foreground', description: 'Read-only access to all dashboards' },
};

export default function TeamPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('member');
  const [inviting, setInviting] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState<string | null>(null);

  // Current user as the only member for now (will integrate with API)
  const [members] = useState<TeamMember[]>([
    {
      id: user?.id || '1',
      name: user?.name || 'You',
      email: user?.email || '',
      role: 'owner',
      joinedAt: new Date().toISOString(),
    },
  ]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);

    // TODO: Call API to send invitation
    setTimeout(() => {
      toast({
        title: 'Invitation sent',
        description: `Invited ${inviteEmail} as ${roleConfig[inviteRole].label}`,
      });
      setInviteEmail('');
      setInviting(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/workspace">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-bold text-lg">Team Management</h1>
            <p className="text-[10px] text-muted-foreground -mt-0.5">Manage workspace members and roles</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Invite Section */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-3">Invite Team Member</h2>
          <div className="rounded-xl border border-border/50 bg-card p-5">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="pl-10 h-10"
                />
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowRoleDropdown(showRoleDropdown === 'invite' ? null : 'invite')}
                  className="h-10 px-4 rounded-lg border border-border/50 bg-background text-sm flex items-center gap-2 hover:bg-accent transition-colors w-full sm:w-auto"
                >
                  {roleConfig[inviteRole].label}
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                {showRoleDropdown === 'invite' && (
                  <div className="absolute top-full mt-1 right-0 w-56 rounded-lg border border-border/50 bg-card shadow-lg z-10 py-1">
                    {(['admin', 'member', 'viewer'] as Role[]).map((role) => {
                      const config = roleConfig[role];
                      return (
                        <button
                          key={role}
                          onClick={() => {
                            setInviteRole(role);
                            setShowRoleDropdown(null);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-accent transition-colors flex items-center gap-2"
                        >
                          <config.icon className={cn('h-4 w-4', config.color)} />
                          <div>
                            <p className="text-sm font-medium">{config.label}</p>
                            <p className="text-[10px] text-muted-foreground">{config.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} className="h-10 gap-1.5">
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Invite
              </Button>
            </div>
          </div>
        </section>

        {/* Roles Legend */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-3">Roles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(roleConfig).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <div key={key} className="rounded-lg border border-border/50 bg-card p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={cn('h-4 w-4', config.color)} />
                    <span className="text-sm font-medium">{config.label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{config.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Members List */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Members ({members.length})</h2>
          </div>
          <div className="rounded-xl border border-border/50 bg-card divide-y divide-border/50">
            {members.map((member) => {
              const config = roleConfig[member.role];
              const RoleIcon = config.icon;
              return (
                <div key={member.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                      {member.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {member.name}
                        {member.id === user?.id && (
                          <span className="ml-1.5 text-[10px] text-muted-foreground">(you)</span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <RoleIcon className={cn('h-3.5 w-3.5', config.color)} />
                      <span className="text-xs font-medium">{config.label}</span>
                    </div>
                    {member.role !== 'owner' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
