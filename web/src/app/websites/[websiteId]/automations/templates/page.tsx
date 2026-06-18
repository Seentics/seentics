'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { cn } from '@/lib/utils';
import type { AutomationDefinition } from '@/components/automations/AutomationBuilder';

const TPL_KEY = 'snc_auto_tpl';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  categoryColor: string;
  definition: AutomationDefinition;
}

const TEMPLATES: Template[] = [
  {
    id: 'exit-intent-discount',
    name: 'Exit-Intent Discount Modal',
    description: 'Show a last-chance offer when a visitor is about to leave.',
    category: 'Conversion',
    categoryColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300',
    definition: {
      trigger: { type: 'exit_intent' },
      conditions: null,
      actions: [{
        type: 'show_modal',
        title: 'Wait! Before you go…',
        body: 'Grab 20% off your first order — today only.',
        button_text: 'Claim offer',
        button_url: '/checkout',
      }],
      frequency: { maxPerSession: 1, cooldownDays: 3 },
    },
  },
  {
    id: 'welcome-new-visitors',
    name: 'Welcome New Visitors',
    description: 'Greet first-time visitors with a friendly toast notification.',
    category: 'Engagement',
    categoryColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
    definition: {
      trigger: { type: 'page_view' },
      conditions: { operator: 'AND', rules: [{ fact: 'visitCount', operator: 'equals', value: '1' }] },
      actions: [{
        type: 'show_toast',
        message: 'Welcome! 👋 Explore our features below.',
        position: 'bottom-right',
        duration_ms: 5000,
      }],
      frequency: { maxPerUser: 1 },
    },
  },
  {
    id: 'rage-click-support',
    name: 'Rage Click → Live Support',
    description: 'Offer help when a visitor clicks the same spot repeatedly out of frustration.',
    category: 'Support',
    categoryColor: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300',
    definition: {
      trigger: { type: 'rage_click' },
      conditions: null,
      actions: [
        { type: 'show_toast', message: 'Having trouble? Our support team is here to help.', position: 'bottom-right', duration_ms: 6000 },
        { type: 'webhook', url: '', method: 'POST', body: { text: 'Rage click detected — visitor may need help on {{page}}' } },
      ],
      frequency: { maxPerSession: 1 },
    },
  },
  {
    id: 'pricing-page-followup',
    name: 'Pricing Page Follow-up',
    description: 'Catch returning visitors on your pricing page and offer a demo.',
    category: 'Conversion',
    categoryColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300',
    definition: {
      trigger: { type: 'page_view', path: '/pricing', match_type: 'exact' },
      conditions: { operator: 'AND', rules: [{ fact: 'visitCount', operator: 'greaterThan', value: '2' }] },
      actions: [{
        type: 'show_modal',
        title: 'Need help choosing a plan?',
        body: "You've visited our pricing page a few times. Let's find the right fit — book a free 15-min call.",
        button_text: 'Book a demo',
        button_url: '/demo',
      }],
      frequency: { maxPerSession: 1, cooldownDays: 7 },
    },
  },
  {
    id: 'form-abandon-recovery',
    name: 'Form Abandonment Recovery',
    description: 'Offer help when a visitor starts a form but navigates away.',
    category: 'Recovery',
    categoryColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
    definition: {
      trigger: { type: 'form_abandon' },
      conditions: null,
      actions: [{
        type: 'show_toast',
        message: 'Need help filling out the form? Chat with us →',
        position: 'bottom-right',
        duration_ms: 7000,
      }],
      frequency: { maxPerSession: 1 },
    },
  },
  {
    id: 'scroll-depth-subscribe',
    name: 'Scroll-Depth Subscribe Banner',
    description: 'Prompt engaged readers to subscribe after they scroll 75% of the page.',
    category: 'Engagement',
    categoryColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
    definition: {
      trigger: { type: 'scroll_depth', depth: 75 },
      conditions: null,
      actions: [{
        type: 'show_banner',
        message: 'Enjoying the content? Subscribe for weekly insights.',
        position: 'bottom',
        button_text: 'Subscribe',
        button_url: '/newsletter',
      }],
      frequency: { maxPerSession: 1, cooldownDays: 14 },
    },
  },
  {
    id: 'long-session-upsell',
    name: 'Long Session Upsell',
    description: 'Surface an upsell modal after a visitor has been engaged for 2 minutes.',
    category: 'Upsell',
    categoryColor: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300',
    definition: {
      trigger: { type: 'time_on_page', seconds: 120 },
      conditions: null,
      actions: [{
        type: 'show_modal',
        title: "You've been exploring for a while!",
        body: "Unlock premium features and save 30% with our annual plan.",
        button_text: 'See plans',
        button_url: '/pricing',
      }],
      frequency: { maxPerSession: 1, cooldownDays: 7 },
    },
  },
  {
    id: 'js-error-recovery',
    name: 'JS Error Recovery',
    description: 'Apologize and alert your team when a JS error hits a visitor.',
    category: 'Support',
    categoryColor: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300',
    definition: {
      trigger: { type: 'js_error' },
      conditions: null,
      actions: [
        { type: 'show_toast', message: 'Something went wrong. Try refreshing the page.', position: 'top-right', duration_ms: 8000 },
        { type: 'webhook', url: '', method: 'POST', body: { text: 'JS error on {{page}} — visitor: {{user.anonymousId}}' } },
      ],
      frequency: { maxPerSession: 3 },
    },
  },
  {
    id: 'inactivity-reengage',
    name: 'Inactivity Re-engage',
    description: 'Nudge visitors who have been idle for 60 seconds.',
    category: 'Re-engagement',
    categoryColor: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300',
    definition: {
      trigger: { type: 'inactivity', seconds: 60 },
      conditions: null,
      actions: [{
        type: 'show_modal',
        title: 'Still there?',
        body: "Here's something you might have missed while you were away.",
        button_text: 'Take me there',
        button_url: '/features',
      }],
      frequency: { maxPerSession: 1 },
    },
  },
  {
    id: 'cta-click-webhook',
    name: 'CTA Click → Webhook',
    description: 'Fire a webhook to your CRM whenever a visitor clicks the main CTA.',
    category: 'Integration',
    categoryColor: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300',
    definition: {
      trigger: { type: 'click', selector: '#cta-button, .cta-primary' },
      conditions: null,
      actions: [{
        type: 'webhook',
        url: '',
        method: 'POST',
        body: { event: 'cta_click', page: '{{page}}', user: '{{user.id}}' },
      }],
      frequency: { maxPerSession: 5 },
    },
  },
  {
    id: 'identify-tag-session',
    name: 'Identify → Tag Session',
    description: 'Automatically tag sessions by user plan when a visitor identifies.',
    category: 'Segmentation',
    categoryColor: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-300',
    definition: {
      trigger: { type: 'identify' },
      conditions: null,
      actions: [{ type: 'tag_session', tag: '{{user.plan | default:free}}' }],
      frequency: { maxPerSession: 1 },
    },
  },
  {
    id: 'tab-return-banner',
    name: 'Tab Return Banner',
    description: "Welcome visitors back when they return to the tab after switching away.",
    category: 'Engagement',
    categoryColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
    definition: {
      trigger: { type: 'tab_visible' },
      conditions: null,
      actions: [{
        type: 'show_banner',
        message: "Welcome back! Don't miss our latest update.",
        position: 'top',
        button_text: "See what's new",
        button_url: '/changelog',
        duration_ms: 6000,
      }],
      frequency: { maxPerSession: 1, cooldownDays: 1 },
    },
  },
];

