'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Settings,
  User,
  Mail,
  Lock,
  Save,
  Loader2,
  Eye,
  EyeOff,
  Key,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

export default function WorkspaceSettingsPage() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();

  // Profile
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/workspace">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-bold text-lg">Workspace Settings</h1>
            <p className="text-[10px] text-muted-foreground -mt-0.5">Manage your account and preferences</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Profile Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <User className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Profile</h2>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Display Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="h-10"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
              <Input
                value={email}
                disabled
                className="h-10 opacity-60"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Email cannot be changed</p>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={savingProfile || !name.trim()} size="sm" className="gap-1.5">
                {savingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save Profile
              </Button>
            </div>
          </div>
        </section>

        {/* Password Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Change Password</h2>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Current Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
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
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">New Password</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 8 chars)"
                className="h-10"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Confirm New Password</label>
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
                Change Password
              </Button>
            </div>
          </div>
        </section>

        {/* API Keys Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Key className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">API Keys</h2>
          </div>
          <div className="rounded-xl border border-dashed border-border/50 bg-card/50 p-8 text-center">
            <Key className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
            <h3 className="font-medium text-sm mb-1">API Keys</h3>
            <p className="text-xs text-muted-foreground">Generate API keys to integrate Seentics products with your applications.</p>
            <p className="text-xs text-muted-foreground mt-1 italic">Coming soon</p>
          </div>
        </section>
      </main>
    </div>
  );
}
