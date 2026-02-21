'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
    AlertCircle,
    ArrowLeft,
    Eye,
    EyeOff,
    Loader2,
    Lock,
    Mail,
    ArrowRight,
    ShieldCheck,
    Quote
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuthStore';
import { motion } from 'framer-motion';
import { isEnterprise } from '@/lib/features';

export default function SignInPage() {
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const { setAuth } = useAuth();

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        if (error) setError(null);
    };

    const validateForm = () => {
        if (!formData.email.trim()) {
            setError('Email is required');
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            setError('Please enter a valid email address');
            return false;
        }
        if (!formData.password) {
            setError('Password is required');
            return false;
        }
        return true;
    };

    const handleEmailSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        try {
            setError(null);
            setIsLoading(true);

            const response = await api.post('/user/auth/login', {
                email: formData.email.trim(),
                password: formData.password,
            });

            const data = response.data;

            if (data.data?.tokens && data.data?.user) {
                setAuth({
                    user: data.data.user,
                    access_token: data.data.tokens.accessToken,
                    refresh_token: data.data.tokens.refreshToken,
                    rememberMe: false
                });
            }

            router.push('/websites');

            toast({
                title: "Welcome back!",
                description: "You have successfully signed in.",
            });

        } catch (error: any) {
            console.error('Sign in error:', error);
            setError(error.message || 'Sign in failed');
            toast({
                title: "Sign In Failed",
                description: error.message || 'Sign in failed',
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                <div className="mb-12 text-center">
                    <Link href="/" className="inline-flex items-center gap-2 group mb-8">
                        <Logo size="lg" />
                        <span className="text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">SEENTICS</span>
                    </Link>
                    <h2 className="text-3xl font-bold tracking-tight mb-2 text-foreground">Welcome back.</h2>
                    <p className="text-muted-foreground">Log in to your account to continue.</p>
                </div>

                <div className="bg-card rounded-lg p-8 border border-border mt-4">
                    <div className="space-y-4 mb-8">
                        <Button
                            variant="outline"
                            type="button"
                            className="w-full h-14 bg-background border-border hover:bg-accent hover:text-accent-foreground dark:hover:bg-slate-800 dark:hover:border-slate-700 text-foreground font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-3 shadow-sm hover:shadow-md"
                            onClick={() => {
                                const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
                                window.location.href = `${backendUrl}/user/auth/google`;
                            }}
                        >
                            <svg className="h-5 w-5" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                            Continue with Google
                        </Button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-border" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-card px-2 text-muted-foreground font-black tracking-widest">Or continue with email</span>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleEmailSignIn} className="space-y-6">
                        {error && (
                            <div className="p-4 rounded bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-1.5 ">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email Address</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input
                                        name="email"
                                        type="email"
                                        placeholder="elon@x.com"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        className="h-14 pl-12 bg-background border-none rounded font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center pr-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Security Phrase</label>
                                    <Link href="/forgot-password" className="text-[10px] font-black text-primary hover:underline uppercase tracking-widest">
                                        Forgot?
                                    </Link>
                                </div>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        className="h-14 pl-12 pr-12 bg-background border-none rounded font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                                        required
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors">
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-16 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg rounded-xl shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
                        >
                            {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : (
                                <span className="flex items-center gap-2">
                                    Sign in <ArrowRight size={18} />
                                </span>
                            )}
                        </Button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-border/50 text-center">
                        <p className="text-sm font-medium text-muted-foreground">
                            {isEnterprise ? (
                                <>New to Seentics?{' '}
                                    <Link href="/signup" className="text-primary font-black hover:underline uppercase tracking-widest text-xs">
                                        Create Account
                                    </Link>
                                </>
                            ) : (
                                <>First time?{' '}
                                    <Link href="/setup" className="text-primary font-black hover:underline uppercase tracking-widest text-xs">
                                        Set Up Admin
                                    </Link>
                                </>
                            )}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
