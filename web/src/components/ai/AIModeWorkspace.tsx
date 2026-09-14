'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  ChevronRight,
  Clock3,
  Database,
  GitBranch,
  History,
  Lightbulb,
  Loader2,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Send,
  Sparkles,
  WandSparkles,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { useSubscription } from '@/hooks/useSubscription';
import type { AutomationDefinition } from '@/components/automations/AutomationBuilder';

type Column = { key: string; label: string };

type AIQueryResult = {
  rows: Record<string, unknown>[];
  viz_type: 'table' | 'bar_chart' | 'line_chart' | 'pie_chart' | 'number';
  title: string;
  insight: string | null;
  tips: string | null;
  x_key: string | null;
  y_key: string | null;
  columns: Column[];
  execution_time_ms: number;
};

type HistoryItem = {
  id: string;
  prompt: string;
  title: string | null;
  created_at: string;
};

type WorkflowDraft = {
  name: string;
  summary: string;
  triggerLabel: string;
  actionLabel: string;
  note?: string;
  definition: AutomationDefinition;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  result?: AIQueryResult;
  workflow?: WorkflowDraft;
};

const SUGGESTIONS = [
  {
    title: 'Explain conversion changes',
    prompt: 'Why did conversions change this week?',
    icon: Activity,
    tone: 'text-cyan-600 bg-cyan-500/10 dark:text-cyan-300',
  },
  {
    title: 'Find visitor friction',
    prompt: 'Show me the pages with the most rage clicks',
    icon: Zap,
    tone: 'text-amber-600 bg-amber-500/10 dark:text-amber-300',
  },
  {
    title: 'Create an automation',
    prompt: 'Create a cart abandonment recovery workflow',
    icon: GitBranch,
    tone: 'text-violet-600 bg-violet-500/10 dark:text-violet-300',
  },
  {
    title: 'Discover an opportunity',
    prompt: 'Which traffic source brings the most engaged visitors?',
    icon: Lightbulb,
    tone: 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-300',
  },
] as const;

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e'];
const STORAGE_PREFIX = 'seentics-ai-mode';
const AUTOMATION_TEMPLATE_KEY = 'snc_auto_tpl';

function id() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function formatValue(value: unknown) {
  if (value == null) return '—';
  if (typeof value === 'number') return value.toLocaleString();
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}T/.test(text) ? text.slice(0, 10) : text;
}

function looksLikeWorkflowRequest(prompt: string) {
  return /\b(create|build|make|set up|setup|design|generate)\b/i.test(prompt)
    && /\b(workflow|automation|automate|campaign|sequence)\b/i.test(prompt);
}

function workflowDraftFor(prompt: string): WorkflowDraft {
  const value = prompt.toLowerCase();
  const isCart = /cart|checkout/.test(value);
  const isRage = /rage|frustrat/.test(value);
  const isForm = /form|lead/.test(value);
  const isWelcome = /welcome|onboard|sign.?up/.test(value);

  if (isCart) {
    return {
      name: 'Cart abandonment recovery',
      summary: 'Recover visitors who begin checkout but leave before completing it.',
      triggerLabel: 'Form abandoned on checkout',
      actionLabel: 'Show recovery offer',
      note: 'This supported draft responds while the visitor is still on your site. Delayed email recovery requires the upcoming durable scheduling and email connector.',
      definition: {
        triggers: [{ type: 'form_abandon', path: '/checkout' }],
        graph: {
          entry: 'recovery_modal',
          nodes: [{
            id: 'recovery_modal',
            kind: 'action',
            action: {
              type: 'show_modal',
              title: 'Still deciding?',
              body: 'Your cart is saved. Complete your order when you are ready.',
              button_text: 'Return to checkout',
              button_url: '/checkout',
            },
          }],
          edges: [],
        },
        frequency: { maxPerSession: 1 },
        abTest: { enabled: false, variants: [] },
        priority: 60,
      },
    };
  }

  if (isRage) {
    return {
      name: 'Rage-click assistance',
      summary: 'Offer immediate help when a visitor repeatedly clicks an unresponsive area.',
      triggerLabel: 'Rage click detected',
      actionLabel: 'Show help message',
      definition: {
        triggers: [{ type: 'rage_click' }],
        graph: {
          entry: 'help_toast',
          nodes: [{ id: 'help_toast', kind: 'action', action: { type: 'show_toast', message: 'Having trouble? Contact us and we will help.', position: 'bottom-right', duration_ms: 6000 } }],
          edges: [],
        },
        frequency: { maxPerSession: 1 },
        abTest: { enabled: false, variants: [] },
        priority: 70,
      },
    };
  }

  if (isWelcome) {
    return {
      name: 'New signup welcome',
      summary: 'Welcome a visitor immediately after your signup event is tracked.',
      triggerLabel: 'Custom event: signup_complete',
      actionLabel: 'Show welcome message',
      definition: {
        triggers: [{ type: 'custom_event', name: 'signup_complete' }],
        graph: {
          entry: 'welcome_toast',
          nodes: [{ id: 'welcome_toast', kind: 'action', action: { type: 'show_toast', message: 'Welcome! Your account is ready.', position: 'bottom-right', duration_ms: 5000 } }],
          edges: [],
        },
        frequency: { maxPerUser: 1 },
        abTest: { enabled: false, variants: [] },
        priority: 50,
      },
    };
  }

  return {
    name: isForm ? 'Form abandonment recovery' : 'AI-created visitor workflow',
    summary: isForm
      ? 'Help visitors return to a form they started but did not submit.'
      : 'A safe starter workflow based on your request. Refine its event and message in the builder.',
    triggerLabel: isForm ? 'Form abandoned' : 'Custom event: workflow_trigger',
    actionLabel: 'Show contextual message',
    definition: {
      triggers: [{ type: isForm ? 'form_abandon' : 'custom_event', ...(isForm ? {} : { name: 'workflow_trigger' }) }],
      graph: {
        entry: 'context_message',
        nodes: [{ id: 'context_message', kind: 'action', action: { type: 'show_toast', message: 'Need a hand? We are here to help.', position: 'bottom-right', duration_ms: 5000 } }],
        edges: [],
      },
      frequency: { maxPerSession: 1 },
      abTest: { enabled: false, variants: [] },
      priority: 50,
    },
  };
}

