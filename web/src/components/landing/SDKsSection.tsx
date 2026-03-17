'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check } from 'lucide-react';

const components = [
  {
    name: 'SummaryCards',
    code: `import { SummaryCards } from '@seentics/react';

export default function Dashboard() {
  return (
    <SummaryCards
      websiteId="abc123"
      dateRange={{ start: '2026-03-01', end: '2026-03-17' }}
    />
  );
}`,
  },
  {
    name: 'TrafficChart',
    code: `import { TrafficOverview } from '@seentics/react';

export default function Dashboard() {
  return (
    <TrafficOverview
      websiteId="abc123"
      granularity="daily"
    />
  );
}`,
  },
  {
    name: 'TopPages',
    code: `import { TopPagesChart } from '@seentics/react';

export default function Dashboard() {
  return (
    <TopPagesChart
      websiteId="abc123"
      limit={10}
      sortBy="pageviews"
    />
  );
}`,
  },
];

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-muted hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

export default function UIBlocksSection() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <section className="py-16 md:py-20 bg-background">
      <div className="container mx-auto px-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-xs font-semibold uppercase tracking-widest text-primary mb-2"
            >
              UI Components
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="text-2xl md:text-3xl font-bold text-foreground"
            >
              React components, ready to use
            </motion.h2>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4 border-b border-border/50">
            {components.map((comp, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === i
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {comp.name}
              </button>
            ))}
          </div>

          {/* Code Block */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="relative bg-muted/50 rounded-lg border border-border/50 p-4 overflow-x-auto"
          >
            <CopyButton code={components[activeTab].code} />
            <pre className="text-xs font-mono text-foreground/80 leading-relaxed pr-8">
              <code>{components[activeTab].code}</code>
            </pre>
          </motion.div>

          {/* CTA */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            <a href="/docs" className="text-primary hover:underline font-medium">
              Explore all components in the docs →
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

