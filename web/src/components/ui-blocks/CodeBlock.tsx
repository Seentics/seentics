'use client';

import { useState } from 'react';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Layout, Copy, Check, Code2, Eye, Users, TrendingUp, Globe, Zap, ExternalLink, Search, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export function CodeBlock({ code }: { code: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast({ title: 'Copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="text-xs font-mono bg-muted/50 border border-border rounded-lg px-4 py-3 text-foreground/90 overflow-x-auto whitespace-pre leading-relaxed">
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
