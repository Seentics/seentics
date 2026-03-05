'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Trash2,
  ChevronRight,
} from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';
import Script from 'next/script';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { isEnterprise } from '@/lib/features';
import { supportAPI, SupportTicket, TicketReply } from '@/lib/support-api';
import { useAuth } from '@/stores/useAuthStore';
import { cn } from '@/lib/utils';

type ViewMode = 'list' | 'detail';
type TabId = 'tickets' | 'contact' | 'call';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'contact', label: 'Contact', icon: Mail },
  { id: 'call', label: 'Book a Call', icon: Calendar },
];

const PRIORITY_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  low:    { label: 'Low',    dot: 'bg-slate-400',   badge: 'text-slate-600 bg-slate-100 dark:bg-slate-800/60 dark:text-slate-400' },
  medium: { label: 'Medium', dot: 'bg-blue-500',    badge: 'text-blue-700 bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300' },
  high:   { label: 'High',   dot: 'bg-orange-500',  badge: 'text-orange-700 bg-orange-100 dark:bg-orange-900/40 dark:text-orange-300' },
  urgent: { label: 'Urgent', dot: 'bg-red-500',     badge: 'text-red-700 bg-red-100 dark:bg-red-900/40 dark:text-red-300' },
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  open:        { label: 'Open',        icon: AlertCircle,  className: 'text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300' },
  in_progress: { label: 'In Progress', icon: Clock,        className: 'text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300' },
  resolved:    { label: 'Resolved',    icon: CheckCircle2, className: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300' },
  closed:      { label: 'Closed',      icon: XCircle,      className: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400' },
};

function PriorityDot({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  return <span className={cn('inline-block w-2 h-2 rounded-full flex-shrink-0', cfg.dot)} />;
}

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full', cfg.badge)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full', cfg.className)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function SupportPage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;
  const router = useRouter();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabId>('tickets');
  const [view, setView] = useState<ViewMode>('list');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({ subject: '', description: '', priority: 'medium' });
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });

  useEffect(() => {
    if (!isEnterprise) router.replace(`/websites/${websiteId}`);
  }, [router, websiteId]);

  const loadTickets = useCallback(async () => {
    setIsLoadingTickets(true);
    try {
      const res = await supportAPI.getTickets();
      if (res.success) setTickets(res.data || []);
    } catch { /* silent */ } finally {
      setIsLoadingTickets(false);
    }
  }, []);

  useEffect(() => { if (isEnterprise) loadTickets(); }, [loadTickets]);

  const handleCreateTicket = async () => {
    if (!newTicket.subject.trim() || !newTicket.description.trim()) {
      toast.error('Please fill in all fields.');
      return;
    }
    setIsCreating(true);
    try {
      const res = await supportAPI.createTicket(newTicket);
      if (res.success) {
        toast.success('Ticket created.');
        setCreateDialogOpen(false);
        setNewTicket({ subject: '', description: '', priority: 'medium' });
        loadTickets();
      }
    } catch { toast.error('Failed to create ticket.'); } finally { setIsCreating(false); }
  };

  const handleViewTicket = async (ticketId: string) => {
    try {
      const res = await supportAPI.getTicket(ticketId);
      if (res.success) { setSelectedTicket(res.data); setView('detail'); }
    } catch { toast.error('Failed to load ticket.'); }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    setIsSendingReply(true);
    try {
      const res = await supportAPI.replyToTicket(selectedTicket.id, replyText);
      if (res.success) {
        setReplyText('');
        const updated = await supportAPI.getTicket(selectedTicket.id);
        if (updated.success) setSelectedTicket(updated.data);
        toast.success('Reply sent.');
      }
    } catch { toast.error('Failed to send reply.'); } finally { setIsSendingReply(false); }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm('Delete this ticket? This cannot be undone.')) return;
    try {
      await supportAPI.deleteTicket(ticketId);
      toast.success('Ticket deleted.');
      if (view === 'detail') { setView('list'); setSelectedTicket(null); }
      loadTickets();
    } catch { toast.error('Failed to delete ticket.'); }
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
      toast.success('Message sent! We\'ll get back to you shortly.');
      setFormData({ name: '', email: '', message: '' });
    } catch (error: any) {
      toast.error(error.message);
    } finally { setIsLoading(false); }
  };

  if (!isEnterprise) return null;

  const openCount = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;

  return (
    <div className="p-6 md:p-8 max-w-[1300px] mx-auto animate-in fade-in duration-500">
      {/* Page header */}
      <div className="mb-6">
        <DashboardPageHeader
          title="Support"
          description="Get help from our team, send a message, or book a call."
        />
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0.5 border-b border-border/60 mb-8">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'tickets') { setView('list'); setSelectedTicket(null); }
              }}
              className={cn(
                'relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px rounded-t-sm',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.id === 'tickets' && openCount > 0 && (
                <span className="ml-0.5 text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 leading-none">
                  {openCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tickets tab ── */}
      {activeTab === 'tickets' && (
        <div className="animate-in fade-in duration-200">
          {view === 'list' ? (
            <div>
              {/* Header row */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Your Tickets</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tickets.length === 0
                      ? 'No tickets yet'
                      : `${tickets.length} total · ${openCount} open`}
                  </p>
                </div>
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5 h-8 text-xs font-medium">
                      <Plus className="h-3.5 w-3.5" />
                      New Ticket
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                      <DialogTitle className="text-sm font-semibold">Create Support Ticket</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 mt-1">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Subject</Label>
                        <Input
                          value={newTicket.subject}
                          onChange={(e) => setNewTicket(p => ({ ...p, subject: e.target.value }))}
                          placeholder="Brief description of the issue"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Priority</Label>
                        <Select value={newTicket.priority} onValueChange={(v) => setNewTicket(p => ({ ...p, priority: v }))}>
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
                          onChange={(e) => setNewTicket(p => ({ ...p, description: e.target.value }))}
                          placeholder="Describe your issue in detail..."
                          className="min-h-[110px] text-sm resize-none"
                        />
                      </div>
                      <Button onClick={handleCreateTicket} disabled={isCreating} size="sm" className="w-full gap-1.5 text-xs font-medium mt-1">
                        {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Submit Ticket
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Ticket list */}
              {isLoadingTickets ? (
                <div className="flex items-center justify-center py-20 border border-border/40 rounded-xl bg-muted/20">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : tickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border/60 rounded-xl bg-muted/10 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                    <Ticket className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">No tickets yet</p>
                  <p className="text-xs text-muted-foreground mb-4">Submit a ticket and our team will respond shortly.</p>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    Create your first ticket
                  </Button>
                </div>
              ) : (
                <div className="border border-border/50 rounded-xl overflow-hidden divide-y divide-border/40 bg-card shadow-sm">
                  {tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors group"
                    >
                      {/* Priority dot */}
                      <PriorityDot priority={ticket.priority} />

                      {/* Main content — clickable */}
                      <button
                        onClick={() => handleViewTicket(ticket.id)}
                        className="flex-1 flex items-center justify-between text-left min-w-0 gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate leading-snug">{ticket.subject}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(ticket.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <StatusBadge status={ticket.status} />
                          <PriorityBadge priority={ticket.priority} />
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                        </div>
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteTicket(ticket.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive flex-shrink-0"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ── Ticket detail ── */
            <div>
              <button
                onClick={() => { setView('list'); setSelectedTicket(null); }}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                All tickets
              </button>

              {selectedTicket && (
                <div className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-sm">
                  {/* Ticket header */}
                  <div className="px-5 py-4 border-b border-border/50 bg-muted/20">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-semibold text-foreground leading-snug">{selectedTicket.subject}</h2>
                        <p className="text-[11px] text-muted-foreground mt-1">Opened {formatDateTime(selectedTicket.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                        <StatusBadge status={selectedTicket.status} />
                        <PriorityBadge priority={selectedTicket.priority} />
                        <button
                          onClick={() => handleDeleteTicket(selectedTicket.id)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive transition-colors"
                          title="Delete ticket"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Conversation thread */}
                  <div className="px-5 py-5 space-y-4">
                    {/* Original message */}
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-primary mt-0.5">
                        {(user?.name || 'U')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-semibold">{user?.name || 'You'}</span>
                          <span className="text-[10px] text-muted-foreground">{formatDateTime(selectedTicket.createdAt)}</span>
                        </div>
                        <div className="text-sm text-foreground bg-muted/30 rounded-xl rounded-tl-sm px-4 py-3 leading-relaxed whitespace-pre-wrap">
                          {selectedTicket.description}
                        </div>
                      </div>
                    </div>

                    {/* Replies */}
                    {selectedTicket.replies?.map((reply) => (
                      <div key={reply.id} className="flex gap-3">
                        <div className="w-7 h-7 rounded-full bg-violet-500/15 flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-violet-600 dark:text-violet-400 mt-0.5">
                          S
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs font-semibold">{reply.userName || 'Support Team'}</span>
                            <span className="text-[10px] text-muted-foreground">{formatDateTime(reply.createdAt)}</span>
                          </div>
                          <div className="text-sm text-foreground bg-violet-500/5 border border-violet-500/10 rounded-xl rounded-tl-sm px-4 py-3 leading-relaxed whitespace-pre-wrap">
                            {reply.message}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Reply box */}
                  {(selectedTicket.status === 'open' || selectedTicket.status === 'in_progress') && (
                    <div className="px-5 pb-5 pt-0">
                      <div className="border border-border/60 rounded-xl overflow-hidden focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                        <Textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Write a reply..."
                          className="min-h-[80px] text-sm border-0 shadow-none focus-visible:ring-0 resize-none rounded-none"
                        />
                        <div className="flex items-center justify-between px-3 py-2 border-t border-border/40 bg-muted/20">
                          <span className="text-[10px] text-muted-foreground">Markdown supported</span>
                          <Button
                            size="sm"
                            onClick={handleReply}
                            disabled={isSendingReply || !replyText.trim()}
                            className="h-7 gap-1.5 text-xs font-medium"
                          >
                            {isSendingReply ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            Send
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {(selectedTicket.status === 'resolved' || selectedTicket.status === 'closed') && (
                    <div className="px-5 pb-5 pt-0">
                      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-muted/30 border border-border/40">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        <p className="text-xs text-muted-foreground">This ticket is {selectedTicket.status}. No further replies can be added.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Contact tab ── */}
      {activeTab === 'contact' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Quick channels */}
          <div className="grid sm:grid-cols-2 gap-3">
            <a
              href="https://discord.gg/TYdPvDRA"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-xl border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/15 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
                <FaDiscord className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Discord Community</p>
                <p className="text-xs text-indigo-500/80 dark:text-indigo-400/60 mt-0.5">Get help in real-time</p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-indigo-400 group-hover:text-indigo-600 transition-colors flex-shrink-0" />
            </a>

            <div className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Email Support</p>
                <p className="text-xs text-muted-foreground mt-0.5">Reply within 24 hours</p>
              </div>
            </div>
          </div>

          {/* Contact form */}
          <div className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-sm">
            <div className="px-5 py-4 border-b border-border/50 bg-muted/20">
              <h2 className="text-sm font-semibold">Send a Message</h2>
              <p className="text-xs text-muted-foreground mt-0.5">We'll respond to your email within one business day.</p>
            </div>
            <form onSubmit={handleContactSubmit} className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-medium">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
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
                    onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                    required
                    placeholder="you@company.com"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="message" className="text-xs font-medium">Message</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData(p => ({ ...p, message: e.target.value }))}
                  required
                  placeholder="How can we help you?"
                  className="min-h-[120px] text-sm resize-none"
                />
              </div>
              <Button type="submit" size="sm" className="gap-1.5 text-xs font-medium h-8" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Send Message
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* ── Book a Call tab ── */}
      {activeTab === 'call' && (
        <div className="animate-in fade-in duration-200">
          <div className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-sm">
            <div className="px-5 py-4 border-b border-border/50 bg-muted/20">
              <h2 className="text-sm font-semibold">Book a 30-min Call</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Pick a time that works for you and we'll jump on a call.</p>
            </div>
            <div className="p-0">
              <div
                className="calendly-inline-widget w-full"
                data-url="https://calendly.com/shohagmiah2100/30min"
                style={{ minWidth: '280px', height: '660px' }}
              />
              <Script
                type="text/javascript"
                src="https://assets.calendly.com/assets/external/widget.js"
                strategy="lazyOnload"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
