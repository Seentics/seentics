'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Mail,
  Calendar,
  Loader2,
  Send,
  ExternalLink,
  Plus,
  ArrowLeft,
  Ticket,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MessageSquare,
} from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';
import Script from 'next/script';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { isEnterprise } from '@/lib/features';
import { supportAPI, SupportTicket, TicketReply } from '@/lib/support-api';
import { useAuth } from '@/stores/useAuthStore';
import { cn } from '@/lib/utils';

type ViewMode = 'list' | 'detail';

function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { className: string; label: string }> = {
    low: { className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', label: 'Low' },
    medium: { className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', label: 'Medium' },
    high: { className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300', label: 'High' },
    urgent: { className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', label: 'Urgent' },
  };
  const c = config[priority] || config.medium;
  return <Badge variant="secondary" className={cn('text-[10px] font-medium', c.className)}>{c.label}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { className: string; label: string; icon: React.ElementType }> = {
    open: { className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300', label: 'Open', icon: AlertCircle },
    in_progress: { className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', label: 'In Progress', icon: Clock },
    resolved: { className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', label: 'Resolved', icon: CheckCircle2 },
    closed: { className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', label: 'Closed', icon: XCircle },
  };
  const c = config[status] || config.open;
  const Icon = c.icon;
  return (
    <Badge variant="secondary" className={cn('text-[10px] font-medium gap-1', c.className)}>
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function SupportPage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;
  const router = useRouter();
  const { user } = useAuth();

  const [view, setView] = useState<ViewMode>('list');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({ subject: '', description: '', priority: 'medium' });
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Contact form state
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });

  useEffect(() => {
    if (!isEnterprise) {
      router.replace(`/websites/${websiteId}`);
    }
  }, [router, websiteId]);

  const loadTickets = useCallback(async () => {
    setIsLoadingTickets(true);
    try {
      const res = await supportAPI.getTickets();
      if (res.success) setTickets(res.data || []);
    } catch {
      // silent fail on load
    } finally {
      setIsLoadingTickets(false);
    }
  }, []);

  useEffect(() => {
    if (isEnterprise) loadTickets();
  }, [loadTickets]);

  const handleCreateTicket = async () => {
    if (!newTicket.subject.trim() || !newTicket.description.trim()) {
      toast.error('Please fill in all fields.');
      return;
    }
    setIsCreating(true);
    try {
      const res = await supportAPI.createTicket(newTicket);
      if (res.success) {
        toast.success('Ticket created successfully.');
        setCreateDialogOpen(false);
        setNewTicket({ subject: '', description: '', priority: 'medium' });
        loadTickets();
      }
    } catch {
      toast.error('Failed to create ticket.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleViewTicket = async (ticketId: string) => {
    try {
      const res = await supportAPI.getTicket(ticketId);
      if (res.success) {
        setSelectedTicket(res.data);
        setView('detail');
      }
    } catch {
      toast.error('Failed to load ticket details.');
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    setIsSendingReply(true);
    try {
      const res = await supportAPI.replyToTicket(selectedTicket.id, replyText);
      if (res.success) {
        setReplyText('');
        // Refresh ticket to get latest replies
        const updated = await supportAPI.getTicket(selectedTicket.id);
        if (updated.success) setSelectedTicket(updated.data);
        toast.success('Reply sent.');
      }
    } catch {
      toast.error('Failed to send reply.');
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, websiteId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message');
      toast.success('Message sent! We will get back to you shortly.');
      setFormData({ name: '', email: '', message: '' });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isEnterprise) return null;

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-500">
      <DashboardPageHeader
        title="Support"
        description="Get help from the team or schedule a call."
      />

      {/* Ticket Management */}
      {view === 'list' ? (
        <Card className="border border-border/60 bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Ticket className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Support Tickets</h2>
                  <p className="text-xs text-muted-foreground">Track and manage your support requests.</p>
                </div>
              </div>

              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5 text-xs font-medium">
                    <Plus className="h-3.5 w-3.5" />
                    New Ticket
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-base">Create Support Ticket</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Subject</Label>
                      <Input
                        value={newTicket.subject}
                        onChange={(e) => setNewTicket(prev => ({ ...prev, subject: e.target.value }))}
                        placeholder="Brief description of the issue"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Priority</Label>
                      <Select
                        value={newTicket.priority}
                        onValueChange={(val) => setNewTicket(prev => ({ ...prev, priority: val }))}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Description</Label>
                      <Textarea
                        value={newTicket.description}
                        onChange={(e) => setNewTicket(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe your issue in detail..."
                        className="min-h-[120px] text-sm"
                      />
                    </div>
                    <Button
                      onClick={handleCreateTicket}
                      disabled={isCreating}
                      size="sm"
                      className="w-full gap-1.5 text-xs font-medium"
                    >
                      {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Submit Ticket
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {isLoadingTickets ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-12">
                <Ticket className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No support tickets yet.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Create a ticket to get help from our team.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => handleViewTicket(ticket.id)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border/40 hover:border-border hover:bg-accent/30 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm font-medium truncate">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(ticket.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <PriorityBadge priority={ticket.priority} />
                      <StatusBadge status={ticket.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Ticket Detail View */
        <Card className="border border-border/60 bg-card shadow-sm">
          <CardContent className="p-5">
            <button
              onClick={() => { setView('list'); setSelectedTicket(null); }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to tickets
            </button>

            {selectedTicket && (
              <div className="space-y-5">
                {/* Ticket header */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-semibold">{selectedTicket.subject}</h2>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <PriorityBadge priority={selectedTicket.priority} />
                      <StatusBadge status={selectedTicket.status} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Opened {formatDateTime(selectedTicket.createdAt)}
                  </p>
                </div>

                {/* Original description */}
                <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                  <p className="text-sm whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>

                {/* Replies */}
                {selectedTicket.replies && selectedTicket.replies.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Replies ({selectedTicket.replies.length})
                    </h3>
                    {selectedTicket.replies.map((reply) => (
                      <div
                        key={reply.id}
                        className={cn(
                          'p-3 rounded-lg border border-border/40',
                          reply.senderType === 'agent' ? 'bg-primary/5 border-primary/20' : 'bg-muted/20'
                        )}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium">
                            {reply.senderName}
                            {reply.senderType === 'agent' && (
                              <Badge variant="secondary" className="ml-1.5 text-[9px] bg-primary/10 text-primary">
                                Support
                              </Badge>
                            )}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{formatDateTime(reply.createdAt)}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{reply.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply form */}
                {(selectedTicket.status === 'open' || selectedTicket.status === 'in_progress') && (
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your reply..."
                      className="min-h-[80px] text-sm"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={handleReply}
                        disabled={isSendingReply || !replyText.trim()}
                        className="gap-1.5 text-xs font-medium"
                      >
                        {isSendingReply ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Send Reply
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Discord Banner */}
      <Card className="border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
              <FaDiscord className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Join our Discord community</h3>
              <p className="text-xs text-indigo-600/70 dark:text-indigo-400/60">Get help from the team and community in real-time.</p>
            </div>
          </div>
          <a href="https://discord.gg/TYdPvDRA" target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="gap-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white">
              <ExternalLink className="h-3.5 w-3.5" />
              Join Discord
            </Button>
          </a>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Contact Form */}
        <Card className="border border-border/60 bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Contact Us</h2>
                <p className="text-xs text-muted-foreground">Send us a message directly.</p>
              </div>
            </div>

            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  placeholder="Your name"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                  placeholder="you@company.com"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="message" className="text-xs font-medium">Message</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  required
                  placeholder="How can we help you?"
                  className="min-h-[120px] text-sm"
                />
              </div>

              <Button type="submit" size="sm" className="w-full gap-1.5 text-xs font-medium" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Send Message
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Calendly Widget */}
        <Card className="border border-border/60 bg-card shadow-sm">
          <CardContent className="p-5 h-full min-h-[600px]">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="h-4 w-4 text-violet-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Book a Call</h2>
                <p className="text-xs text-muted-foreground">Schedule a 30-min session with us.</p>
              </div>
            </div>

            <div
              className="calendly-inline-widget w-full h-[540px] border border-border/40 rounded-md bg-background"
              data-url="https://calendly.com/shohagmiah2100/30min"
              style={{ minWidth: '280px', height: '540px' }}
            />
            <Script
              type="text/javascript"
              src="https://assets.calendly.com/assets/external/widget.js"
              strategy="lazyOnload"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
