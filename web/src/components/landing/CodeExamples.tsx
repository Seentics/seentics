'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check } from 'lucide-react';

const examples = [
  {
    name: 'Collect Events',
    code: `curl -X POST https://your-instance.com/api/v1/tracker/collect \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "pageview",
    "site_id": "abc123",
    "url": "https://yourapp.com/pricing"
  }'`,
  },
  {
    name: 'Dashboard Stats',
    code: `const response = await fetch(
  'https://your-instance.com/api/v1/analytics/dashboard/abc123',
  { headers: { 'Authorization': 'Bearer TOKEN' } }
);
const data = await response.json();
console.log(data.visitors); // 12840`,
  },
  {
    name: 'Real-time Visitors',
    code: `const response = await fetch(
  'https://your-instance.com/api/v1/analytics/realtime/abc123',
  { headers: { 'Authorization': 'Bearer TOKEN' } }
);
const { active_visitors } = await response.json();
console.log(active_visitors); // 47`,
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

export default function APISection() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <section className="py-16 md:py-20 bg-muted/20">
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
              API Examples
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="text-2xl md:text-3xl font-bold text-foreground"
            >
              Simple REST APIs
            </motion.h2>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4 border-b border-border/50">
            {examples.map((ex, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === i
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {ex.name}
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
            <CopyButton code={examples[activeTab].code} />
            <pre className="text-xs font-mono text-foreground/80 leading-relaxed pr-8">
              <code>{examples[activeTab].code}</code>
            </pre>
          </motion.div>

          {/* CTA */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            <a href="/docs/api" className="text-primary hover:underline font-medium">
              View full API documentation →
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

