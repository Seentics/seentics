'use client';

import { useParams, useRouter } from 'next/navigation';
import { Bot, ArrowLeft, Save, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkflowEditor } from '@/components/automations/WorkflowBuilder';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

export default function NewAutomationPage() {
  const params = useParams();
  const router = useRouter();
  const websiteId = params?.websiteId as string;
  
  const [name, setName] = useState('Untitled Automation');

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto h-screen flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 rounded-full"
            onClick={() => router.push(`/websites/${websiteId}/automations`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-border/40" />
          <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary shrink-0" />
                <Input 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-8 py-0 font-bold border-none bg-transparent focus-visible:ring-0 p-0 text-foreground w-64"
                />
              </div>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest leading-none mt-1">
                  Builder Workspace · Draft
              </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="h-9 gap-2 font-bold text-xs bg-background/50 border-border/60">
                <Play className="h-3.5 w-3.5" /> Dry Run
            </Button>
            <Button size="sm" className="h-9 gap-2 font-black text-xs shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground">
                <Save className="h-3.5 w-3.5" /> Save Workflow
            </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-background/30 rounded-2xl">
         <WorkflowEditor />
      </div>
    </div>
  );
}
