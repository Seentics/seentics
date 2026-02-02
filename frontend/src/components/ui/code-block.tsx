"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";

type CodeBlockProps = {
  code: string;
  title?: string;
  className?: string;
  language?: string;
};

export default function CodeBlock({ code, title, className }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      const timer = setTimeout(() => setCopied(false), 1500);
      return () => clearTimeout(timer);
    } catch {
      // noop
    }
  };

  return (
    <div
      className={cn(
        "rounded border border-border bg-card shadow-sm overflow-hidden",
        className
      )}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="text-xs font-medium text-muted-foreground">
          {title}
        </div>
        <Button variant="outline" size="sm" onClick={onCopy} className="h-8 px-2">
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </Button>
      </div>
      <pre className="bg-slate-950 dark:bg-black/50 text-slate-100 text-sm p-4 overflow-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}


