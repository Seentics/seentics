'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { 
    PlusCircle, 
    GitBranch, 
    Loader2, 
    Save, 
    ArrowLeft, 
    Zap, 
    MousePointer, 
    BarChart3, 
    Trash2, 
    ChevronRight,
    Activity,
    Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { useFunnel, useCreateFunnel, useUpdateFunnel } from '@/lib/funnels-api';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

export const FunnelBuilder = () => {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const websiteId = params?.websiteId as string;
    const funnelId = searchParams?.get('id');
    const isEditMode = searchParams?.get('mode') === 'edit' || !!funnelId;
    const { toast } = useToast();

    const { data: existingFunnel, isLoading: loadingFunnel } = useFunnel(websiteId, funnelId || '');
    const createFunnel = useCreateFunnel();
    const updateFunnel = useUpdateFunnel();

    const [name, setName] = useState('New Conversion Path');
    const [description, setDescription] = useState('');
    const [steps, setSteps] = useState<any[]>([
        { id: Math.random().toString(36).substr(2, 9), type: 'page_view', name: 'Entry Point', value: '/', matchType: 'exact' }
    ]);

    useEffect(() => {
        if (existingFunnel) {
            setName(existingFunnel.name);
            setDescription(existingFunnel.description || '');
            if (existingFunnel.steps) {
                setSteps(existingFunnel.steps.map(s => ({
                    id: s.id || Math.random().toString(36).substr(2, 9),
                    type: s.stepType,
                    name: s.name,
                    value: s.stepType === 'page_view' ? s.pagePath : s.eventType,
                    matchType: s.matchType || 'exact'
                })));
            }
        }
    }, [existingFunnel]);

    const handleSave = async () => {
        if (!name || steps.length < 2) {
            toast({
                title: "Incomplete Architecture",
                description: "Funnels require at least two nodes to establish a path.",
                variant: "destructive",
            });
            return;
        }

        const funnelData = {
            name,
            description,
            steps: steps.map((s, index) => ({
                name: s.name,
                order: index + 1,
                stepType: s.type as 'page_view' | 'event',
                pagePath: s.type === 'page_view' ? s.value : undefined,
                eventType: s.type === 'event' ? s.value : undefined,
                matchType: (s.matchType || 'exact') as any
            }))
        };

        try {
            if (funnelId) {
                await updateFunnel.mutateAsync({ websiteId, funnelId, data: funnelData });
                toast({ title: "Architecture Updated", description: "Your modifications are now live." });
            } else {
                await createFunnel.mutateAsync({ websiteId, data: funnelData });
                toast({ title: "Funnel Established", description: "Your new conversion path is active." });
            }
            router.push(`/websites/${websiteId}/funnels`);
        } catch (error) {
            toast({ title: "Deployment Failed", description: "Could not sync funnel architecture.", variant: "destructive" });
        }
    };

    const addStep = (type: 'page_view' | 'event' = 'page_view') => {
        const newStep = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            name: type === 'page_view' ? 'New Stage' : 'Custom Action',
            value: '',
            matchType: 'exact'
        };
        setSteps([...steps, newStep]);
    };

    const updateStep = (id: string, data: any) => {
        setSteps(steps.map(s => s.id === id ? { ...s, ...data } : s));
    };

    const deleteStep = (id: string) => {
        if (steps.length <= 1) return;
        setSteps(steps.filter(s => s.id !== id));
    };

    if (loadingFunnel && funnelId) {
        return <BuilderSkeleton />;
    }

    return (
        <div className="fixed inset-0 z-[100] flex h-screen w-full bg-slate-50 dark:bg-slate-900 overflow-hidden flex-col">
            {/* Toolbar */}
            <div className="h-20 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-8 flex items-center justify-between z-20">
                <div className="flex items-center gap-6">
                    <Link href={`/websites/${websiteId}/funnels`}>
                        <Button variant="ghost" size="icon" className="group rounded hover:bg-primary/10 transition-colors">
                            <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
                        </Button>
                    </Link>
                    <div className="h-8 w-[2px] bg-muted-foreground/10 rounded-full" />
                    <div className="flex flex-col">
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-transparent border-none text-2xl font-black tracking-tight leading-none focus:outline-none focus:ring-0 placeholder:opacity-30"
                            placeholder="Unnamed Path..."
                        />
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Architecture Studio</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <Link href={`/websites/${websiteId}/funnels`}>
                        <Button variant="ghost" className="rounded font-black uppercase tracking-widest text-xs h-12 px-8 border border-transparent hover:border-muted-foreground/10">
                            Cancel
                        </Button>
                    </Link>
                    <Button
                        variant="brand"
                        className="rounded h-12 px-10 font-black uppercase tracking-widest shadow-xl shadow-primary/20 gap-3"
                        onClick={handleSave}
                        disabled={createFunnel.isPending || updateFunnel.isPending}
                    >
                        {createFunnel.isPending || updateFunnel.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                        {funnelId ? 'Update Funnel' : 'Launch Funnel'}
                    </Button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                <div className="flex-1 h-full relative overflow-hidden flex flex-col items-center bg-slate-50 dark:bg-slate-950">
                    <ScrollArea className="w-full h-full relative">
                        <div className="max-w-3xl mx-auto py-20 px-10 flex flex-col pb-60">
                            {/* Visual Header */}
                            <div className="flex flex-col items-center gap-4 mb-16 opacity-50">
                                <div className="w-12 h-12 rounded-full border-2 border-dashed border-primary flex items-center justify-center">
                                    <Activity className="w-6 h-6 text-primary" strokeWidth={1.5} />
                                </div>
                                <div className="h-10 w-[2px] bg-gradient-to-b from-primary to-transparent" />
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary italic">Traffic Injection Point</p>
                            </div>

                            <div className="space-y-0 relative">
                                {steps.map((step, index) => (
                                    <div key={step.id} className="relative">
                                        {index > 0 && (
                                            <div className="flex flex-col items-center -my-2 relative z-10 pointer-events-none">
                                                <div className="h-12 w-[3px] bg-primary/20 rounded-full" />
                                                <div className="p-2 rounded-full bg-white dark:bg-slate-900 border-2 border-primary/20 shadow-lg text-primary">
                                                    <ChevronRight size={14} strokeWidth={3} />
                                                </div>
                                                <div className="h-12 w-[3px] bg-primary/30 rounded-full" />
                                            </div>
                                        )}
                                        <Card className="group relative border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none bg-card/80 dark:bg-gray-800/80 backdrop-blur-xl rounded border border-muted-foreground/5 overflow-hidden hover:scale-[1.01] transition-all">
                                            <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
                                            <CardContent className="p-8">
                                                <div className="flex items-start gap-6">
                                                    <div className="h-14 w-14 rounded bg-primary text-white flex items-center justify-center font-black text-xl shadow-xl shadow-primary/20">
                                                        {index + 1}
                                                    </div>
                                                    <div className="flex-1 space-y-6">
                                                        <div className="flex items-center justify-between">
                                                            <div className="space-y-1">
                                                                <input
                                                                    value={step.name}
                                                                    onChange={(e) => updateStep(step.id, { name: e.target.value })}
                                                                    className="bg-transparent border-none text-xl font-black leading-none focus:outline-none focus:ring-0 placeholder:opacity-30 tracking-tight p-0"
                                                                    placeholder="Node Designation..."
                                                                />
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Stage Configuration</p>
                                                            </div>
                                                            {steps.length > 1 && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="rounded h-10 w-10 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    onClick={() => deleteStep(step.id)}
                                                                >
                                                                    <Trash2 size={18} />
                                                                </Button>
                                                            )}
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                            <div className="space-y-3">
                                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Event Archetype</Label>
                                                                <Select 
                                                                    value={step.type} 
                                                                    onValueChange={(val) => updateStep(step.id, { 
                                                                        type: val,
                                                                        name: val === 'page_view' ? 'Entry Point' : 'Action Trigger'
                                                                    })}
                                                                >
                                                                    <SelectTrigger className="h-12 rounded bg-muted/30 border-none font-bold tracking-tight">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="rounded border-muted-foreground/10">
                                                                        <SelectItem value="page_view" className="font-bold py-3">
                                                                            <div className="flex items-center gap-2">
                                                                                <MousePointer className="w-4 h-4" />
                                                                                Page Reach
                                                                            </div>
                                                                        </SelectItem>
                                                                        <SelectItem value="event" className="font-bold py-3">
                                                                            <div className="flex items-center gap-2">
                                                                                <Zap className="w-4 h-4" />
                                                                                Custom Pulse
                                                                            </div>
                                                                        </SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>

                                                            <div className="space-y-3">
                                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
                                                                    {step.type === 'page_view' ? 'Destination Path' : 'Event Key'}
                                                                </Label>
                                                                <Input
                                                                    placeholder={step.type === 'page_view' ? 'e.g., /checkout' : 'e.g., btn_click'}
                                                                    value={step.value}
                                                                    onChange={(e) => updateStep(step.id, { value: e.target.value })}
                                                                    className="h-12 rounded bg-muted/30 border-none font-bold focus-visible:ring-primary/20"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-16 flex flex-col items-center gap-6">
                                <div className="h-12 w-[2px] bg-gradient-to-b from-primary/30 to-transparent" />
                                <div className="flex items-center gap-4">
                                    <Button 
                                        variant="outline" 
                                        className="h-14 rounded px-10 font-black uppercase tracking-widest border-2 border-primary/20 hover:border-primary hover:bg-primary/5 text-primary gap-3 shadow-xl shadow-primary/5 transition-all" 
                                        onClick={() => addStep('page_view')}
                                    >
                                        <PlusCircle size={20} />
                                        Append Node
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        className="h-14 rounded px-6 font-black uppercase tracking-widest text-muted-foreground hover:bg-muted-foreground/5 gap-3"
                                    >
                                        <GitBranch size={20} />
                                        Logical Split
                                    </Button>
                                </div>
                                <div className="mt-8 px-6 py-3 rounded-full bg-slate-900 border border-white/5 shadow-2xl">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
                                        <Target className="w-3 h-3 text-primary animate-pulse" />
                                        Finalizing Conversion Core
                                    </p>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </div>

                {/* Live Preview Sidebar */}
                <div className="w-[400px] border-l bg-white dark:bg-slate-900 z-10 hidden xl:flex flex-col">
                    <div className="p-8 border-b">
                        <h4 className="text-xl font-black uppercase tracking-tighter mb-1">Architecture Preview</h4>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Real-time Path Simulation</p>
                    </div>
                    <ScrollArea className="flex-1 p-8">
                        <div className="space-y-4">
                            {steps.map((s, i) => (
                                <div key={s.id} className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center font-black italic text-xs text-primary">
                                        {i + 1}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[11px] font-black uppercase tracking-tight truncate">{s.name || 'Unnamed Stage'}</p>
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
                                            {s.type === 'page_view' ? 'REACH' : 'ACT'} → {s.value || 'None'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {steps.length < 2 && (
                                <div className="p-6 rounded bg-red-500/5 border border-red-500/10 text-red-500">
                                    <p className="text-[10px] font-black uppercase tracking-widest">Invalid Topology</p>
                                    <p className="text-[9px] mt-1 font-medium leading-relaxed opacity-80">
                                        Conversion funnels require a minimum of two connected nodes to create a measurable flux path.
                                    </p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </div>
    );
};

function BuilderSkeleton() {
    return (
        <div className="fixed inset-0 flex h-screen w-full bg-slate-50 dark:bg-slate-900 flex-col">
            <div className="h-20 border-b bg-white dark:bg-slate-900 px-8 flex items-center justify-between">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-12 w-48 rounded" />
            </div>
            <div className="flex-1 flex justify-center py-20">
                <div className="w-full max-w-2xl space-y-8">
                    <Skeleton className="h-10 w-32 mx-auto" />
                    <Skeleton className="h-64 w-full rounded-[2.5rem]" />
                    <Skeleton className="h-64 w-full rounded-[2.5rem]" />
                </div>
            </div>
        </div>
    );
}

export default FunnelBuilder;
