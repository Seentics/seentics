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
    Globe
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';
import { TrackingCodeModal } from '@/components/websites/tracking-code-modal';
import { isEnterprise } from '@/lib/features';

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

    // Validate step param — only allow step 2 if authenticated
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

    // If already authenticated and on step 1, advance to step 2
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
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        if (error) setError(null);
    };

    const validateStep1 = () => {
        if (!formData.name.trim()) {
            setError('Name is required');
            return false;
        }
        if (!formData.email.trim()) {
            setError('Email is required');
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            setError('Please enter a valid email address');
            return false;
        }
        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters long');
            return false;
        }
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
            setError('Password must contain at least one uppercase letter, one lowercase letter, and one number');
            return false;
        }
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return false;
        }
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

            // Auto-activate free Starter plan
            try {
                await api.post('/user/billing/select-free');
            } catch {
                // Non-critical — starter plan may already be active
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
            toast({
                title: "Validation Error",
                description: "Please provide a website name.",
                variant: "destructive"
            });
            return;
        }

        if (!siteUrl.trim()) {
            toast({
                title: "Validation Error",
                description: "Please provide a valid domain name.",
                variant: "destructive"
            });
            return;
        }

        // Domain validation regex
        const domainRegex = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
        const cleanUrl = siteUrl.replace(/^(https?:\/\/)/, '').replace(/\/$/, '');

        if (!domainRegex.test(cleanUrl)) {
            toast({
                title: "Invalid Domain",
                description: "Please provide a valid domain name (e.g. example.com).",
                variant: "destructive"
            });
            return;
        }

        try {
            setIsLoading(true);
            const normalizedUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
            const response = await api.post('/user/websites', {
                name: siteName.trim(),
                url: normalizedUrl
            });

            const website = response.data.data;

            setNewWebsiteId(website.site_id || website.id);
            setShowTrackingModal(true);

            toast({
                title: "Success",
                description: "Your website has been added. Welcome to Seentics!",
            });
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

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 overflow-y-auto custom-scrollbar">
            <div className="w-full max-w-lg mb-12 text-center">
                <Link href="/" className="inline-flex items-center gap-2 group mb-8">
                    <Logo size="lg" />
                    <span className="text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">SEENTICS</span>
                </Link>

                {/* Step Indicator - 2 Steps */}
                <div className="relative flex justify-between items-center h-10 px-24">
                    <div className="absolute top-1/2 left-24 right-24 h-px bg-border -translate-y-1/2" />

                    {[
                        { id: 1, label: 'Signup' },
                        { id: 2, label: 'Website' }
                    ].map((s) => (
                        <div key={s.id} className="relative z-10 flex flex-col items-center">
                            <div
                                className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${step >= s.id ? 'bg-primary border-primary text-primary-foreground' : 'bg-background border-border text-muted-foreground'
                                    }`}
                            >
                                {step > s.id ? <CheckCircle className="h-3.5 w-3.5" /> : <span className="text-[10px] font-bold">{s.id}</span>}
                            </div>
                            <span className={`absolute top-8 text-[10px] font-bold uppercase tracking-wider transition-all ${step === s.id ? 'text-primary' : 'text-muted-foreground opacity-60'
                                }`}>
                                {s.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="w-full flex flex-col items-center justify-center">
                <AnimatePresence mode="wait">
                    {step === 1 ? (
                        <div
                            key="account"
                            className="w-full max-w-md bg-card p-8 rounded-lg border border-border shadow-sm"
                        >
                            <div className="mb-10 text-center">
                                <h2 className="text-3xl font-bold tracking-tight mb-2 text-foreground">Create account.</h2>
                                <p className="text-muted-foreground">Start tracking for free in minutes.</p>
                            </div>

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

                            <form onSubmit={handleAccountSubmit} className="space-y-6">
                                {error && (
                                    <div className="p-4 rounded bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold font-sans">
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div className="space-y-1.5 ">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Full Name</label>
                                        <div className="relative group">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <Input
                                                name="name"
                                                placeholder="Elon Musk"
                                                value={formData.name}
                                                onChange={handleInputChange}
                                                className="h-14 pl-12 bg-background border-none rounded font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Your Email</label>
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
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Security Password</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                            <div className="relative group">
                                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                                <Input
                                                    name="confirmPassword"
                                                    type={showConfirmPassword ? "text" : "password"}
                                                    placeholder="Confirm"
                                                    value={formData.confirmPassword}
                                                    onChange={handleInputChange}
                                                    className="h-14 pl-12 bg-background border-none rounded font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                                                    required
                                                />
                                            </div>
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
                                            Create account <ArrowRight size={18} />
                                        </span>
                                    )}
                                </Button>
                            </form>

                            <div className="mt-8 pt-8 border-t border-border/50 text-center">
                                <p className="text-sm font-medium text-muted-foreground">
                                    Already have an account?{' '}
                                    <Link href="/signin" className="text-primary font-bold hover:underline uppercase tracking-wider text-xs">
                                        Sign In
                                    </Link>
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div
                            key="website"
                            className="w-full max-w-md bg-card rounded-lg p-8 border border-border shadow-sm"
                        >
                            <div className="mb-10 text-center">
                                <h2 className="text-3xl font-bold tracking-tight mb-2 text-foreground">Add Website.</h2>
                                <p className="text-muted-foreground">Connect your first domain to start tracking.</p>
                            </div>

                            <form onSubmit={handleWebsiteSubmit} className="space-y-6">
                                {error && (
                                    <div className="p-4 rounded bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold">
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Website Name</label>
                                        <div className="relative group">
                                            <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <Input
                                                placeholder="My Awesome App"
                                                value={websiteData.siteName}
                                                onChange={(e) => setWebsiteData({ ...websiteData, siteName: e.target.value })}
                                                className="h-14 pl-12 bg-background border-none rounded font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Website URL</label>
                                        <div className="relative group">
                                            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <Input
                                                placeholder="example.com"
                                                value={websiteData.siteUrl}
                                                onChange={(e) => setWebsiteData({ ...websiteData, siteUrl: e.target.value })}
                                                className="h-14 pl-12 bg-background border-none rounded font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                                                required
                                            />
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
                                            Finalize setup <ArrowRight size={18} />
                                        </span>
                                    )}
                                </Button>
                            </form>

                            <div className="mt-6 text-center">
                                <p className="text-xs text-muted-foreground">
                                    You're on the free <span className="font-bold text-foreground">Starter</span> plan.{' '}
                                    <Link href="/pricing" className="text-primary font-bold hover:underline">
                                        View upgrade options
                                    </Link>
                                </p>
                            </div>
                        </div>
                    )}
                </AnimatePresence>
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
            <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-[#020617]">
                <Loader2 className="animate-spin h-10 w-10 text-primary mb-4" />
                <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Loading...</p>
            </div>
        }>
            <SignUpFlow />
        </Suspense>
    );
}