function demoResultFor(prompt: string): AIQueryResult {
  const lower = prompt.toLowerCase();
  if (/source|referr/.test(lower)) {
    return {
      viz_type: 'bar_chart',
      title: 'Engaged visitors by source',
      insight: 'Organic search brings the largest engaged audience, while GitHub visitors spend the most time per session.',
      tips: '• Protect the pages ranking in organic search.\n• Study the GitHub landing path and reuse its message in other campaigns.',
      x_key: 'source', y_key: 'visitors', execution_time_ms: 38,
      columns: [{ key: 'source', label: 'Source' }, { key: 'visitors', label: 'Engaged visitors' }],
      rows: [
        { source: 'Google', visitors: 8420 },
        { source: 'Direct', visitors: 5310 },
        { source: 'GitHub', visitors: 1874 },
        { source: 'LinkedIn', visitors: 987 },
      ],
    };
  }
  if (/rage|friction|error/.test(lower)) {
    return {
      viz_type: 'table',
      title: 'Pages with the most visitor friction',
      insight: 'The pricing page accounts for almost half of detected rage-click sessions.',
      tips: '• Review pricing CTA replays first.\n• Test whether an invisible overlay blocks clicks on mobile.',
      x_key: null, y_key: null, execution_time_ms: 31,
      columns: [{ key: 'page', label: 'Page' }, { key: 'sessions', label: 'Rage-click sessions' }, { key: 'share', label: 'Share' }],
      rows: [
        { page: '/pricing', sessions: 241, share: '47%' },
        { page: '/checkout', sessions: 126, share: '25%' },
        { page: '/features', sessions: 83, share: '16%' },
      ],
    };
  }
  return {
    viz_type: 'line_chart',
    title: 'Visitors over the last 7 days',
    insight: 'Traffic is up 14% week over week, with the strongest growth during the last three days.',
    tips: '• Compare the recent lift with campaign launches.\n• Check whether conversion rate increased with traffic.',
    x_key: 'day', y_key: 'visitors', execution_time_ms: 27,
    columns: [{ key: 'day', label: 'Day' }, { key: 'visitors', label: 'Visitors' }],
    rows: [
      { day: 'Mon', visitors: 1240 }, { day: 'Tue', visitors: 1380 },
      { day: 'Wed', visitors: 1310 }, { day: 'Thu', visitors: 1590 },
      { day: 'Fri', visitors: 1820 }, { day: 'Sat', visitors: 1710 },
      { day: 'Sun', visitors: 1940 },
    ],
  };
}

