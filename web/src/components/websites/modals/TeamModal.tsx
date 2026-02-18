'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Trash2, Mail } from 'lucide-react';
import { isEnterprise } from '@/lib/features';

interface TeamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TeamModal({ isOpen, onClose }: TeamModalProps) {
  if (!isEnterprise) return null;
  const members = [
    {
      name: 'Alice Johnson',
      email: 'alice@example.com',
      role: 'Owner',
      avatar: 'https://github.com/shadcn.png',
    },
    {
      name: 'Bob Smith',
      email: 'bob@example.com',
      role: 'Editor',
      avatar: '',
    },
    {
      name: 'Charlie Brown',
      email: 'charlie@example.com',
      role: 'Viewer',
      avatar: '',
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Team Members</DialogTitle>
          <DialogDescription>
            Manage who has access to this website's analytics.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Invite Section */}
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
                <Label htmlFor="email">Invite new member</Label>
                <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="email" placeholder="colleague@example.com" className="pl-9" />
                </div>
            </div>
            <div className="w-[110px] space-y-2">
                <Label htmlFor="role" className="sr-only">Role</Label>
                <Select defaultValue="viewer">
                    <SelectTrigger>
                        <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <Button>
                <Plus className="h-4 w-4" />
                Invite
            </Button>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Current Members</h4>
            <div className="space-y-3">
              {members.map((member, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.avatar} />
                      <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium leading-none">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                        {member.role}
                    </span>
                    {member.role !== 'Owner' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
