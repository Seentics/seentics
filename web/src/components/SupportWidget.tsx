'use client';

import * as React from 'react';
import { MessageSquare, X, Send, CheckCircle2, AlertCircle, Clock, ShieldCheck, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isEnterprise } from '@/lib/features';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function SupportWidget() {
    const [isOpen, setIsOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isSuccess, setIsSuccess] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [formData, setFormData] = React.useState({
        name: '',
        email: '',
        message: ''
    });

    if (!isEnterprise) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    message: formData.message,
                    subject: `[Support] Message from ${formData.name}`,
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to send message');
            }

            setIsSuccess(true);
            setFormData({ name: '', email: '', message: '' });
            setTimeout(() => {
                setIsSuccess(false);
                setIsOpen(false);
            }, 3000);
        } catch (err: any) {
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end print:hidden">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 15 }}
                        className="w-[400px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.15)] mb-5 overflow-hidden flex flex-col"
                    >
                        {/* Informative Header */}
                        <div className="bg-slate-50 dark:bg-slate-950/50 px-8 py-7 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 tracking-tight">Contact & Support</h3>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>

                            <div className="grid  gap-3">
                                <small>Drop your message below, we will contact you soon.</small>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="p-8">
                            {isSuccess ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                                    <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center">
                                        <CheckCircle2 className="w-8 h-8" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-bold text-slate-900 dark:text-slate-100">Message Received</p>
                                        <p className="text-sm text-slate-500">Check your email for confirmation.</p>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div className="space-y-1">
                                        <Input
                                            placeholder="Your Full Name"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                            className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl h-12 px-4 shadow-sm focus:ring-2 focus:ring-primary/20 transition-all"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <Input
                                            type="email"
                                            placeholder="Work Email Address"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            required
                                            className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl h-12 px-4 shadow-sm focus:ring-2 focus:ring-primary/20 transition-all"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <Textarea
                                            placeholder="Tell us more about your inquiry..."
                                            rows={5}
                                            value={formData.message}
                                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                            required
                                            className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 shadow-sm focus:ring-2 focus:ring-primary/20 transition-all resize-none min-h-[120px]"
                                        />
                                    </div>

                                    {error && (
                                        <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/5 p-4 rounded-xl border border-red-500/10">
                                            <AlertCircle className="w-4 h-4 shrink-0" />
                                            <p className="font-medium leading-tight">{error}</p>
                                        </div>
                                    )}

                                    <Button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full h-12 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-[0.98]"
                                    >
                                        {isSubmitting ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4" />
                                                <span>Submit Ticket</span>
                                            </>
                                        )}
                                    </Button>
                                </form>
                            )}
                        </div>

                        {/* Informative Footer */}
                        <div className="px-8 py-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 opacity-60">
                                <Mail className="w-3 h-3" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">support@seentics.com</span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Primary FAB */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300 active:scale-95 group",
                    isOpen ? "bg-slate-800 dark:bg-slate-800" : "bg-primary shadow-primary/30"
                )}
            >
                <AnimatePresence mode="wait">
                    {isOpen ? (
                        <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                            <X className="w-6 h-6" />
                        </motion.div>
                    ) : (
                        <motion.div key="message" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.2, opacity: 0 }}>
                            <MessageSquare className="w-6 h-6" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </button>
        </div>
    );
}
