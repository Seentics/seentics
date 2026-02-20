'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    PlusCircle,
    Loader2,
    Save,
    ArrowLeft,
    Zap,
    MousePointer,
    Trash2,
    ChevronDown,
    Target,
    Activity,
    Play,
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
    SelectValue,
} from '@/components/ui/select';
import { useFunnel, useCreateFunnel, useUpdateFunnel } from '@/lib/funnels-api';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { FunnelTestSandbox } from './FunnelTestSandbox';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export const FunnelBuilder = () => {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const websiteId = params?.websiteId as string;
    const funnelId = searchParams?.get('id');
    const isEditMode = searchParams?.get('mode') === 'edit' || !!funnelId;
    const { toast } = useToast();

    const [showTestSandbox, setShowTestSandbox] = useState(false);
    const { data: existingFunnel, isLoading: loadingFunnel } = useFunnel(websiteId, funnelId || '');
    const createFunnel = useCreateFunnel();
    const updateFunnel = useUpdateFunnel();

    const [name, setName] = useState('New Conversion Path');
    const [description, setDescription] = useState('');
    const [steps, setSteps] = useState<any[]>([
        { id: Math.random().toString(36).substr(2, 9), type: 'page_view', name: 'Entry Point', value: '/', matchType: 'exact' },
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
                    matchType: s.matchType || 'exact',
                })));
            }
        }
    }, [existingFunnel]);

    const handleSave = async () => {
        if (!name || steps.length < 2) {
            toast({
                title: 'Incomplete funnel',
                description: 'Add at least 2 steps to create a conversion path.',
                variant: 'destructive',
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
                matchType: (s.matchType || 'exact') as any,
            })),
        };

        try {
            if (funnelId) {
                await updateFunnel.mutateAsync({ websiteId, funnelId, data: funnelData });
                toast({ title: 'Funnel updated', description: 'Your changes have been saved.' });
            } else {
                await createFunnel.mutateAsync({ websiteId, data: funnelData });
                toast({ title: 'Funnel created', description: 'Your new conversion path is active.' });
            }
            router.push(`/websites/${websiteId}/funnels`);
        } catch {
            toast({ title: 'Error', description: 'Could not save funnel. Please try again.', variant: 'destructive' });
        }
    };

    const addStep = (type: 'page_view' | 'event' = 'page_view') => {
        const newStep = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            name: type === 'page_view' ? 'New Step' : 'Custom Event',
            value: '',
            matchType: 'exact',
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

    const isSaving = createFunnel.isPending || updateFunnel.isPending;
    const canSave = name.trim().length > 0 && steps.length >= 2;

    return (
        <div className="fixed inset-0 z-[100] flex h-screen w-full bg-background overflow-hidden flex-col">
            {/* Toolbar */}
            <div className="h-14 border-b bg-card px-4 flex items-center justify-between z-20 flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <Link href={`/websites/${websiteId}/funnels`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div className="h-4 w-px bg-border" />
                    <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Target className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-transparent border-none text-sm font-medium focus:outline-none focus:ring-0 placeholder:text-muted-foreground/40 w-full"
                            placeholder="Funnel Name"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-xs font-medium gap-1.5"
                        onClick={() => setShowTestSandbox(true)}
                        disabled={steps.length < 2}
                    >
                        <Play className="h-3 w-3 text-emerald-500" />
                        Test
                    </Button>
                    <Link href={`/websites/${websiteId}/funnels`}>
                        <Button variant="ghost" size="sm" className="h-8 px-3 text-xs">
                            Cancel
                        </Button>
                    </Link>
                    <Button
                        size="sm"
                        className="h-8 px-4 text-xs font-medium gap-1.5"
                        onClick={handleSave}
                        disabled={isSaving || !canSave}
                    >
                        {isSaving ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            <Save className="h-3 w-3" />
                        )}
                        {isSaving ? 'Saving...' : funnelId ? 'Update' : 'Save'}
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                    <div className="max-w-2xl mx-auto py-10 px-6">
                        {/* Description */}
                        <div className="mb-8">
                            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description (optional)</Label>
                            <Input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe this funnel's purpose..."
                                className="h-8 text-sm"
                            />
                        </div>

                        {/* Steps */}
                        <div className="space-y-0 mb-8">
                            {steps.map((step, index) => (
                                <div key={step.id}>
                                    {/* Connector */}
                                    {index > 0 && (
                                        <div className="flex justify-center py-2">
                                            <div className="flex flex-col items-center">
                                                <div className="w-px h-3 bg-border" />
                                                <ChevronDown className="h-4 w-4 text-muted-foreground/30" />
                                                <div className="w-px h-3 bg-border" />
                                            </div>
                                        </div>
                                    )}

                                    <Card className="border border-border/60 bg-card shadow-sm">
                                        <CardContent className="p-4">
                                            <div className="flex items-start gap-3">
                                                {/* Step number */}
                                                <div className={cn(
                                                    'h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0 text-sm font-semibold',
                                                    index === 0 ? 'bg-blue-500/10 text-blue-500' :
                                                    index === steps.length - 1 ? 'bg-emerald-500/10 text-emerald-500' :
                                                    'bg-violet-500/10 text-violet-500'
                                                )}>
                                                    {index + 1}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <input
                                                            value={step.name}
                                                            onChange={(e) => updateStep(step.id, { name: e.target.value })}
                                                            className="bg-transparent border-none text-sm font-medium focus:outline-none focus:ring-0 placeholder:text-muted-foreground/40"
                                                            placeholder="Step Name"
                                                        />
                                                        {steps.length > 1 && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                                                                onClick={() => deleteStep(step.id)}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[11px] font-medium text-muted-foreground">Type</Label>
                                                            <Select
                                                                value={step.type}
                                                                onValueChange={(val) => updateStep(step.id, {
                                                                    type: val,
                                                                    name: val === 'page_view' ? 'Page Visit' : 'Event Action',
                                                                })}
                                                            >
                                                                <SelectTrigger className="h-8 text-xs">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="page_view">
                                                                        <div className="flex items-center gap-1.5 text-xs">
                                                                            <MousePointer className="h-3 w-3" />
                                                                            Page View
                                                                        </div>
                                                                    </SelectItem>
                                                                    <SelectItem value="event">
                                                                        <div className="flex items-center gap-1.5 text-xs">
                                                                            <Zap className="h-3 w-3" />
                                                                            Custom Event
                                                                        </div>
                                                                    </SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        <div className="space-y-1.5">
                                                            <Label className="text-[11px] font-medium text-muted-foreground">
                                                                {step.type === 'page_view' ? 'Page Path' : 'Event Name'}
                                                            </Label>
                                                            <Input
                                                                placeholder={step.type === 'page_view' ? '/checkout' : 'button_clicked'}
                                                                value={step.value}
                                                                onChange={(e) => updateStep(step.id, { value: e.target.value })}
                                                                className="h-8 text-xs font-mono"
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

                        {/* Add Step */}
                        <div className="flex justify-center">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-4 text-xs font-medium gap-1.5 border-dashed"
                                onClick={() => addStep('page_view')}
                            >
                                <PlusCircle className="h-3.5 w-3.5" />
                                Add Step
                            </Button>
                        </div>

                        {/* Validation banner */}
                        {steps.length < 2 && (
                            <div className="mt-6 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg">
                                <div className="flex items-start gap-2.5">
                                    <Target className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">At least 2 steps required</p>
                                        <p className="text-[11px] text-amber-600/80 dark:text-amber-400/60 mt-0.5">
                                            Add more steps to track the complete conversion journey.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Summary */}
                        {steps.length >= 2 && (
                            <div className="mt-6 p-4 bg-muted/30 border border-border/60 rounded-lg">
                                <div className="flex items-center gap-2 mb-3">
                                    <Activity className="h-4 w-4 text-primary" />
                                    <h3 className="text-sm font-medium">Summary</h3>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Steps</span>
                                        <span className="font-medium">{steps.length}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Entry</span>
                                        <span className="font-medium">{steps[0]?.name || '—'}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Goal</span>
                                        <span className="font-medium">{steps[steps.length - 1]?.name || '—'}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>

            <FunnelTestSandbox
                isOpen={showTestSandbox}
                onClose={() => setShowTestSandbox(false)}
                funnel={{
                    name: name,
                    steps: steps,
                }}
                websiteId={websiteId}
            />
        </div>
    );
};

function BuilderSkeleton() {
    return (
        <div className="fixed inset-0 flex h-screen w-full bg-background flex-col">
            <div className="h-14 border-b bg-card px-4 flex items-center justify-between">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-8 w-24" />
            </div>
            <div className="flex-1 flex justify-center py-12">
                <div className="w-full max-w-2xl space-y-6 px-6">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                </div>
            </div>
        </div>
    );
}

export default FunnelBuilder;
