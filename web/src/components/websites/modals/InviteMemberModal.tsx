'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inviteMemberByToken } from '@/lib/websites-api';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { isEnterprise } from '@/lib/features';

interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websiteId: string;
}

export function InviteMemberModal({ open, onOpenChange, websiteId }: InviteMemberModalProps) {
  if (!isEnterprise) return null;
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'viewer'>('viewer');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      inviteMemberByToken(websiteId, data),
    onSuccess: () => {
      toast.success('Invitation sent! The user will receive an email to join.');
      queryClient.invalidateQueries({ queryKey: ['members', websiteId] });
      queryClient.invalidateQueries({ queryKey: ['invitations', websiteId] });
      onOpenChange(false);
      setEmail('');
      setRole('viewer');
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || error.message || 'Failed to send invitation';
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    mutation.mutate({ email, role });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation link to add a new member. They'll receive an email to accept.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(v: any) => setRole(v)}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (Full Access)</SelectItem>
                  <SelectItem value="viewer">Viewer (Read Only)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">
                {role === 'admin'
                  ? 'Admins can manage settings, invite members, and view all analytics.'
                  : 'Viewers have read-only access to all analytics and reports.'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Send Invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
