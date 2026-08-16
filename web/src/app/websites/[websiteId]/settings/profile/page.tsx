'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User, Lock, Save, Loader2, Eye, EyeOff, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Card, CardContent } from '@/components/ui/card';

export default function ProfileSettingsPage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;
  const { user, setUser } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!name.trim()) return;
    setSavingProfile(true);
    try {
      await api.put('/user/users/profile', { name: name.trim() });
      setUser({ ...user!, name: name.trim() });
      toast({ title: 'Profile updated', description: 'Your name has been updated successfully.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to update profile.', variant: 'destructive' });
    }
    setSavingProfile(false);
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) return;
    if (newPassword !== confirmPassword) {
      toast({ title: 'Mismatch', description: 'New passwords do not match.', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: 'Too short', description: 'Password must be at least 8 characters.', variant: 'destructive' });
      return;
    }
    setSavingPassword(true);
    try {
      await api.put('/user/users/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast({ title: 'Password changed', description: 'Your password has been updated.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      toast({ title: 'Error', description: 'Failed to change password. Check your current password.', variant: 'destructive' });
    }
    setSavingPassword(false);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-500 max-w-2xl">
      <DashboardPageHeader
        title="Profile"
        description="Your account display name, email, and password. Email is managed by your sign-in provider."
      />

      <section className="space-y-2.5">
        <div className="flex items-center gap-2 px-1">
          <User className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Account</h2>
        </div>
        <Card className="border border-border/40 bg-card shadow-md hover:shadow-lg transition-all duration-200">
          <CardContent className="space-y-4 p-6">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Display name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="h-10" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
              <Input value={email} disabled className="h-10 opacity-60" />
              <p className="mt-1 text-[10px] text-muted-foreground">Email cannot be changed here.</p>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={savingProfile || !name.trim()} size="sm" className="gap-1.5">
                {savingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-2.5">
        <div className="flex items-center gap-2 px-1">
          <Lock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Change password</h2>
        </div>
        <Card className="border border-border/40 bg-card shadow-md hover:shadow-lg transition-all duration-200">
          <CardContent className="space-y-4 p-6">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Current password</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">New password</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="h-10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Confirm new password</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="h-10"
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleChangePassword}
                disabled={savingPassword || !currentPassword || !newPassword}
                size="sm"
                className="gap-1.5"
              >
                {savingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Key className="h-3.5 w-3.5" />}
                Update password
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
