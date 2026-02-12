'use client';

import React, { useState, useRef } from 'react';
import { useAuth } from '@/stores/useAuthStore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Save, 
  User, 
  Mail, 
  Camera, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
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
    
    if (file.size > 2 * 1024 * 1024) { // 2MB limit
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Left Column: Avatar & Basic Info */}
      <div className="lg:col-span-1 space-y-6">
        <Card className="overflow-hidden border-border/40 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="pb-0 pt-8 flex flex-col items-center">
            <div className="relative group">
              <Avatar className="h-32 w-32 ring-4 ring-primary/10 transition-transform group-hover:scale-[1.02]">
                <AvatarImage src={user.avatar || undefined} alt={user.name} />
                <AvatarFallback className="text-3xl font-black bg-primary text-primary-foreground">
                  {user.name?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute bottom-0 right-0 h-10 w-10 rounded-full shadow-lg border border-border/40"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isAvatarLoading}
                    >
                      {isAvatarLoading ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      ) : (
                        <Camera className="h-5 w-5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Click to update avatar</TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
            <div className="text-center pt-4 pb-6">
              <h3 className="text-xl font-black text-foreground uppercase tracking-tight">{user.name}</h3>
              <p className="text-sm text-muted-foreground font-medium italic opacity-70">{user.email}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <Separator className="opacity-40" />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Status</span>
                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                  {user.isActive ? 'Active' : 'Pending'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Identity</span>
                <span className="text-[11px] font-bold text-foreground">
                  {oauthProvider ? oauthProvider.name : 'Standard'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Forms */}
      <div className="lg:col-span-2 space-y-8">
        {/* Profile Info Form */}
        <Card className="border-border/40 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
              <User className="h-5 w-5 text-primary" />
              General Information
            </CardTitle>
            <CardDescription className="text-sm font-medium">Update your public profile and account email.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest ml-1 opacity-60 text-muted-foreground">Display Name</Label>
                  <Input
                    id="name"
                    value={profileData.name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your name"
                    className="h-11 font-bold bg-accent/5"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest ml-1 opacity-60 text-muted-foreground">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email"
                    disabled={!!oauthProvider}
                    className="h-11 font-bold bg-accent/5 opacity-80"
                    required
                  />
                </div>
              </div>
              <Button type="submit" disabled={isLoading} className="w-full h-12 font-black uppercase tracking-widest gap-2">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" /> : <Save className="h-4 w-4" />}
                Save Profile Changes
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Password Form */}
        {!oauthProvider && (
          <Card className="border-border/40 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
                <Lock className="h-5 w-5 text-primary" />
                Security & Password
              </CardTitle>
              <CardDescription className="text-sm font-medium">Ensure your account stays protected with a strong password.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="current-password text-[10px]" className="text-[10px] font-black uppercase tracking-widest ml-1 opacity-60 text-muted-foreground">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showPassword ? "text" : "password"}
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      className="h-11 font-bold bg-accent/5"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-9 w-9 text-muted-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-[10px] font-black uppercase tracking-widest ml-1 opacity-60 text-muted-foreground">New Password</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                        className="h-11 font-bold bg-accent/5"
                        required
                        minLength={8}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1 h-9 w-9 text-muted-foreground"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-[10px] font-black uppercase tracking-widest ml-1 opacity-60 text-muted-foreground">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className="h-11 font-bold bg-accent/5"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1 h-9 w-9 text-muted-foreground"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={isPasswordLoading} variant="outline" className="w-full h-12 font-black uppercase tracking-widest border-2 hover:bg-accent/5">
                  {isPasswordLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  Update Security Credentials
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>

    </div>
  );
}