function ResultArtifact({ result }: { result: AIQueryResult }) {
  const xKey = result.x_key ?? result.columns[0]?.key ?? '';
  const yKey = result.y_key ?? result.columns[1]?.key ?? result.columns[0]?.key ?? '';
  const chartStyle = { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 };

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{result.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Analyzed in {result.execution_time_ms}ms</p>
        </div>
        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-300">Live data</span>
      </div>

      <div className="p-5">
        {result.viz_type === 'number' ? (
          <div className="flex min-h-36 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/5">
            <p className="text-5xl font-bold tracking-tight text-indigo-600 dark:text-indigo-300">{formatValue(result.rows[0]?.[yKey])}</p>
          </div>
        ) : result.viz_type === 'bar_chart' ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={result.rows.slice(0, 16)} margin={{ top: 10, right: 10, left: 0, bottom: 6 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.65} />
                <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={52} />
                <Tooltip contentStyle={chartStyle} />
                <Bar dataKey={yKey} fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={54} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : result.viz_type === 'line_chart' ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.rows} margin={{ top: 10, right: 10, left: 0, bottom: 6 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.65} />
                <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={52} />
                <Tooltip contentStyle={chartStyle} />
                <Line dataKey={yKey} type="monotone" stroke="#6366f1" strokeWidth={3} dot={{ r: 3, fill: '#6366f1' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : result.viz_type === 'pie_chart' ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={result.rows} dataKey={yKey} nameKey={xKey} innerRadius={60} outerRadius={100} paddingAngle={3}>
                  {result.rows.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={chartStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-muted/55 text-muted-foreground">
                <tr>{result.columns.map(column => <th key={column.key} className="px-4 py-3 font-medium">{column.label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {result.rows.slice(0, 50).map((row, rowIndex) => (
                  <tr key={rowIndex} className="transition-colors hover:bg-muted/30">
                    {result.columns.map(column => <td key={column.key} className="px-4 py-3 text-foreground/85">{formatValue(row[column.key])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result.insight && (
          <div className="mt-4 flex gap-3 rounded-xl bg-indigo-500/8 p-4 text-sm leading-6 text-foreground/85">
            <Sparkles className="mt-1 h-4 w-4 shrink-0 text-indigo-500" />
            <p>{result.insight}</p>
          </div>
        )}
        {result.tips && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recommended next steps</p>
            <div className="space-y-2">
              {result.tips.split('\n').filter(Boolean).map((tip, index) => (
                <div key={index} className="flex gap-2.5 text-sm leading-6 text-foreground/75">
                  <Check className="mt-1.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <span>{tip.replace(/^[•*-]\s*/, '')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function WorkflowArtifact({ draft, onReview }: { draft: WorkflowDraft; onReview: () => void }) {
  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-violet-500/25 bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-gradient-to-r from-violet-500/10 to-indigo-500/5 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-violet-500" />
            <p className="font-semibold text-foreground">{draft.name}</p>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{draft.summary}</p>
        </div>
        <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">Draft · Not active</span>
      </div>

      <div className="p-5">
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-600 dark:text-emerald-300"><Zap className="h-4 w-4" /></span>
            <div className="min-w-0"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">When</p><p className="truncate text-sm font-semibold">{draft.triggerLabel}</p></div>
          </div>
          <ArrowRight className="mx-auto h-5 w-5 rotate-90 text-muted-foreground/50 sm:rotate-0" />
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/12 text-violet-600 dark:text-violet-300"><WandSparkles className="h-4 w-4" /></span>
            <div className="min-w-0"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Then</p><p className="truncate text-sm font-semibold">{draft.actionLabel}</p></div>
          </div>
        </div>

        {draft.note && <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/7 px-4 py-3 text-sm leading-6 text-amber-800 dark:text-amber-200">{draft.note}</p>}

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
          <p className="text-xs text-muted-foreground">Review every setting before saving or activating.</p>
          <button onClick={onReview} className="flex h-9 shrink-0 items-center gap-2 rounded-lg bg-violet-600 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700">
            Review in builder <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

export function AIModeWorkspace({ websiteId }: { websiteId: string }) {
  const router = useRouter();
  const { subscription } = useSubscription();
  const usage = subscription?.usage?.aiAnalyses;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const isDemo = websiteId === 'demo';
  const storageKey = `${STORAGE_PREFIX}:${websiteId}`;
  const limitReached = Boolean(usage && !usage.canCreate);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setMessages(JSON.parse(saved) as ChatMessage[]);
    } catch { /* ignore invalid local state */ }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(storageKey, JSON.stringify(messages.slice(-30)));
  }, [hydrated, messages, storageKey]);

  useEffect(() => {
    if (isDemo) return;
    api.get(`/ai/history/${websiteId}?limit=10`)
      .then(response => setHistory(response.data.data ?? []))
      .catch(() => undefined);
  }, [isDemo, websiteId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const recentPrompts = useMemo(() => history.slice(0, 8), [history]);

  const reviewWorkflow = useCallback((draft: WorkflowDraft) => {
    localStorage.setItem(AUTOMATION_TEMPLATE_KEY, JSON.stringify({ name: draft.name, definition: draft.definition }));
    router.push(`/websites/${websiteId}/automations/new`);
  }, [router, websiteId]);

  const submit = useCallback(async (value?: string) => {
    const question = (value ?? prompt).trim();
    if (!question || loading || limitReached) return;

    const userMessage: ChatMessage = { id: id(), role: 'user', text: question };
    setMessages(current => [...current, userMessage]);
    setPrompt('');
    setLoading(true);

    try {
      if (looksLikeWorkflowRequest(question)) {
        await new Promise(resolve => window.setTimeout(resolve, 650));
        const workflow = workflowDraftFor(question);
        setMessages(current => [...current, {
          id: id(),
          role: 'assistant',
          text: 'I prepared a reviewable workflow using actions Seentics supports today. It is not active, and you can adjust every trigger and action in the visual builder.',
          workflow,
        }]);
      } else {
        const result = isDemo
          ? await new Promise<AIQueryResult>(resolve => window.setTimeout(() => resolve(demoResultFor(question)), 900))
          : (await api.post(`/ai/query/${websiteId}`, { prompt: question, domain: 'auto' })).data.data as AIQueryResult;

        setMessages(current => [...current, {
          id: id(),
          role: 'assistant',
          text: result.insight || `Here is what I found for “${question}”.`,
          result,
        }]);

        if (!isDemo) {
          api.get(`/ai/history/${websiteId}?limit=10`)
            .then(response => setHistory(response.data.data ?? []))
            .catch(() => undefined);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI Mode could not complete that request.';
      setMessages(current => [...current, { id: id(), role: 'assistant', text: message }]);
    } finally {
      setLoading(false);
    }
  }, [isDemo, limitReached, loading, prompt, websiteId]);

  const startNewConversation = () => {
    setMessages([]);
    setPrompt('');
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  return (
    <div className="flex h-screen min-h-0 w-full overflow-hidden bg-background text-foreground">
      <aside className={cn(
        'hidden shrink-0 flex-col border-r border-border/70 bg-card/60 transition-[width] duration-200 lg:flex',
        sidebarOpen ? 'w-[280px]' : 'w-[72px]',
      )}>
        <div className={cn('flex h-16 items-center border-b border-border/70', sidebarOpen ? 'justify-between px-4' : 'justify-center')}>
          {sidebarOpen && (
            <button onClick={() => router.push(`/websites/${websiteId}`)} className="flex items-center gap-2.5" aria-label="Back to dashboard">
              <Logo size="sm" />
              <span className="font-bold tracking-tight text-primary">Seentics</span>
            </button>
          )}
          <button onClick={() => setSidebarOpen(open => !open)} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label={sidebarOpen ? 'Collapse history' : 'Expand history'}>
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
        </div>

        <div className={cn('flex-1 overflow-y-auto py-4', sidebarOpen ? 'px-3' : 'px-2')}>
          <button onClick={startNewConversation} className={cn('flex h-10 w-full items-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90', sidebarOpen ? 'gap-2 px-3' : 'justify-center')}>
            <Plus className="h-4 w-4 shrink-0" />
            {sidebarOpen && <span className="text-sm font-semibold">New conversation</span>}
          </button>

          {sidebarOpen && (
            <div className="mt-6">
              <div className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <History className="h-3.5 w-3.5" /> Recent questions
              </div>
              <div className="space-y-1">
                {recentPrompts.length ? recentPrompts.map(item => (
                  <button key={item.id} onClick={() => { setPrompt(item.prompt); textareaRef.current?.focus(); }} className="w-full rounded-lg px-2.5 py-2.5 text-left text-sm leading-5 text-foreground/70 transition-colors hover:bg-muted hover:text-foreground">
                    <span className="line-clamp-2">{item.prompt}</span>
                  </button>
                )) : (
                  <p className="px-2.5 py-3 text-sm leading-5 text-muted-foreground">Your recent questions will appear here.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {sidebarOpen && (
          <div className="border-t border-border/70 p-3">
            <div className="rounded-xl bg-muted/55 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">AI analyses</span>
                <span className="font-semibold">{usage ? (usage.limit === -1 ? `${usage.current} used` : `${usage.current}/${usage.limit}`) : 'Available'}</span>
              </div>
              {usage && usage.limit > 0 && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, usage.current / usage.limit * 100)}%` }} /></div>}
            </div>
          </div>
        )}
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/70 bg-background/90 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push(`/websites/${websiteId}`)} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden" aria-label="Back to dashboard"><ArrowLeft className="h-4 w-4" /></button>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-sm shadow-violet-500/20"><Sparkles className="h-4 w-4" /></span>
            <div>
              <div className="flex items-center gap-2"><h1 className="font-semibold">AI Mode</h1><span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-300">Beta</span></div>
              <p className="hidden text-xs text-muted-foreground sm:block">Ask, investigate, and build with your website data</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={startNewConversation} className="hidden h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted sm:flex"><Plus className="h-4 w-4" /> New chat</button>
            <ThemeToggle />
            <button onClick={() => router.push(`/websites/${websiteId}`)} className="hidden h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"><ArrowLeft className="h-4 w-4" /> Dashboard</button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-[900px] flex-col px-4 py-8 sm:px-6">
            {messages.length === 0 ? (
              <div className="my-auto py-8">
                <div className="mx-auto max-w-2xl text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/20"><WandSparkles className="h-6 w-6" /></span>
                  <h2 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">What do you want to understand or improve?</h2>
                  <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-muted-foreground">Ask in plain English. AI Mode can analyze performance, uncover friction, and prepare automations for review.</p>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {SUGGESTIONS.map(({ title, prompt: suggestion, icon: Icon, tone }) => (
                    <button key={suggestion} onClick={() => submit(suggestion)} className="group rounded-2xl border border-border/80 bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-500/35 hover:shadow-md">
                      <div className="flex items-start gap-3">
                        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', tone)}><Icon className="h-4 w-4" /></span>
                        <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-sm leading-5 text-muted-foreground">{suggestion}</p></div>
                        <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Database className="h-3.5 w-3.5" /> Scoped to this website</span>
                  <span className="flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Live visual answers</span>
                  <span className="flex items-center gap-1.5"><GitBranch className="h-3.5 w-3.5" /> Review-first automations</span>
                </div>
              </div>
            ) : (
              <div className="space-y-7 pb-5">
                {messages.map(message => (
                  <article key={message.id} className={cn('flex gap-3', message.role === 'user' && 'justify-end')}>
                    {message.role === 'assistant' && <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white"><Bot className="h-4 w-4" /></span>}
                    <div className={cn('min-w-0', message.role === 'user' ? 'max-w-[78%]' : 'max-w-[calc(100%-44px)] flex-1')}>
                      <div className={cn('text-base leading-7', message.role === 'user' ? 'rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground' : 'pt-0.5 text-foreground/90')}>
                        {message.text}
                      </div>
                      {message.result && <ResultArtifact result={message.result} />}
                      {message.workflow && <WorkflowArtifact draft={message.workflow} onReview={() => reviewWorkflow(message.workflow!)} />}
                    </div>
                  </article>
                ))}
                {loading && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500"><Loader2 className="h-4 w-4 animate-spin" /></span>
                    <span>Understanding your request and checking the relevant data…</span>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-border/60 bg-background/95 px-4 pb-4 pt-3 backdrop-blur-md sm:px-6 sm:pb-5">
          <form onSubmit={event => { event.preventDefault(); submit(); }} className="mx-auto max-w-[900px]">
            {limitReached && <p className="mb-2 text-center text-sm text-amber-600 dark:text-amber-300">Your current AI analysis limit has been reached.</p>}
            <div className="rounded-2xl border border-border bg-card p-2 shadow-lg shadow-black/5 transition-colors focus-within:border-indigo-500/50 dark:shadow-black/20">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={event => setPrompt(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    submit();
                  }
                }}
                rows={2}
                maxLength={500}
                disabled={loading || limitReached}
                placeholder="Ask about your data or describe an automation…"
                className="max-h-36 min-h-14 w-full resize-none bg-transparent px-3 py-2 text-base leading-6 outline-none placeholder:text-muted-foreground/55 disabled:cursor-not-allowed"
              />
              <div className="flex items-center justify-between gap-3 px-2 pb-1">
                <p className="text-xs text-muted-foreground"><span className="hidden sm:inline">Enter to send · Shift+Enter for a new line · </span>{prompt.length}/500</p>
                <button type="submit" disabled={!prompt.trim() || loading || limitReached} className="flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span className="hidden sm:inline">Send</span>
                </button>
              </div>
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">AI can make mistakes. Review insights and automation settings before acting.</p>
          </form>
        </div>
      </main>
    </div>
  );
}
