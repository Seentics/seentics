'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check, Info, Lightbulb } from 'lucide-react';
import { useParams } from 'next/navigation';

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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tracking Setup</h1>
        <p className="text-muted-foreground text-sm">Install this snippet on your website to start collecting data.</p>
      </div>

      <div className="space-y-6">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative bg-muted/30 p-6 rounded border border-border/50">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Main Tracking Snippet</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-3 text-[10px] font-bold gap-2 hover:bg-background"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'COPIED!' : 'COPY CODE'}
              </Button>
            </div>
            <pre className="text-[13px] font-mono text-foreground overflow-x-auto leading-relaxed selection:bg-primary/20">
              <code>{trackingSnippet}</code>
            </pre>
          </div>
        </div>

        <div className="grid gap-6">
           <div className="flex gap-4 p-4 rounded bg-primary/5 border border-primary/10">
              <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                 <p className="text-sm font-bold">Installation Tip</p>
                 <p className="text-xs text-muted-foreground leading-relaxed">
                   Paste this code into the <code className="bg-primary/10 px-1 rounded text-primary">{'<head>'}</code> of your website. It's lightweight and won't affect your page load speed.
                 </p>
              </div>
           </div>

           <div className="flex gap-4 p-4 rounded bg-muted/30 border border-border">
              <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="space-y-1">
                 <p className="text-sm font-bold">Verifying Installation</p>
                 <p className="text-xs text-muted-foreground leading-relaxed">
                   Once installed, visit your website. Your visit should appear in the <span className="font-bold underline cursor-pointer" onClick={() => window.location.href=`/websites/${websiteId}`}>Real-time dashboard</span> within seconds.
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
