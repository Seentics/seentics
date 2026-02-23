'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/stores/useAuthStore';
import { redirect } from 'next/navigation';
import { isEnterprise } from '@/lib/features';
import api from '@/lib/api';
import {
    Users,
    Search,
    MoreVertical,
    Shield,
    User as UserIcon,
    XCircle,
    Loader2,
    Calendar,
    Crown,
    UserCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UserRecord {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    role: string;
    createdAt: string;
}

export default function UsersManagement() {
    const { user: currentUser, isAuthenticated, isLoading: authLoading } = useAuth();
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchUsers = useCallback(async () => {
        try {
            const response = await api.get('/admin/users');
            setUsers(response.data.data || []);
        } catch {
            toast.error('Failed to load users');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!authLoading && isAuthenticated && currentUser?.role === 'admin') {
            fetchUsers();
        }
    }, [authLoading, isAuthenticated, currentUser, fetchUsers]);

    const updateRole = async (userId: string, newRole: string) => {
        try {
            await api.put(`/admin/users/${userId}/role`, { role: newRole });
            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
            toast.success(`User role updated to ${newRole}`);
        } catch {
            toast.error('Failed to update user role');
        }
    };

    if (authLoading) return null;

    if (!isAuthenticated || !isEnterprise || currentUser?.role !== 'admin') {
        redirect('/');
    }

    if (isLoading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-4">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-primary/20 rounded-full" />
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin absolute inset-0" />
                </div>
                <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Loading Users...</p>
            </div>
        </div>
    );

    const filteredUsers = users.filter(u =>
        !searchQuery ||
        u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const adminCount = users.filter(u => u.role === 'admin').length;
    const userCount = users.filter(u => u.role !== 'admin').length;

    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'N/A';
        try {
            return new Date(dateStr).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            });
        } catch {
            return 'N/A';
        }
    };

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-black tracking-tight">User Management</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">Manage platform access and assign roles.</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Stat badges */}
                    <div className="hidden md:flex items-center gap-2">
                        <Badge variant="outline" className="bg-violet-500/10 text-violet-400 border-violet-500/20 font-bold text-xs gap-1 py-1">
                            <Crown className="w-3 h-3" /> {adminCount} Admin{adminCount !== 1 ? 's' : ''}
                        </Badge>
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 font-bold text-xs gap-1 py-1">
                            <UserCheck className="w-3 h-3" /> {userCount} User{userCount !== 1 ? 's' : ''}
                        </Badge>
                    </div>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search by name or email..."
                            className="pl-9 bg-muted/30 border-border/30 h-9 text-xs"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <Card className="bg-card/60 backdrop-blur-sm border-border/30 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-muted/30 border-b border-border/20">
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">User</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Role</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Joined</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/10">
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-muted/20 transition-colors group">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="w-9 h-9 ring-1 ring-border/20">
                                                <AvatarImage src={user.avatar} />
                                                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                                    {(user.name?.charAt(0) || user.email?.charAt(0) || '?').toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="font-bold text-sm">{user.name || 'Anonymous'}</div>
                                                <div className="text-[11px] text-muted-foreground">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "capitalize font-bold text-[10px] uppercase tracking-wider",
                                                user.role === 'admin'
                                                    ? "bg-violet-500/10 text-violet-400 border-violet-500/20"
                                                    : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                            )}
                                        >
                                            {user.role === 'admin' && <Crown className="w-3 h-3 mr-1" />}
                                            {user.role}
                                        </Badge>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Calendar className="w-3 h-3" />
                                            {formatDate(user.createdAt)}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-50 group-hover:opacity-100 transition-opacity">
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-44">
                                                <DropdownMenuLabel className="text-[10px] uppercase tracking-widest">Change Role</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => updateRole(user.id, 'admin')}
                                                    disabled={user.role === 'admin'}
                                                >
                                                    <Shield className="w-4 h-4 mr-2" /> Promote to Admin
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => updateRole(user.id, 'user')}
                                                    disabled={user.role === 'user'}
                                                >
                                                    <UserIcon className="w-4 h-4 mr-2" /> Demote to User
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-red-400 focus:text-red-400">
                                                    <XCircle className="w-4 h-4 mr-2" /> Suspend
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredUsers.length === 0 && (
                    <div className="p-12 text-center text-muted-foreground bg-muted/5">
                        <Users className="w-10 h-10 mx-auto opacity-15 mb-3" />
                        <p className="font-bold text-sm">No users found</p>
                        <p className="text-xs mt-0.5">Try adjusting your search criteria.</p>
                    </div>
                )}
            </Card>
        </div>
    );
}
