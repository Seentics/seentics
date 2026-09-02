'use client';

import { useState } from 'react';
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

export default function SignInPage() {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const { setAuth } = useAuth();

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

    return (
        <AuthShell
            legal
            title="Welcome back"
            subtitle={enterpriseAuthMarketing.signinSubhead}
            footer={
                isEnterprise ? (
                    <>
                        Don&apos;t have an account?{' '}
                        <Link href="/signup" className="font-medium text-primary hover:underline">Sign up</Link>
                    </>
                ) : (
                    <>
                        First time?{' '}
                        <Link href="/setup" className="font-medium text-primary hover:underline">Set up admin</Link>
                    </>
                )
            }
        >
            <OAuthButtons />
            <AuthDivider />

            <form onSubmit={handleEmailSignIn} className="space-y-4">
                {error && <AuthError>{error}</AuthError>}

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

                <PasswordField
                    label="Password"
                    name="password"
                    autoComplete="current-password"
                    placeholder="Your password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    action={
                        <Link href="/forgot-password" className="shrink-0 text-xs font-medium text-primary hover:underline">
                            Forgot password?
                        </Link>
                    }
                />

                <Button type="submit" disabled={isLoading} className="mt-1 w-full font-semibold">
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <>Sign in <ArrowRight className="h-4 w-4" /></>
                    )}
                </Button>
            </form>
        </AuthShell>
    );
}
