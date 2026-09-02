'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthShell } from '@/components/auth/AuthShell';
import { AuthDivider, OAuthButtons } from '@/components/auth/OAuthButtons';
import { AuthError, AuthField, PasswordField } from '@/components/auth/AuthField';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuthStore';
import { isEnterprise } from '@/lib/features';
import { enterpriseAuthMarketing } from '@/lib/enterprise-auth-marketing';

function SignUpFlow() {
    const router = useRouter();
    const { toast } = useToast();
    const { setAuth } = useAuth();

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Every hook runs before this bails out. It used to sit above `useToast`,
    // `useAuth` and five `useState` calls, so the component returned early on the
    // OSS build with half its hooks unmounted — legal only because `isEnterprise` is
    // a module constant that never changes between renders.
    useEffect(() => {
        if (!isEnterprise) router.replace('/setup');
    }, [router]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (error) setError(null);
    };

    const validateForm = () => {
        if (!formData.name.trim()) { setError('Name is required'); return false; }
        if (!formData.email.trim()) { setError('Email is required'); return false; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) { setError('Please enter a valid email address'); return false; }
        if (formData.password.length < 8) { setError('Password must be at least 8 characters long'); return false; }
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) { setError('Password must contain uppercase, lowercase, and a number'); return false; }
        if (formData.password !== formData.confirmPassword) { setError('Passwords do not match'); return false; }
        return true;
    };

    const handleAccountSubmit = async (e: React.FormEvent) => {
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

            // Register does not return tokens, so the account is signed in with a
            // second call. Keep both — dropping the login leaves a created account
            // with no session and drops the user back on this form.
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
                    rememberMe: false,
                });
            }

            try { await api.post('/user/billing/select-free'); } catch { /* non-critical */ }

            toast({ title: 'Account created!', description: 'Welcome to Seentics.' });
            const hasCheckoutIntent = !!sessionStorage.getItem('seentics_checkout_intent');
            router.push(hasCheckoutIntent ? '/#pricing' : '/websites');
        } catch (error: any) {
            const msg = error.response?.data?.error || error.message || 'Registration failed';
            setError(msg);
            toast({ title: 'Registration Failed', description: msg, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    if (!isEnterprise) return null;

    return (
        <AuthShell
            legal
            title="Create your account"
            subtitle={enterpriseAuthMarketing.signupSubhead}
            footer={
                <>
                    Already have an account?{' '}
                    <Link href="/signin" className="font-medium text-primary hover:underline">Sign in</Link>
                </>
            }
        >
            <OAuthButtons label="Sign up" />
            <AuthDivider />

            <form onSubmit={handleAccountSubmit} className="space-y-4">
                {error && <AuthError>{error}</AuthError>}

                <AuthField
                    label="Full name"
                    name="name"
                    autoComplete="name"
                    placeholder="Jane Doe"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                />

                <AuthField
                    label="Email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                />

                <div className="space-y-1.5">
                    <PasswordField
                        label="Password"
                        name="password"
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                    />
                    {/* The rule is enforced in `validateForm` but was previously only
                        discoverable by submitting and being rejected. */}
                    <p className="text-xs text-muted-foreground">
                        At least 8 characters, with an uppercase letter, a lowercase letter and a number.
                    </p>
                </div>

                <PasswordField
                    label="Confirm password"
                    name="confirmPassword"
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                />

                <Button type="submit" disabled={isLoading} className="mt-1 w-full font-semibold">
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <>Create account <ArrowRight className="h-4 w-4" /></>
                    )}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                    {enterpriseAuthMarketing.footnote}
                </p>
            </form>
        </AuthShell>
    );
}

export default function SignUpPage() {
    return (
        <Suspense
            fallback={
                <div className="grid min-h-dvh place-items-center bg-muted/30 dark:bg-background">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            }
        >
            <SignUpFlow />
        </Suspense>
    );
}
