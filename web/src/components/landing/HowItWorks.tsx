'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Copy } from 'lucide-react';
import { useAuth } from '@/stores/useAuthStore';

const SNIPPET = `<script
  defer
  data-website-id="YOUR_WEBSITE_ID"
  src="https://app.seentics.com/trackers/seentics.min.js"
></script>`;

const STEPS = [
  { title: 'Create a free account', body: 'No credit card. Add as many websites as you like.' },
  { title: 'Paste one script tag', body: 'A lightweight, cookie-free tracker with built-in consent controls.' },
  { title: 'See data in seconds', body: 'Visitors appear live. Turn on replays, heatmaps or automations whenever you want.' },
];

/** Three steps and the actual snippet: the "how hard is this?" objection, answered. */
export default function HowItWorks() {
  const { isAuthenticated } = useAuth();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the snippet is still selectable */
    }
  };

  return (
    <section id="how-it-works" className="landing-section">
      <div className="landing-container">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <p className="landing-eyebrow">Setup</p>
          <h2 className="landing-h2 mb-4">Live in about two minutes</h2>
          <p className="landing-lead">No SDK to wire up and no engineering ticket. One line of HTML.</p>
        </div>

        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <ol className="space-y-6">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <div>
                  <h3 className="landing-h3 mb-1">{step.title}</h3>
                  <p className="landing-body text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="landing-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-muted/35 px-4 py-2.5">
              <span className="text-xs font-medium text-muted-foreground">index.html</span>
              <button
                onClick={copy}
                className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:border-primary/40"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="overflow-x-auto p-5 text-[13px] leading-relaxed text-foreground/90"><code>{SNIPPET}</code></pre>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link
            href={isAuthenticated ? '/websites' : '/signup'}
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
