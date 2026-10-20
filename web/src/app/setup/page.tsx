'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
    ArrowRight,
    Eye,
    EyeOff,
    Loader2,
    Lock,
    Mail,
    User,
    CheckCircle,
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuthStore';
import { isEnterprise } from '@/lib/features';
import { motion } from 'framer-motion';
import { useT } from '@/lib/i18n';

export default function SetupPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [setupAlreadyDone, setSetupAlreadyDone] = useState(false);
    const [checking, setChecking] = useState(true);
    const { toast } = useToast();
    const router = useRouter();
    const { isAuthenticated, setAuth } = useAuth();
    const t = useT().auth.setup;

    useEffect(() => {
        if (isEnterprise) {
            router.replace('/signup');
            return;
        }
        if (isAuthenticated) {
            router.replace('/websites');
            return;
        }

        // Check if setup has already been completed
        const checkSetupStatus = async () => {
            try {
                const res = await api.get('/user/auth/setup-status');
                if (res.data?.data?.setupComplete) {
                    setSetupAlreadyDone(true);
                }
            } catch {
                // If endpoint doesn't exist (404) or fails, allow setup
                // This ensures first-time installs work before backend adds the endpoint
            } finally {
                setChecking(false);
            }
        };
        checkSetupStatus();
    }, [isEnterprise, isAuthenticated, router]);

    if (isEnterprise || isAuthenticated) return null;

    // Loading state while checking setup status
    if (checking) {
        return (
            <div className="min-h-screen bg-transparent flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
        );
    }

    // Setup already completed — show message and redirect link
    if (setupAlreadyDone) {
        return (
            <div className="min-h-screen bg-transparent selection:bg-primary/20 flex items-center justify-center p-6">
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full animate-pulse" />
                    <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-500/5 blur-[100px] rounded-full animate-pulse delay-1000" />
                </div>

                <div className="relative z-10 w-full max-w-lg text-center">
                    <div className="mb-8">
                        <Link href="/" className="inline-flex items-center gap-3 group mb-8">
                            <Logo size="xl" />
                            <span className="text-2xl font-black tracking-tighter group-hover:text-primary transition-colors text-foreground">SEENTICS</span>
                        </Link>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="bg-card rounded-lg p-8 shadow-2xl shadow-indigo-500/10 border border-border/50"
                    >
                        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-black tracking-tight mb-2 text-foreground">{t.alreadyTitle}</h2>
                        <p className="text-muted-foreground mb-6">
                            {t.alreadyBody}
                        </p>
                        <Link href="/signin">
                            <Button className="w-full h-14 font-bold text-lg rounded-lg shadow-xl shadow-primary/20">
                                {t.goToSignIn} <ArrowRight size={18} className="ml-2" />
                            </Button>
                        </Link>
                    </motion.div>
                </div>
            </div>
        );
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (error) setError(null);
    };

    const validateForm = () => {
        if (!formData.name.trim()) {
            setError(t.nameRequired);
            return false;
        }
        if (!formData.email.trim()) {
            setError(t.emailRequired);
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            setError(t.invalidEmail);
            return false;
        }
        if (!formData.password) {
            setError(t.passwordRequired);
            return false;
        }
        if (formData.password.length < 8) {
            setError(t.passwordShort);
            return false;
        }
        if (formData.password !== formData.confirmPassword) {
            setError(t.passwordMismatch);
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        try {
            setError(null);
            setIsLoading(true);

            await api.post('/user/auth/register', {
                name: formData.name.trim(),
                email: formData.email.trim(),
                password: formData.password,
            });

            const loginResponse = await api.post('/user/auth/login', {
                email: formData.email.trim(),
                password: formData.password,
            });

            const data = loginResponse.data;

            if (data.data?.tokens && data.data?.user) {
                setAuth({
                    user: data.data.user,
                    access_token: data.data.tokens.access_token,
                    refresh_token: data.data.tokens.refresh_token,
                    rememberMe: false,
                });
            }

            toast({
                title: t.completeTitle,
                description: t.completeBody,
            });

            router.push('/websites');
        } catch (err: any) {
            console.error('Setup error:', err);
            setError(err.message || t.failed);
            toast({
                title: t.failedTitle,
                description: err.message || t.failedBody,
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-transparent selection:bg-primary/20 flex items-center justify-center p-6">
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-500/5 blur-[100px] rounded-full animate-pulse delay-1000" />
            </div>

            <div className="relative z-10 w-full max-w-lg">
                <div className="mb-12 text-center">
                    <Link href="/" className="inline-flex items-center gap-3 group mb-8">
                        <Logo size="xl" />
                        <span className="text-2xl font-black tracking-tighter group-hover:text-primary transition-colors text-foreground">SEENTICS</span>
                    </Link>
                    <h2 className="text-4xl font-black tracking-tight mb-3 text-foreground">{t.title}</h2>
                    <p className="text-muted-foreground font-medium">{t.subtitle}</p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="bg-card rounded-lg p-8 shadow-2xl shadow-indigo-500/10 border border-border/50"
                >
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t.fullName}</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input
                                        name="name"
                                        type="text"
                                        placeholder={t.namePlaceholder}
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        className="h-14 pl-12 bg-background border-none rounded-lg font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t.email}</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input
                                        name="email"
                                        type="email"
                                        placeholder="admin@example.com"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        className="h-14 pl-12 bg-background border-none rounded-lg font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t.password}</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        className="h-14 pl-12 pr-12 bg-background border-none rounded-lg font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                                        required
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? t.hidePassword : t.showPassword} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors">
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t.confirmPassword}</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input
                                        name="confirmPassword"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={formData.confirmPassword}
                                        onChange={handleInputChange}
                                        className="h-14 pl-12 bg-background border-none rounded-lg font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-16 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg rounded-lg shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
                        >
                            {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : (
                                <span className="flex items-center gap-2">
                                    {t.submit} <ArrowRight size={18} />
                                </span>
                            )}
                        </Button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-border/50 text-center">
                        <p className="text-sm font-medium text-muted-foreground">
                            {t.alreadySetUp}{' '}
                            <Link href="/signin" className="text-primary font-black hover:underline uppercase tracking-widest text-xs">
                                {t.signIn}
                            </Link>
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
