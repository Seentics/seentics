'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import {
    Search,
    MessageSquare,
    ChevronRight,
    Mail,
    Calendar,
    Tag,
    Loader2,
    RefreshCw,
    Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Ticket {
    id: string;
    userId: string;
    subject: string;
    description: string;
    status: string;
    priority: string;
    metadata: Record<string, any>;
    createdAt: string;
    updatedAt: string;
}

export default function SupportInbox() {
    const [activeTab, setActiveTab] = useState('all');
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchTickets = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/admin/support/tickets');
            setTickets(response.data.data || []);
        } catch {
            toast.error('Failed to load support tickets');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

    const filteredTickets = tickets.filter(t => {
        const matchesSearch = !searchQuery ||
            t.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.metadata?.user_email?.toLowerCase().includes(searchQuery.toLowerCase());

        if (activeTab === 'all') return matchesSearch;
        return matchesSearch && t.status === activeTab;
    });

    const tabCounts = {
        open: tickets.filter(t => t.status === 'open').length,
        pending: tickets.filter(t => t.status === 'pending').length,
        resolved: tickets.filter(t => t.status === 'resolved').length,
        all: tickets.length,
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] lg:h-screen overflow-hidden">
            {/* Inbox Header */}
            <div className="p-6 lg:p-8 pb-0 border-b border-border/30 bg-background/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">Support Inbox</h1>
                        <p className="text-muted-foreground text-xs mt-0.5">Manage and reply to customer tickets.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative w-56">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Search tickets..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-muted/30 border-border/30 rounded-lg h-9 text-xs"
                            />
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={fetchTickets}
                            className="rounded-lg border-border/30 h-9 w-9"
                        >
                            <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                        </Button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1">
                    {(['open', 'pending', 'resolved', 'all'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={cn(
                                "px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-all relative rounded-t-lg",
                                activeTab === tab
                                    ? "text-primary bg-primary/5"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                            )}
                        >
                            <span className="flex items-center gap-1.5">
                                {tab}
                                <span className={cn(
                                    "text-[10px] tabular-nums px-1 py-0 rounded-full",
                                    activeTab === tab ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                )}>
                                    {tabCounts[tab]}
                                </span>
                            </span>
                            {activeTab === tab && (
                                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Ticket List */}
            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                <div className="max-w-4xl mx-auto space-y-3">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <div className="relative">
                                <div className="w-12 h-12 border-4 border-primary/20 rounded-full" />
                                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin absolute inset-0" />
                            </div>
                            <p className="font-bold uppercase tracking-widest text-[10px] text-muted-foreground animate-pulse">Loading tickets...</p>
                        </div>
                    ) : filteredTickets.length > 0 ? filteredTickets.map((ticket) => (
                        <Card
                            key={ticket.id}
                            className="bg-card/60 backdrop-blur-sm border-border/20 hover:border-border/50 transition-all group cursor-pointer overflow-hidden"
                        >
                            <CardContent className="p-0">
                                <div className="flex items-center p-4 gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors">
                                        <MessageSquare className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <h3 className="font-bold text-sm truncate">{ticket.subject}</h3>
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "text-[9px] font-black uppercase px-1.5 py-0 h-4 shrink-0",
                                                    ticket.priority === 'urgent' || ticket.priority === 'high'
                                                        ? "text-red-400 bg-red-500/10 border-red-500/20"
                                                        : ticket.priority === 'medium'
                                                            ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                                                            : "text-muted-foreground bg-muted border-border/40"
                                                )}
                                            >
                                                {ticket.priority}
                                            </Badge>
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "text-[9px] font-bold uppercase px-1.5 py-0 h-4 shrink-0",
                                                    ticket.status === 'open'
                                                        ? "text-blue-400 bg-blue-500/10 border-blue-500/20"
                                                        : ticket.status === 'pending'
                                                            ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                                                            : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                                )}
                                            >
                                                {ticket.status}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-3 text-[11px]">
                                            <span className="flex items-center gap-1 text-muted-foreground">
                                                <Mail className="w-3 h-3" />
                                                {ticket.metadata?.user_email || 'System'}
                                            </span>
                                            <span className="flex items-center gap-1 text-muted-foreground">
                                                <Clock className="w-3 h-3" />
                                                {ticket.createdAt
                                                    ? formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })
                                                    : 'Unknown'}
                                            </span>
                                        </div>
                                    </div>

                                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                                </div>

                                {ticket.description && (
                                    <div className="px-4 pb-3 pl-[68px]">
                                        <p className="text-xs text-muted-foreground line-clamp-1 italic">
                                            &ldquo;{ticket.description}&rdquo;
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )) : (
                        <div className="py-16 text-center space-y-3">
                            <div className="w-14 h-14 bg-muted/30 rounded-full flex items-center justify-center mx-auto border border-border/20">
                                <Tag className="w-7 h-7 text-muted-foreground/30" />
                            </div>
                            <div>
                                <p className="font-bold text-sm">No tickets found</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {searchQuery ? 'Try a different search term.' : 'The inbox is clear.'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
