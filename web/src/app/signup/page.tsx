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
    User,
    CheckCircle,
    Sparkles,
    Globe,
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuthStore';
import { AnimatePresence } from 'framer-motion';
import { TrackingCodeModal } from '@/components/websites/tracking-code-modal';
import { isEnterprise } from '@/lib/features';
import { getGatewayBaseUrlForRedirect } from '@/lib/config';
import { enterpriseAuthFeatures, enterpriseAuthMarketing } from '@/lib/enterprise-auth-marketing';

function SignUpFlow() {
    const router = useRouter();

    useEffect(() => {
        if (!isEnterprise) {
            router.replace('/setup');
        }
    }, [router]);

    if (!isEnterprise) return null;
    const searchParams = useSearchParams();
    const stepParam = searchParams.get('step');
    const [step, setStep] = useState(1);

    const { toast } = useToast();
    const { setAuth, isAuthenticated } = useAuth();

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
    });

    const [websiteData, setWebsiteData] = useState({
        siteName: '',
        siteUrl: '',
    });

    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showTrackingModal, setShowTrackingModal] = useState(false);
    const [newWebsiteId, setNewWebsiteId] = useState<string>('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLocal, setIsLocal] = useState(false);

    useEffect(() => {
        const h = window.location.hostname;
        setIsLocal(h === 'localhost' || h === '127.0.0.1');
    }, []);

    useEffect(() => {
        if (stepParam) {
            const s = parseInt(stepParam);
            if (s === 2 && isAuthenticated) {
                setStep(2);
            } else {
                setStep(1);
            }
        }
    }, [stepParam, isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated && step === 1) {
            updateStep(2);
        }
    }, [isAuthenticated, step]);

    const updateStep = (newStep: number) => {
        setStep(newStep);
        const params = new URLSearchParams(searchParams.toString());
        params.set('step', newStep.toString());
        router.push(`/signup?${params.toString()}`);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (error) setError(null);
    };

    const validateStep1 = () => {
        if (!formData.name.trim()) { setError('Name is required'); return false; }
        if (!formData.email.trim()) { setError('Email is required'); return false; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) { setError('Please enter a valid email address'); return false; }
        if (formData.password.length < 8) { setError('Password must be at least 8 characters long'); return false; }
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) { setError('Password must contain at least one uppercase letter, one lowercase letter, and one number'); return false; }
        if (formData.password !== formData.confirmPassword) { setError('Passwords do not match'); return false; }
        return true;
    };

    const handleAccountSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateStep1()) return;

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

            const authData = loginResponse.data.data;

            if (authData?.tokens && authData?.user) {
                setAuth({
                    user: authData.user,
                    access_token: authData.tokens.access_token,
                    refresh_token: authData.tokens.refresh_token,
                    rememberMe: false
                });
            }

            try {
                await api.post('/user/billing/select-free');
            } catch {
                // Non-critical
            }

            toast({
                title: "Account Created!",
                description: "You're on the free Starter plan. Let's add your first website.",
            });

            updateStep(2);

        } catch (error: any) {
            console.error('Signup error:', error);
            setError(error.message || 'Registration failed');
            toast({
                title: "Registration Failed",
                description: error.message || 'Registration failed',
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleWebsiteSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const { siteName, siteUrl } = websiteData;

        if (!siteName.trim()) {
            toast({ title: "Validation Error", description: "Please provide a website name.", variant: "destructive" });
            return;
        }

        if (!siteUrl.trim()) {
            toast({ title: "Validation Error", description: "Please provide a valid domain name.", variant: "destructive" });
            return;
        }

        const domainRegex = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
        const cleanUrl = siteUrl.replace(/^(https?:\/\/)/, '').replace(/\/$/, '');

        if (!domainRegex.test(cleanUrl)) {
            toast({ title: "Invalid Domain", description: "Please provide a valid domain name (e.g. example.com).", variant: "destructive" });
            return;
        }

        try {
            setIsLoading(true);
            const normalizedUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
            const response = await api.post('/user/websites', {
                name: siteName.trim(),
                url: normalizedUrl
            });

            const website = response.data.data?.website ?? response.data.data;
            setNewWebsiteId(website.site_id || website.id);
            setShowTrackingModal(true);

            toast({ title: "Success", description: "Your website has been added. Welcome to Seentics!" });
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.response?.data?.message || error.message || 'Failed to add website',
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const oauthBase = getGatewayBaseUrlForRedirect();

    return (
        <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-background lg:flex-row">
            {/* Left — Info Panel (hidden on mobile) */}
            <div className="hidden min-h-0 overflow-y-auto bg-muted/40 lg:flex lg:w-1/2 lg:flex-col lg:justify-center lg:rounded-r-3xl lg:border-y lg:border-r lg:border-border/50 dark:bg-muted/15">
                <div className="px-12 py-10 xl:px-16">
                    <Link
                        href="/"
                        className="mb-10 inline-flex items-center gap-2.5 text-foreground hover:opacity-80"
                    >
                        <Logo size="lg" />
                        <span className="font-headline text-xl font-semibold tracking-tight">SEENTICS</span>
                    </Link>

                    <h1 className="font-headline mb-3 max-w-lg text-3xl font-semibold leading-tight tracking-tight text-foreground md:text-[1.75rem]">
                        {enterpriseAuthMarketing.headline}
                    </h1>
                    <p className="mb-8 max-w-md text-sm leading-relaxed text-muted-foreground">
                        {enterpriseAuthMarketing.signupSubhead}
                    </p>

                    <ul className="max-w-lg space-y-4">
                        {enterpriseAuthFeatures.map((f) => (
                            <li key={f.text} className="flex gap-3">
                                <f.icon
                                    className="mt-0.5 h-4 w-4 shrink-0 text-primary/70 dark:text-primary/60"
                                    strokeWidth={1.75}
                                />
                                <span className="text-sm leading-snug text-foreground/90">{f.text}</span>
                            </li>
                        ))}
                    </ul>

                    <p className="mt-8 text-xs leading-relaxed text-muted-foreground">{enterpriseAuthMarketing.footnote}</p>
                </div>
            </div>

            {/* Right — Auth Form (scrolls inside viewport; page body does not) */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-4 pb-12 pt-10 sm:px-6 sm:pb-14 sm:pt-12 lg:justify-center lg:rounded-l-3xl lg:bg-background lg:pb-16 lg:pt-14">
                <div className="mx-auto w-full max-w-md lg:max-w-lg">
                    {/* Mobile: compact pitch — full bullet list only on desktop left panel */}
                    <div className="mb-5 space-y-3 text-center lg:hidden">
                        <Link href="/" className="inline-flex items-center gap-2 text-foreground">
                            <Logo size="md" />
                            <span className="font-headline text-lg font-semibold tracking-tight">SEENTICS</span>
                        </Link>
                        <div className="mx-auto max-w-sm px-1 py-1 text-left">
                            <p className="font-headline text-sm font-semibold leading-snug text-foreground">
                                {enterpriseAuthMarketing.headline}
                            </p>
                            <p className="mt-1 text-xs leading-snug text-muted-foreground">{enterpriseAuthMarketing.signupSubhead}</p>
                            <p className="mt-2 text-[11px] leading-snug text-foreground/85">{enterpriseAuthMarketing.mobileTeaser}</p>
                            <p className="mt-2 text-[10px] leading-snug text-muted-foreground">{enterpriseAuthMarketing.footnote}</p>
                        </div>
                    </div>

                    {/* Step Indicator
                    <div className="relative flex justify-stretch items-center h-10 px-16 mb-8">
                        <div className="absolute top-1/2 left-16 right-16 h-px bg-border -translate-y-1/2" />
                        {[
                            { id: 1, label: 'Signup' },
                            { id: 2, label: 'Website' }
                        ].map((s) => (
                            <div key={s.id} className="relative z-10 flex flex-col items-center">
                                <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${step >= s.id ? 'bg-primary border-primary text-primary-foreground' : 'bg-background border-border text-muted-foreground'}`}>
                                    {step > s.id ? <CheckCircle className="h-3.5 w-3.5" /> : <span className="text-[10px] font-bold">{s.id}</span>}
                                </div>
                                <span className={`absolute top-8 text-[10px] font-bold uppercase tracking-wider transition-all ${step === s.id ? 'text-primary' : 'text-muted-foreground opacity-60'}`}>
                                    {s.label}
                                </span>
                            </div>
                        ))}
                    </div> */}

                    <AnimatePresence mode="wait">
                        {step === 1 ? (
                            <div key="account">
                                <div className="mb-6 sm:mb-7">
                                    <h2 className="mb-1 font-headline text-2xl font-semibold tracking-tight text-foreground sm:text-[1.625rem]">Create your account</h2>
                                    <p className="text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">Start tracking for free in minutes.</p>
                                </div>

                                {/* OAuth Buttons */}
                                <div className="mb-5 space-y-2.5">
                                    <button
                                        type="button"
                                        onClick={() => { window.location.href = `${oauthBase}/user/auth/google`; }}
                                        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-white text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
                                    >
                                        <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" aria-hidden>
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
                                        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-transparent bg-[#24292f] text-sm font-medium text-white transition-colors hover:bg-[#2f363d]"
                                    >
                                        <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                                        </svg>
                                        Continue with GitHub
                                    </button>
                                </div>

                                <>
                                    <div className="relative my-5">
                                        <div className="absolute inset-0 flex items-center">
                                            <span className="w-full border-t border-border" />
                                        </div>
                                        <div className="relative flex justify-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            <span className="rounded-md bg-background px-3 py-0.5 dark:bg-card">or use email</span>
                                        </div>
                                    </div>

                                    <form onSubmit={handleAccountSubmit} className="space-y-4">
                                        {error && (
                                            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3.5 text-sm text-destructive" role="alert">
                                                {error}
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <label htmlFor="signup-name" className="block text-sm font-medium text-foreground">Full name</label>
                                            <div className="relative">
                                                <User className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
                                                <Input
                                                    id="signup-name"
                                                    name="name"
                                                    autoComplete="name"
                                                    placeholder="Jane Doe"
                                                    value={formData.name}
                                                    onChange={handleInputChange}
                                                    className="h-11 pl-11 text-base shadow-none"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label htmlFor="signup-email" className="block text-sm font-medium text-foreground">Email</label>
                                            <div className="relative">
                                                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
                                                <Input
                                                    id="signup-email"
                                                    name="email"
                                                    type="email"
                                                    autoComplete="email"
                                                    placeholder="you@company.com"
                                                    value={formData.email}
                                                    onChange={handleInputChange}
                                                    className="h-11 pl-11 text-base shadow-none"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label htmlFor="signup-password" className="block text-sm font-medium text-foreground">Password</label>
                                            <div className="relative">
                                                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
                                                <Input
                                                    id="signup-password"
                                                    name="password"
                                                    type={showPassword ? "text" : "password"}
                                                    autoComplete="new-password"
                                                    placeholder="At least 8 characters"
                                                    value={formData.password}
                                                    onChange={handleInputChange}
                                                    className="h-11 pl-11 pr-11 text-base shadow-none"
                                                    required
                                                />
                                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label htmlFor="signup-password-confirm" className="block text-sm font-medium text-foreground">Confirm password</label>
                                            <div className="relative">
                                                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
                                                <Input
                                                    id="signup-password-confirm"
                                                    name="confirmPassword"
                                                    type={showConfirmPassword ? "text" : "password"}
                                                    autoComplete="new-password"
                                                    placeholder="Repeat password"
                                                    value={formData.confirmPassword}
                                                    onChange={handleInputChange}
                                                    className="h-11 pl-11 pr-11 text-base shadow-none"
                                                    required
                                                />
                                                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}>
                                                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                        </div>

                                        <Button
                                            type="submit"
                                            disabled={isLoading}
                                            className="mt-1 h-11 w-full text-base font-medium"
                                        >
                                            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                                                <span className="flex items-center gap-2">
                                                    Create account <ArrowRight size={16} />
                                                </span>
                                            )}
                                        </Button>
                                    </form>
                                </>

                                <div className="mt-6 border-t border-border/60 pt-6 text-center">
                                    <p className="text-sm text-muted-foreground">
                                        Already have an account?{' '}
                                        <Link href="/signin" className="font-medium text-primary hover:underline">
                                            Sign in
                                        </Link>
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div key="website">
                                <div className="mb-6 sm:mb-7">
                                    <h2 className="mb-1 font-headline text-2xl font-semibold tracking-tight text-foreground sm:text-[1.625rem]">Add your website</h2>
                                    <p className="text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
                                        Connect your first domain to start tracking.
                                    </p>
                                </div>

                                <form onSubmit={handleWebsiteSubmit} className="space-y-4">
                                    {error && (
                                        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3.5 text-sm text-destructive" role="alert">
                                            {error}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label htmlFor="signup-site-name" className="block text-sm font-medium text-foreground">Website name</label>
                                        <div className="relative">
                                            <Sparkles className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
                                            <Input
                                                id="signup-site-name"
                                                name="siteName"
                                                autoComplete="organization"
                                                placeholder="My product"
                                                value={websiteData.siteName}
                                                onChange={(e) => setWebsiteData({ ...websiteData, siteName: e.target.value })}
                                                className="h-11 pl-11 text-base shadow-none"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label htmlFor="signup-site-url" className="block text-sm font-medium text-foreground">Domain</label>
                                        <div className="relative">
                                            <Globe className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
                                            <Input
                                                id="signup-site-url"
                                                name="siteUrl"
                                                autoComplete="off"
                                                placeholder="example.com"
                                                value={websiteData.siteUrl}
                                                onChange={(e) => setWebsiteData({ ...websiteData, siteUrl: e.target.value })}
                                                className="h-11 pl-11 text-base shadow-none"
                                                required
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground">Use the hostname only — no https://</p>
                                    </div>

                                    <Button
                                        type="submit"
                                        disabled={isLoading}
                                        className="mt-1 h-11 w-full text-base font-medium"
                                    >
                                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                                            <span className="flex items-center gap-2">
                                                Finalize setup <ArrowRight size={16} />
                                            </span>
                                        )}
                                    </Button>
                                </form>

                                <div className="mt-6 border-t border-border/60 pt-6 text-center">
                                    <p className="text-sm text-muted-foreground">
                                        You&apos;re on the free plan.{' '}
                                        <Link href="/pricing" className="text-primary font-medium hover:underline">
                                            View upgrade options
                                        </Link>
                                    </p>
                                </div>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <TrackingCodeModal
                isOpen={showTrackingModal}
                onOpenChange={(open) => {
                    setShowTrackingModal(open);
                    if (!open) {
                        router.push('/websites');
                    }
                }}
                siteId={newWebsiteId}
                isNewlyCreated={true}
            />
        </div>
    );
}

export default function SignUpPage() {
    return (
        <Suspense fallback={
            <div className="flex h-dvh items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <SignUpFlow />
        </Suspense>
    );
}
