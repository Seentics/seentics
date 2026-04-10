'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
    Eye,
    EyeOff,
    Loader2,
    Lock,
    Mail,
    ArrowRight,
    BarChart3,
    Globe,
    Target,
    Shield,
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuthStore';
import { isEnterprise } from '@/lib/features';
import { getGatewayBaseUrlForRedirect } from '@/lib/config';

const features = [
    { icon: BarChart3, text: 'Real-time analytics with sub-second latency' },
    { icon: Globe, text: 'Traffic sources, countries, devices, and browser insights' },
    { icon: Target, text: 'Goals, funnels, and conversion-focused reporting' },
    { icon: Shield, text: 'Privacy-first, GDPR compliant, no cookies' },
];

export default function SignInPage() {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isLocal, setIsLocal] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const { setAuth } = useAuth();

    useEffect(() => {
        const h = window.location.hostname;
        setIsLocal(h === 'localhost' || h === '127.0.0.1');
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (error) setError(null);
    };

    const validateForm = () => {
        if (!formData.email.trim()) { setError('Email is required'); return false; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) { setError('Please enter a valid email address'); return false; }
        if (!formData.password) { setError('Password is required'); return false; }
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
                    access_token: data.data.tokens.access_token,
                    refresh_token: data.data.tokens.refresh_token,
                    rememberMe: false
                });
            }
            router.push('/websites');
            toast({ title: "Welcome back!", description: "You have successfully signed in." });
        } catch (error: any) {
            setError(error.message || 'Sign in failed');
            toast({ title: "Sign In Failed", description: error.message || 'Sign in failed', variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const oauthBase = getGatewayBaseUrlForRedirect();

    return (
        <div className="min-h-screen bg-background flex">
            {/* Left — Info Panel (hidden on mobile) */}
            <div className="hidden lg:flex lg:w-1/2 bg-primary/[0.03] border-r border-border/40 flex-col justify-center px-16 py-12">
                <Link href="/" className="inline-flex items-center gap-2 mb-12">
                    <Logo size="lg" />
                    <span className="text-xl font-bold tracking-tight text-foreground">SEENTICS</span>
                </Link>

                <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">
                    Analytics that respect your users.
                </h1>
                <p className="text-muted-foreground mb-10 max-w-md leading-relaxed">
                    Understand traffic, behavior, and conversions without compromising privacy. Built for focused product analytics.
                </p>

                <div className="space-y-5">
                    {features.map((f) => (
                        <div key={f.text} className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                <f.icon className="h-4 w-4 text-primary" />
                            </div>
                            <span className="text-sm text-foreground/80 leading-relaxed pt-1">{f.text}</span>
                        </div>
                    ))}
                </div>

                <p className="text-xs text-muted-foreground/50 mt-16">
                    Free forever for 1 website · No credit card required
                </p>
            </div>

            {/* Right — Auth Form */}
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-sm">
                    {/* Mobile logo */}
                    <div className="lg:hidden text-center mb-10">
                        <Link href="/" className="inline-flex items-center gap-2">
                            <Logo size="lg" />
                            <span className="text-xl font-bold tracking-tight text-foreground">SEENTICS</span>
                        </Link>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-2xl font-bold tracking-tight text-foreground mb-1">Welcome back</h2>
                        <p className="text-sm text-muted-foreground">Sign in to your account to continue.</p>
                    </div>

                    {/* OAuth Buttons */}
                    <div className="space-y-3 mb-6">
                        <button
                            type="button"
                            onClick={() => { window.location.href = `${oauthBase}/user/auth/google`; }}
                            className="w-full h-11 rounded-lg border border-border bg-white hover:bg-gray-50 transition-colors flex items-center justify-center gap-3 text-sm font-medium text-gray-700"
                        >
                            <svg className="h-4 w-4" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335" />
                            </svg>
                            Continue with Google
                        </button>

                        <button
                            type="button"
                            onClick={() => { window.location.href = `${oauthBase}/user/auth/github`; }}
                            className="w-full h-11 rounded-lg border border-transparent bg-[#24292f] hover:bg-[#2f363d] transition-colors flex items-center justify-center gap-3 text-sm font-medium text-white"
                        >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                            </svg>
                            Continue with GitHub
                        </button>
                    </div>

                    {/* Email/Password — local dev or OSS only */}
                    {(!isEnterprise || isLocal) && (
                    <>
                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-border" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">or</span>
                            </div>
                        </div>

                        <form onSubmit={handleEmailSignIn} className="space-y-4">
                            {error && (
                                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        name="email"
                                        type="email"
                                        placeholder="you@example.com"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        className="h-10 pl-10 text-sm"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-medium text-muted-foreground">Password</label>
                                    <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                                        Forgot?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        className="h-10 pl-10 pr-10 text-sm"
                                        required
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-10 text-sm font-medium"
                            >
                                {isLoading ? <Loader2 className="animate-spin h-4 w-4" /> : (
                                    <span className="flex items-center gap-2">
                                        Sign in <ArrowRight size={14} />
                                    </span>
                                )}
                            </Button>
                        </form>
                    </>
                    )}

                    <div className="mt-8 text-center">
                        <p className="text-sm text-muted-foreground">
                            {isEnterprise ? (
                                <>Don&apos;t have an account?{' '}
                                    <Link href="/signup" className="text-primary font-medium hover:underline">
                                        Sign up
                                    </Link>
                                </>
                            ) : (
                                <>First time?{' '}
                                    <Link href="/setup" className="text-primary font-medium hover:underline">
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