const CATEGORIES = ['All', 'Conversion', 'Engagement', 'Support', 'Recovery', 'Upsell', 'Re-engagement', 'Integration', 'Segmentation'];

export default function AutomationTemplatesPage() {
  const params    = useParams();
  const router    = useRouter();
  const websiteId = params?.websiteId as string;

  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = activeCategory === 'All'
    ? TEMPLATES
    : TEMPLATES.filter(t => t.category === activeCategory);

  const useTemplate = (tpl: Template) => {
    try {
      localStorage.setItem(TPL_KEY, JSON.stringify({ name: tpl.name, definition: tpl.definition }));
    } catch { /* private mode */ }
    router.push(`/websites/${websiteId}/automations/new`);
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => router.push(`/websites/${websiteId}/automations`)}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Automations
        </Button>
      </div>

      <DashboardPageHeader
        websiteId={websiteId}
        title="Automation Templates"
        description="Start from a pre-built template and customise it to fit your needs."
      />

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              activeCategory === cat
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:text-foreground hover:border-primary/40',
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(tpl => (
          <div
            key={tpl.id}
            className="flex flex-col rounded-xl border border-border/60 bg-card p-5 hover:border-primary/40 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <Badge className={cn('text-[10px] border h-5 shrink-0', tpl.categoryColor)}>
                {tpl.category}
              </Badge>
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">{tpl.name}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed flex-1">{tpl.description}</p>
            <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary" className="text-[9px] h-4">
                  {tpl.definition.trigger.type.replace('_', ' ')}
                </Badge>
                {tpl.definition.actions.slice(0, 2).map((a, i) => (
                  <Badge key={i} variant="outline" className="text-[9px] h-4">
                    {a.type.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
              <Button
                size="sm"
                className="h-7 text-xs shrink-0"
                onClick={() => useTemplate(tpl)}
              >
                Use template
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
