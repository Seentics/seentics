'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Copy, Check, Info, Lightbulb } from 'lucide-react';
import { useParams } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard-header';

export default function TrackingSettings() {
  const params = useParams();
  const websiteId = params?.websiteId as string;
  const [copied, setCopied] = React.useState(false);

  const trackingSnippet = `<!-- Seentics Analytics -->
<script
  defer
  data-website-id="${websiteId}"
  src="https://app.seentics.com/script.js"
></script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(trackingSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 sm:p-8 space-y-8 animate-in fade-in duration-500 max-w-[1440px] mx-auto">
      <DashboardPageHeader
        title="Tracking Setup"
        description="Install the snippet on your website to start collecting analytics data."
      />

      <div className="space-y-6">
        {/* Tracking Snippet */}
        <Card className="border border-border/60 bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Main Tracking Snippet</h3>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-medium"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy Code'}
              </Button>
            </div>
            <div className="bg-muted/30 border border-border/50 rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm font-mono text-foreground leading-relaxed">
                <code>{trackingSnippet}</code>
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Tips */}
        <div className="grid sm:grid-cols-2 gap-3">
          <Card className="border border-border/60 bg-card shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Lightbulb className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-1">Installation</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Paste this code into the <code className="bg-muted px-1 rounded text-foreground">{'<head>'}</code> of your website. It&apos;s lightweight and won&apos;t affect page load speed.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/60 bg-card shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <Info className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-1">Verification</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Once installed, visit your website. Your visit should appear in the{' '}
                    <a href={`/websites/${websiteId}`} className="text-primary hover:underline">real-time dashboard</a>{' '}
                    within seconds.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
