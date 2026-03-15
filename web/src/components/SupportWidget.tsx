'use client';

import * as React from 'react';
import {
    Bell, X, Send, CheckCircle2, AlertCircle, Mail,
    MessageSquare, MailOpen, Zap, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { isEnterprise } from '@/lib/features';
import apiClient from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    getUserNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    UserNotification,
} from '@/lib/notifications-api';
import { formatDistanceToNow } from 'date-fns';

type Tab = 'notifications' | 'contact';

function NotificationIcon({ type }: { type: string }) {
    switch (type) {
        case 'alert': return <AlertCircle className="h-4 w-4 text-red-500" />;
        case 'automation': return <Zap className="h-4 w-4 text-orange-500" />;
        case 'info': return <Info className="h-4 w-4 text-indigo-500" />;
        case 'support_update': return <MessageSquare className="h-4 w-4 text-indigo-500" />;
        default: return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
}

export default function SupportWidget() {
    const [isOpen, setIsOpen] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState<Tab>('notifications');

    // Notifications state
    const [notifications, setNotifications] = React.useState<UserNotification[]>([]);
    const [unreadCount, setUnreadCount] = React.useState(0);

    // Contact form state
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isSuccess, setIsSuccess] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [formData, setFormData] = React.useState({ name: '', email: '', message: '' });

    if (!isEnterprise) return null;

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const fetchNotifications = React.useCallback(async () => {
        const data = await getUserNotifications();
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.read).length);
    }, []);

    // eslint-disable-next-line react-hooks/rules-of-hooks
    React.useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    const handleMarkRead = async (id: string) => {
        await markNotificationRead(id);
        fetchNotifications();
    };

    const handleMarkAllRead = async () => {
        await markAllNotificationsRead();
        fetchNotifications();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        try {
            await apiClient.post('/user/support/contact', {
                name: formData.name,
                email: formData.email,
                message: formData.message,
                subject: `[Support] Message from ${formData.name}`,
            });
            setIsSuccess(true);
            setFormData({ name: '', email: '', message: '' });
            setTimeout(() => { setIsSuccess(false); setIsOpen(false); }, 3000);
        } catch (err: any) {
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const tabs: { id: Tab; label: string }[] = [
        { id: 'notifications', label: 'Notifications' },
        { id: 'contact', label: 'Contact' },
    ];

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end print:hidden">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 15 }}
                        transition={{ duration: 0.2 }}
                        className="w-[380px] bg-background border border-border/60 rounded-2xl shadow-2xl mb-4 overflow-hidden flex flex-col"
                        style={{ maxHeight: '520px' }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 pt-4 pb-0">
                            <h3 className="text-sm font-bold text-foreground">Activity</h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 hover:bg-accent rounded-full transition-colors text-muted-foreground hover:text-foreground"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Tab bar */}
                        <div className="flex items-end gap-0 border-b border-border/60 px-5 mt-3">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        'flex items-center gap-1.5 px-1 py-2 mr-4 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                                        activeTab === tab.id
                                            ? 'border-primary text-foreground'
                                            : 'border-transparent text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    {tab.id === 'notifications' && unreadCount > 0 && (
                                        <span className="h-4 w-4 rounded-full bg-primary text-[9px] font-bold text-white flex items-center justify-center">
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </span>
                                    )}
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Notifications tab */}
                        {activeTab === 'notifications' && (
                            <div className="flex flex-col flex-1 min-h-0">
                                {unreadCount > 0 && (
                                    <div className="flex justify-end px-4 pt-2">
                                        <button
                                            onClick={handleMarkAllRead}
                                            className="text-[11px] font-medium text-primary hover:underline"
                                        >
                                            Mark all as read
                                        </button>
                                    </div>
                                )}
                                <ScrollArea className="flex-1" style={{ maxHeight: '360px' }}>
                                    {notifications.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-14 text-center text-muted-foreground">
                                            <MailOpen className="h-9 w-9 mb-3 opacity-20" />
                                            <p className="text-sm font-medium">All caught up!</p>
                                            <p className="text-xs opacity-60">No new notifications.</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-border/40">
                                            {notifications.map(n => (
                                                <div
                                                    key={n.id}
                                                    onClick={() => !n.read && handleMarkRead(n.id)}
                                                    className={cn(
                                                        'flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-accent/40',
                                                        !n.read && 'bg-primary/5'
                                                    )}
                                                >
                                                    <div className={cn(
                                                        'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                                                        !n.read ? 'bg-primary/10' : 'bg-muted'
                                                    )}>
                                                        <NotificationIcon type={n.type} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={cn(
                                                            'text-xs leading-tight mb-0.5',
                                                            !n.read ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'
                                                        )}>
                                                            {n.title}
                                                        </p>
                                                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                                            {n.message}
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                                                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                                                        </p>
                                                    </div>
                                                    {!n.read && (
                                                        <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </div>
                        )}

                        {/* Contact tab */}
                        {activeTab === 'contact' && (
                            <div className="flex-1 overflow-y-auto p-5">
                                {isSuccess ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                                        <div className="w-14 h-14 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center">
                                            <CheckCircle2 className="w-7 h-7" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-bold text-sm text-foreground">Message Received</p>
                                            <p className="text-xs text-muted-foreground">We'll get back to you soon.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubmit} className="space-y-3">
                                        <p className="text-xs text-muted-foreground mb-4">Drop your message below, we will contact you soon.</p>
                                        <Input
                                            placeholder="Your Full Name"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                            className="h-9 text-sm"
                                        />
                                        <Input
                                            type="email"
                                            placeholder="Email Address"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            required
                                            className="h-9 text-sm"
                                        />
                                        <Textarea
                                            placeholder="Tell us more about your inquiry..."
                                            rows={4}
                                            value={formData.message}
                                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                            required
                                            className="text-sm resize-none"
                                        />
                                        {error && (
                                            <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/5 p-3 rounded-lg border border-red-500/10">
                                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                                <p>{error}</p>
                                            </div>
                                        )}
                                        <Button type="submit" disabled={isSubmitting} className="w-full gap-2 text-sm">
                                            {isSubmitting ? (
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <><Send className="w-3.5 h-3.5" /> Send Message</>
                                            )}
                                        </Button>
                                        <div className="flex items-center justify-center gap-1.5 pt-1">
                                            <Mail className="w-3 h-3 text-muted-foreground/50" />
                                            <span className="text-[10px] text-muted-foreground/50">support@seentics.com</span>
                                        </div>
                                    </form>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Compact pill FAB */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium shadow-md transition-all duration-200 active:scale-95 hover:shadow-lg",
                    isOpen
                        ? "bg-muted text-muted-foreground border border-border/60"
                        : "bg-background border border-border/60 text-foreground hover:bg-accent"
                )}
            >
                <Bell className="w-3.5 h-3.5 flex-shrink-0" />
                <span className={cn(
                    "min-w-[14px] h-4 rounded-full text-[10px] font-bold flex items-center justify-center px-1",
                    unreadCount > 0 ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"
                )}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
                {isOpen && <X className="w-3 h-3 ml-0.5 text-muted-foreground" />}
            </button>
        </div>
    );
}
