'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Book, Code, ExternalLink, FileText, Search, Zap } from 'lucide-react';
import Link from 'next/link';

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DocsModal({ isOpen, onClose }: DocsModalProps) {
  const articles = [
    { title: 'Installing the Tracker Script', category: 'Getting Started', icon: Code },
    { title: 'Understanding User Sessions', category: 'Analytics', icon: FileText },
    { title: 'Goal Conversion Tracking', category: 'Features', icon: Zap },
    { title: 'API Authentication', category: 'Developer API', icon: Book },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden gap-0">
        <div className="bg-muted/40 p-6 border-b">
            <DialogHeader className="mb-4">
            <DialogTitle>Documentation</DialogTitle>
            <DialogDescription>
                Search our guides and API reference to find what you need.
            </DialogDescription>
            </DialogHeader>
            <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search documentation..." 
                    className="pl-9 bg-background shadow-sm"
                />
            </div>
        </div>
        
        <div className="p-6 grid gap-6">
            <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Quick Links</h4>
                <div className="grid grid-cols-2 gap-3">
                    <Link href="#" className="flex flex-col p-4 rounded-lg bg-card border hover:border-primary/50 transition-colors group">
                        <Zap className="h-5 w-5 text-primary mb-2 group-hover:scale-110 transition-transform" />
                        <span className="font-semibold text-sm">Getting Started</span>
                        <span className="text-xs text-muted-foreground mt-1">Setup your first website</span>
                    </Link>
                    <Link href="#" className="flex flex-col p-4 rounded-lg bg-card border hover:border-primary/50 transition-colors group">
                        <Code className="h-5 w-5 text-primary mb-2 group-hover:scale-110 transition-transform" />
                        <span className="font-semibold text-sm">API Reference</span>
                        <span className="text-xs text-muted-foreground mt-1">Endpoints and schemas</span>
                    </Link>
                </div>
            </div>

            <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Popular Articles</h4>
                <div className="space-y-1">
                    {articles.map((article, i) => (
                        <Link key={i} href="#" className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                            <div className="flex items-center gap-3">
                                <article.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                <span>{article.title}</span>
                            </div>
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                        </Link>
                    ))}
                </div>
            </div>
        </div>
        
        <div className="bg-muted/40 p-4 border-t flex justify-center">
             <Button variant="link" size="sm" className="text-muted-foreground">
                Visit full documentation site
             </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
