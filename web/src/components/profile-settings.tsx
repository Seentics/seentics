'use client';

import React, { useState, useRef } from 'react';
import { useAuth } from '@/stores/useAuthStore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Save,
  User,
  Camera,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Shield,
} from 'lucide-react';
import api from '@/lib/api';

export function ProfileSettings() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isAvatarLoading, setIsAvatarLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const getOAuthProvider = () => {
    if (user?.googleId) return { name: 'Google', color: 'bg-blue-500' };
    if (user?.githubId) return { name: 'GitHub', color: 'bg-gray-800' };
    return null;
  };

  const oauthProvider = getOAuthProvider();

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await api.put('/user/users/profile', profileData);

      if (response.data?.success) {
        setUser(response.data.data.user);
        toast({
          title: "Profile Updated",
          description: "Your profile has been updated successfully.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.response?.data?.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "New password and confirm password do not match.",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast({
        title: "Password Too Short",
        description: "New password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    setIsPasswordLoading(true);

    try {
      const response = await api.put('/user/users/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });

      if (response.data?.success) {
        toast({
          title: "Password Changed",
          description: "Your password has been updated successfully.",
        });
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      }
    } catch (error: any) {
      toast({
        title: "Password Change Failed",
        description: error.response?.data?.message || "Failed to change password",
        variant: "destructive",
      });
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Avatar image must be less than 2MB.",
        variant: "destructive",
      });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid Type",
        description: "Please upload JPEG, PNG, or WebP.",
        variant: "destructive",
      });
      return;
    }

    setIsAvatarLoading(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await api.put('/user/users/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data?.success) {
        setUser(response.data.data.user);
        toast({
          title: "Avatar Updated",
          description: "Profile picture refreshed.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.response?.data?.message || "Failed to update avatar",
        variant: "destructive",
      });
    } finally {
      setIsAvatarLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Avatar & Identity */}
      <Card className="border border-border/60 bg-card shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start gap-5">
            <div className="relative group">
              <Avatar className="h-20 w-20 ring-2 ring-border/40">
                <AvatarImage src={user.avatar || undefined} alt={user.name} />
                <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                  {user.name?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <button
                className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-background border border-border shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
                onClick={() => fileInputRef.current?.click()}
                disabled={isAvatarLoading}
              >
                {isAvatarLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Camera className="h-3 w-3 text-muted-foreground" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAvatarUpload(file);
                }}
                className="hidden"
              />
            </div>

            <div className="flex-1 min-w-0 pt-1">
              <h3 className="text-base font-semibold text-foreground">{user.name}</h3>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                  {user.isActive ? 'Active' : 'Pending'}
                </Badge>
                {oauthProvider && (
                  <Badge variant="outline" className="text-[10px] font-medium">
                    {oauthProvider.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Form */}
      <Card className="border border-border/60 bg-card shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">General Information</h3>
              <p className="text-xs text-muted-foreground">Update your display name and email address.</p>
            </div>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium text-muted-foreground">Display Name</Label>
                <Input
                  id="name"
                  value={profileData.name}
                  onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter your name"
                  className="h-9 text-sm"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email"
                  disabled={!!oauthProvider}
                  className="h-9 text-sm disabled:opacity-60"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button type="submit" size="sm" disabled={isLoading} className="gap-1.5 text-xs font-medium">
                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Password */}
      {!oauthProvider && (
        <Card className="border border-border/60 bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="h-8 w-8 rounded-md bg-amber-500/10 flex items-center justify-center">
                <Shield className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Security</h3>
                <p className="text-xs text-muted-foreground">Update your password to keep your account secure.</p>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="current-password" className="text-xs font-medium text-muted-foreground">Current Password</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showPassword ? "text" : "password"}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                    className="h-9 text-sm pr-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0.5 top-0.5 h-8 w-8 text-muted-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              <Separator className="opacity-40" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password" className="text-xs font-medium text-muted-foreground">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                      className="h-9 text-sm pr-10"
                      required
                      minLength={8}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0.5 top-0.5 h-8 w-8 text-muted-foreground"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className="text-xs font-medium text-muted-foreground">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="h-9 text-sm pr-10"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0.5 top-0.5 h-8 w-8 text-muted-foreground"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button type="submit" size="sm" variant="outline" disabled={isPasswordLoading} className="gap-1.5 text-xs font-medium">
                  {isPasswordLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                  Update Password
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
