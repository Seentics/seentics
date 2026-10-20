'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useState, useEffect } from 'react';

import { useAuth } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User, Lock, Save, Loader2, Eye, EyeOff, Key, Trash2, Languages } from 'lucide-react';
import { DeleteAccountCard } from '@/components/settings/DeleteAccountCard';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { isEnterprise } from '@/lib/features';
import { LOCALES, useLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * The server's minimum: the cloud gateway requires 12 (gateway/validators/auth.ts), the
 * self-hosted core 8 (core/modules/auth/validators). A fixed 8 let a cloud user submit a
 * password the gateway then refused.
 */
const MIN_PASSWORD_LENGTH = isEnterprise ? 12 : 8;
import { Card, CardContent } from '@/components/ui/card';
import { isDemo, demoMutationGuard } from '@/lib/demo';

export default function ProfileSettingsPage() {
  const params = { websiteId: usePathSegment(1) ?? '' };
  const { user, setUser, setTokens } = useAuth();
  const { toast } = useToast();
  const tAll = useT();
  const t = tAll.settings.profile;
  const { locale, setLocale } = useLocale();

  const demo = isDemo(params.websiteId);
  const [name, setName] = useState(user?.name || (demo ? 'Alex Morgan' : ''));
  const [email, setEmail] = useState(user?.email || (demo ? 'alex@seentics.com' : ''));
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
    } else if (demo) {
      // The site id is read after the first render, so this cannot be the initial state.
      setName('Alex Morgan');
      setEmail('alex@seentics.com');
    }
  }, [user, demo]);

  const handleSaveProfile = async () => {
    if (!name.trim()) return;
    if (demoMutationGuard(params.websiteId)) return;
    setSavingProfile(true);
    try {
      await api.put('/user/users/profile', { name: name.trim() });
      setUser({ ...user!, name: name.trim() });
      toast({ title: t.profileUpdated, description: t.profileUpdatedBody });
    } catch {
      toast({ title: t.errorTitle, description: t.profileFailed, variant: 'destructive' });
    }
    setSavingProfile(false);
  };

  const handleChangePassword = async () => {
    if (demoMutationGuard(params.websiteId)) return;
    if (!currentPassword || !newPassword) return;
    if (newPassword !== confirmPassword) {
      toast({ title: t.mismatch, description: t.mismatchBody, variant: 'destructive' });
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast({ title: t.tooShort, description: t.tooShortBody(MIN_PASSWORD_LENGTH), variant: 'destructive' });
      return;
    }
    setSavingPassword(true);
    try {
      const res = await api.put('/user/users/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      // The change ends every session issued under the old password, this one included;
      // the server hands back a fresh pair so this tab stays signed in.
      const tokens = res.data?.data?.tokens;
      if (tokens?.access_token && tokens?.refresh_token) setTokens(tokens);
      toast({ title: t.passwordChanged, description: t.passwordChangedBody });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      toast({ title: t.errorTitle, description: t.passwordFailed, variant: 'destructive' });
    }
    setSavingPassword(false);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-500 max-w-2xl">
      <DashboardPageHeader
        title={t.title}
        description={t.description}
      />

      <section className="space-y-2.5">
        <div className="flex items-center gap-2 px-1">
          <User className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">{t.account}</h2>
        </div>
        <Card className="border border-border bg-card shadow-md hover:shadow-lg transition-all duration-200">
          <CardContent className="space-y-4 p-6">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t.displayName}</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} className="h-10" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t.email}</label>
              <Input value={email} disabled className="h-10 opacity-60" />
              <p className="mt-1 text-[10px] text-muted-foreground">{t.emailLocked}</p>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={savingProfile || !name.trim()} size="sm" className="gap-1.5">
                {savingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {tAll.actions.save}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-2.5">
        <div className="flex items-center gap-2 px-1">
          <Languages className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">{t.language}</h2>
        </div>
        <Card className="border border-border bg-card shadow-md hover:shadow-lg transition-all duration-200">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-6">
            <p className="text-xs text-muted-foreground">{t.languageHint}</p>
            <div role="radiogroup" aria-label={tAll.language.label} className="inline-flex rounded-md border border-border p-0.5">
              {LOCALES.map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={locale === l}
                  lang={l}
                  onClick={() => setLocale(l)}
                  className={cn(
                    'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                    locale === l ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tAll.language[l]}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-2.5">
        <div className="flex items-center gap-2 px-1">
          <Lock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">{t.changePassword}</h2>
        </div>
        <Card className="border border-border bg-card shadow-md hover:shadow-lg transition-all duration-200">
          <CardContent className="space-y-4 p-6">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t.currentPassword}</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t.currentPassword}
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t.hidePassword : t.showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t.newPassword}</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t.atLeast(MIN_PASSWORD_LENGTH)}
                className="h-10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t.confirmPassword}</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t.confirmPassword}
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
                {t.updatePassword}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* The cloud gateway answers this; a self-hosted install's accounts are its operator's. */}
      {isEnterprise && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2 px-1">
            <Trash2 className="h-4 w-4 text-destructive" />
            <h2 className="text-sm font-semibold text-foreground">{t.deleteAccount}</h2>
          </div>
          <DeleteAccountCard />
        </section>
      )}
    </div>
  );
}
