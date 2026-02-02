'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getWebsites } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { 
  Search, 
  Globe, 
  Settings, 
  BarChart3, 
  Zap, 
  Filter, 
  Plus,
  Command as CommandIcon,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();
  const { user } = useAuth();

  const { data: websites, isLoading } = useQuery({
    queryKey: ['websites'],
    queryFn: () => getWebsites(user?.id || ''),
    enabled: open && !!user?.id,
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  const filteredWebsites = websites?.filter(w => 
    w.name.toLowerCase().includes(query.toLowerCase()) || 
    w.url.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 5);

  const navigation = [
    { id: 'dashboard', label: 'All Websites', icon: BarChart3, href: '/websites' },
    { id: 'automations', label: 'Automations', icon: Zap, href: '/automations' },
    { id: 'funnels', label: 'Funnels', icon: Filter, href: '/funnels' },
    { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
  ].filter(n => n.label.toLowerCase().includes(query.toLowerCase()));

  const actions = [
    { id: 'add-website', label: 'Add New Website', icon: Plus, action: () => router.push('/websites?add=true') },
  ].filter(a => a.label.toLowerCase().includes(query.toLowerCase()));

  if (!user) return null;

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-9 p-0 xl:h-10 xl:w-60 xl:justify-start xl:px-3 xl:py-2 text-muted-foreground bg-background/50 border-border/50 hover:bg-background/80"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 xl:mr-2" />
        <span className="hidden xl:inline-flex text-xs font-medium">Search for websites...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-2 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 xl:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 gap-0 sm:max-w-[600px] overflow-hidden border-border/50 bg-card">
          <DialogHeader className="p-4 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Type a command or search for a website..."
                className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0 text-base"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              <Badge variant="outline" className="h-7 px-2 font-mono text-[10px]">ESC</Badge>
            </div>
          </DialogHeader>

          <div className="max-h-[450px] overflow-y-auto p-2 custom-scrollbar">
            {query.length === 0 && (
              <div className="px-2 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Quick Navigation
              </div>
            )}
            
            <div className="space-y-1">
              {navigation.map((item) => (
                <button
                  key={item.id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/10 transition-colors text-left"
                  onClick={() => runCommand(() => router.push(item.href))}
                >
                  <div className="p-2 bg-muted rounded-md group-hover:bg-primary/20">
                    <item.icon className="h-4 w-4" />
                  </div>
                  {item.label}
                  <span className="ml-auto text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">Jump to page</span>
                </button>
              ))}
            </div>

            {(filteredWebsites && filteredWebsites.length > 0) && (
              <>
                <div className="px-2 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider mt-2 border-t border-border/10">
                  Websites
                </div>
                <div className="space-y-1">
                  {filteredWebsites.map((website) => (
                    <button
                      key={website.id}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/10 transition-colors text-left group"
                      onClick={() => runCommand(() => router.push(`/websites/${website.id}`))}
                    >
                      <div className="p-2 bg-muted rounded-md group-hover:bg-primary/20">
                        <Globe className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span>{website.name}</span>
                        <span className="text-xs text-muted-foreground font-normal">{website.url}</span>
                      </div>
                      <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </>
            )}

            {actions.length > 0 && (
              <>
                <div className="px-2 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider mt-2 border-t border-border/10">
                  Actions
                </div>
                <div className="space-y-1">
                  {actions.map((action) => (
                    <button
                      key={action.id}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/10 transition-colors text-left group"
                      onClick={() => runCommand(action.action)}
                    >
                      <div className="p-2 bg-primary/10 text-primary rounded-md group-hover:bg-primary/20">
                        <action.icon className="h-4 w-4" />
                      </div>
                      {action.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {isLoading && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
              </div>
            )}

            {query.length > 0 && navigation.length === 0 && (!filteredWebsites || filteredWebsites.length === 0) && actions.length === 0 && !isLoading && (
              <div className="py-10 text-center">
                <p className="text-sm text-muted-foreground">No results found for "<span className="font-semibold">{query}</span>"</p>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-border/50 bg-muted/30 flex items-center gap-4 text-[10px] text-muted-foreground font-medium">
            <span className="flex items-center gap-1"><kbd className="px-1 border rounded bg-background">↑↓</kbd> to navigate</span>
            <span className="flex items-center gap-1"><kbd className="px-1 border rounded bg-background">↵</kbd> to select</span>
            <span className="flex items-center gap-1"><kbd className="px-1 border rounded bg-background">ESC</kbd> to close</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
