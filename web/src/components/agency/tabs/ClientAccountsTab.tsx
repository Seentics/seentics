'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Building2, Calendar, KeyRound, Loader2, Mail, Trash2, UserPlus, Users } from 'lucide-react';
import { deleteClientUser, listClientUsers, type ClientUser } from '@/features/agency';
import { USER_STATUS_STYLES } from '@/features/agency/constants';
import { CreateClientUserDialog, DeleteConfirmDialog, ResetPasswordDialog } from '@/components/agency/client-user-dialogs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Cloud only: logins that let a client see their own dashboard. Served by the gateway. */
export function ClientAccountsTab() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState<ClientUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientUser | null>(null);
  const [search, setSearch] = useState('');

  const { data: users = [], isLoading } = useQuery({ queryKey: ['agency-client-users'], queryFn: listClientUsers });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteClientUser(userId),
    onSuccess: () => {
      toast.success('Account deleted');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['agency-client-users'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete account'),
  });

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [u.name, u.email, u.company ?? ''].some(v => v.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Input
            placeholder="Search by name, email, company…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 text-sm w-72"
          />
          <span className="text-xs text-muted-foreground">
            {users.length} account{users.length !== 1 ? 's' : ''}
          </span>
        </div>
        <Button size="sm" className="h-8 gap-1.5" onClick={() => setShowCreate(true)}>
          <UserPlus className="h-3.5 w-3.5" />
          Create client account
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border/50 rounded-lg">
          <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {users.length === 0 ? 'No client accounts yet.' : 'No accounts match your search.'}
          </p>
        </div>
      ) : (
        <Card className="border border-border/60 overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  {['Name', 'Email', 'Company', 'Status', 'Created'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(user => (
                  <tr key={user.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">{user.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="font-medium">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Mail className="h-3 w-3 opacity-60 shrink-0" />
                        {user.email}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user.company ? (
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Building2 className="h-3 w-3 opacity-60 shrink-0" />
                          {user.company}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border capitalize', USER_STATUS_STYLES[user.status])}>
                        {user.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3 opacity-50 shrink-0" />
                        {user.createdAt ? format(new Date(user.createdAt), 'MMM d, yyyy') : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" title="Reset password" onClick={() => setResetTarget(user)}>
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" title="Delete account" onClick={() => setDeleteTarget(user)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <CreateClientUserDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onDone={() => queryClient.invalidateQueries({ queryKey: ['agency-client-users'] })}
      />
      <ResetPasswordDialog user={resetTarget} onClose={() => setResetTarget(null)} />
      <DeleteConfirmDialog
        user={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={(userId) => deleteMutation.mutate(userId)}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
