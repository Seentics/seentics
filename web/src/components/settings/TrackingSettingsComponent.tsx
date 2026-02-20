'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check, Info, Lightbulb } from 'lucide-react';

export function TrackingSettingsComponent({ websiteId }: { websiteId: string }) {
  const [copied, setCopied] = React.useState(false);

  const [origin, setOrigin] = React.useState('');

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

const trackingSnippet = `<!-- Seentics Analytics -->
<script 
  defer 
  data-website-id="${websiteId}" 
  data-auto-load="analytics,automation,funnels,replay,heatmap"
  src="${origin}/trackers/seentics-core.js"
></script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(trackingSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Tracking Setup</h2>
        <p className="text-muted-foreground text-sm">Install this snippet on your website to start collecting data.</p>
      </div>

      <div className="space-y-6">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative bg-muted/30 p-8 rounded border border-border/50">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">Main Tracking Snippet</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-4 text-[10px] font-black gap-2 bg-background/50 hover:bg-background shadow-sm border border-border/40 transition-all rounded"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'COPIED!' : 'COPY CODE'}
              </Button>
            </div>
            <pre className="text-[13px] font-mono text-foreground overflow-x-auto leading-relaxed selection:bg-primary/20 p-4 rounded bg-muted/20 border border-border/20">
              <code>{trackingSnippet}</code>
            </pre>
          </div>
        </div>

        <div className="grid gap-6">
           <div className="flex gap-4 p-6 rounded bg-primary/5 border border-primary/10">
              <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                <Lightbulb className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                 <p className="text-sm font-bold">Installation Tip</p>
                 <p className="text-xs text-muted-foreground leading-relaxed">
                   Paste this code into the <code className="bg-primary/10 px-1 rounded text-primary font-bold">{'<head>'}</code> of your website. It's lightweight (under 2kb) and won't affect your page load speed or Lighthouse scores.
                 </p>
              </div>
           </div>

           <div className="flex gap-4 p-6 rounded bg-muted/30 border border-border/50">
              <div className="w-10 h-10 rounded bg-muted/20 flex items-center justify-center border border-border/50 shrink-0">
                <Info className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                 <p className="text-sm font-bold">Verifying Installation</p>
                 <p className="text-xs text-muted-foreground leading-relaxed">
                   Once installed, visit your website. Your visit should appear in the <span className="font-bold text-primary hover:underline cursor-pointer" onClick={() => window.open(`/websites/${websiteId}`, '_blank')}>Real-time dashboard</span> within seconds.
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
