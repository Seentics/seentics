'use client';

import React from 'react';
import { 
  LifeBuoy, 
  BookOpen, 
  MessageSquare, 
  Mail, 
  Github, 
  Compass, 
  Search,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function GlobalSupport() {
  const supportCategories = [
    {
      title: 'Documentation',
      description: 'Step-by-step guides for everything from setup to advanced API usage.',
      icon: BookOpen,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      action: 'Read Docs'
    },
    {
      title: 'Direct Support',
      description: 'Talk to our engineers directly for complex technical assistance.',
      icon: Mail,
      color: 'text-primary',
      bg: 'bg-primary/10',
      action: 'Email Us'
    },
    {
      title: 'Community Forum',
      description: 'Discuss features and share tracking tips with other Seentics users.',
      icon: MessageSquare,
      color: 'text-indigo-500',
      bg: 'bg-indigo-500/10',
      action: 'Join Forum'
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Support & Help</h1>
          <p className="text-muted-foreground text-sm">Need a hand? Our team and resources are here to help.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20">
           <LifeBuoy className="h-4 w-4 text-primary" />
           <span className="text-[10px] font-black text-primary uppercase tracking-widest">Help Center</span>
        </div>
      </div>

      <div className="space-y-8">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Search documentation, guides, and FAQ..." 
            className="h-14 pl-12 pr-4 bg-muted/20 border-border/50 text-base font-medium rounded-2xl focus-visible:ring-1 focus-visible:ring-primary shadow-sm" 
          />
        </div>

        {/* Categories Grid */}
        <div className="grid md:grid-cols-3 gap-6">
           {supportCategories.map((cat, i) => (
             <div key={i} className="p-6 rounded-3xl border bg-card hover:shadow-xl hover:shadow-primary/5 transition-all group flex flex-col items-start text-left">
                <div className={`w-12 h-12 rounded-2xl ${cat.bg} flex items-center justify-center mb-4 border border-border/50 group-hover:scale-110 transition-transform`}>
                   <cat.icon className={`h-6 w-6 ${cat.color}`} />
                </div>
                <h3 className="text-sm font-bold mb-2 uppercase tracking-wide">{cat.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                   {cat.description}
                </p>
                <Button variant="ghost" className="mt-auto h-9 px-4 font-bold text-xs rounded-xl bg-muted/30 hover:bg-muted group-hover:bg-primary group-hover:text-primary-foreground transition-colors w-full gap-2">
                   {cat.action}
                   <ChevronRight className="h-3.5 w-3.5" />
                </Button>
             </div>
           ))}
        </div>

        {/* Quick Help Section */}
        <div className="bg-muted/30 rounded-3xl p-8 border border-dashed text-center space-y-4">
           <div className="flex justify-center -space-x-3 mb-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-indigo-500/20 shadow-sm flex items-center justify-center font-black text-primary border-2 border-background text-[10px]">
                  {['S', 'M', 'H'][i]}
                </div>
              ))}
           </div>
           <div className="space-y-1">
              <h3 className="font-bold text-sm">Still have questions?</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                 Can't find the answer you're looking for? Reach out to our 24/7 dedicated support team.
              </p>
           </div>
           <Button className="h-10 px-8 font-bold rounded-xl shadow-lg shadow-primary/10">
              Submit a Ticket
           </Button>
        </div>

        {/* Footer Resources */}
        <div className="flex flex-wrap items-center justify-center gap-8 py-4 opacity-50">
           <div className="flex items-center gap-2 hover:opacity-100 cursor-pointer transition-opacity">
              <Github className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Open Source</span>
           </div>
           <div className="flex items-center gap-2 hover:opacity-100 cursor-pointer transition-opacity">
              <Compass className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Roadmap</span>
           </div>
           <div className="flex items-center gap-2 hover:opacity-100 cursor-pointer transition-opacity">
              <ExternalLink className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">System Status</span>
           </div>
        </div>
      </div>
    </div>
  );
}
