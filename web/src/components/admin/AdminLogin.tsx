'use client';

import React, { useState } from 'react';
import { useAuth } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Lock, ShieldAlert, Key, Loader2, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';

export function AdminLogin() {
    const { setAdminVerified } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [secrets, setSecrets] = useState({
        secret1: '',
        secret2: '',
        secret3: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await api.post('/user/auth/verify-secrets', secrets);
            if (response.data.success) {
                toast.success('Access Granted', { description: 'Welcome to the Command Center.' });
                setAdminVerified(true);
            }
        } catch (error: any) {
            toast.error('Access Denied', {
                description: error.response?.data?.error || 'Invalid administrative secrets.'
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020202] flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background decorative elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-rose-500/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

            <Card className="max-w-md w-full bg-black/40 border-white/5 backdrop-blur-xl relative z-10 shadow-2xl">
                <CardHeader className="text-center space-y-4 pt-10">
                    <div className="mx-auto w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center">
                        <Lock className="w-8 h-8 text-rose-500" />
                    </div>
                    <div className="space-y-2">
                        <CardTitle className="text-2xl font-black text-white tracking-tight uppercase italic">Restricted Access</CardTitle>
                        <CardDescription className="text-slate-500 font-medium">
                            Internal Seentics Team Only. Enter your environmental passkeys to proceed to God Mode.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="p-8 pt-0">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Protocol I (Master Key)</label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                                    <Input
                                        type="password"
                                        required
                                        placeholder="••••••••"
                                        value={secrets.secret1}
                                        onChange={(e) => setSecrets({ ...secrets, secret1: e.target.value })}
                                        className="pl-10 bg-white/5 border-white/10 rounded-xl h-12 text-sm focus:ring-rose-500/20"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Protocol II (Access Phrase)</label>
                                <div className="relative">
                                    <ShieldAlert className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                                    <Input
                                        type="password"
                                        required
                                        placeholder="••••••••"
                                        value={secrets.secret2}
                                        onChange={(e) => setSecrets({ ...secrets, secret2: e.target.value })}
                                        className="pl-10 bg-white/5 border-white/10 rounded-xl h-12 text-sm focus:ring-rose-500/20"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Protocol III (Integrity Hash)</label>
                                <div className="relative">
                                    <Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                                    <Input
                                        type="password"
                                        required
                                        placeholder="••••••••"
                                        value={secrets.secret3}
                                        onChange={(e) => setSecrets({ ...secrets, secret3: e.target.value })}
                                        className="pl-10 bg-white/5 border-white/10 rounded-xl h-12 text-sm focus:ring-rose-500/20"
                                    />
                                </div>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-12 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-rose-600/20"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Bypassing Security Layer'}
                        </Button>

                        <p className="text-[10px] text-center text-slate-600 font-bold uppercase tracking-tighter pt-4 border-t border-white/5">
                            Attempts are logged and reported to infrastructure security.
                        </p>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

