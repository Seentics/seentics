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
import { FunnelTestSandbox } from './FunnelTestSandbox';
import Link from 'next/link';

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
        <div className="fixed inset-0 z-[100] flex h-screen w-full bg-slate-50 dark:bg-slate-950 overflow-hidden flex-col">
            {/* Clean Modern Toolbar */}
            <div className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 flex items-center justify-between z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <Link href={`/websites/${websiteId}/funnels`}>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700" />
                    <div>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-transparent border-none text-lg font-semibold focus:outline-none focus:ring-0 placeholder:text-slate-400"
                            placeholder="Funnel Name"
                        />
                        <p className="text-xs text-slate-500">Conversion Path Builder</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        className="h-9 px-4 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                        onClick={() => setShowTestSandbox(true)}
                        disabled={steps.length < 2}
                    >
                        <Activity className="h-4 w-4 mr-2" />
                        Test Funnel
                    </Button>
                    <Link href={`/websites/${websiteId}/funnels`}>
                        <Button variant="ghost" className="h-9 px-4">
                            Cancel
                        </Button>
                    </Link>
                    <Button
                        className="h-9 px-6 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={handleSave}
                        disabled={createFunnel.isPending || updateFunnel.isPending}
                    >
                        {createFunnel.isPending || updateFunnel.isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4 mr-2" />
                                {funnelId ? 'Update' : 'Save'} Funnel
                            </>
                        )}
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                    <div className="max-w-4xl mx-auto py-12 px-6">
                        {/* Header Info */}
                        <div className="mb-8 text-center">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                                Build Your Conversion Funnel
                            </h2>
                            <p className="text-slate-600 dark:text-slate-400">
                                Add steps to track user journey from entry to conversion
                            </p>
                        </div>

                        {/* Steps List */}
                        <div className="space-y-4 mb-8">
                            {steps.map((step, index) => (
                                <div key={step.id}>
                                    {index > 0 && (
                                        <div className="flex justify-center py-2">
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <div className="h-8 w-0.5 bg-slate-300 dark:bg-slate-700" />
                                                <ChevronRight className="h-4 w-4" />
                                                <div className="h-8 w-0.5 bg-slate-300 dark:bg-slate-700" />
                                            </div>
                                        </div>
                                    )}
                                    
                                    <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                                        <CardContent className="p-6">
                                            <div className="flex items-start gap-4">
                                                {/* Step Number */}
                                                <div className="h-12 w-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg flex-shrink-0">
                                                    {index + 1}
                                                </div>

                                                {/* Step Content */}
                                                <div className="flex-1 space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <input
                                                            value={step.name}
                                                            onChange={(e) => updateStep(step.id, { name: e.target.value })}
                                                            className="bg-transparent border-none text-lg font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-0 placeholder:text-slate-400"
                                                            placeholder="Step Name"
                                                        />
                                                        {steps.length > 1 && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-9 w-9 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                                onClick={() => deleteStep(step.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                                Step Type
                                                            </Label>
                                                            <Select 
                                                                value={step.type} 
                                                                onValueChange={(val) => updateStep(step.id, { 
                                                                    type: val,
                                                                    name: val === 'page_view' ? 'Page Visit' : 'Event Action'
                                                                })}
                                                            >
                                                                <SelectTrigger className="h-10 border-slate-300 dark:border-slate-700">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="page_view">
                                                                        <div className="flex items-center gap-2">
                                                                            <MousePointer className="w-4 h-4" />
                                                                            Page View
                                                                        </div>
                                                                    </SelectItem>
                                                                    <SelectItem value="event">
                                                                        <div className="flex items-center gap-2">
                                                                            <Zap className="w-4 h-4" />
                                                                            Custom Event
                                                                        </div>
                                                                    </SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                                {step.type === 'page_view' ? 'Page Path' : 'Event Name'}
                                                            </Label>
                                                            <Input
                                                                placeholder={step.type === 'page_view' ? '/checkout' : 'button_clicked'}
                                                                value={step.value}
                                                                onChange={(e) => updateStep(step.id, { value: e.target.value })}
                                                                className="h-10 border-slate-300 dark:border-slate-700"
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

                        {/* Add Step Button */}
                        <div className="flex justify-center">
                            <Button 
                                variant="outline" 
                                className="h-12 px-8 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:text-emerald-600" 
                                onClick={() => addStep('page_view')}
                            >
                                <PlusCircle className="h-5 w-5 mr-2" />
                                Add Step
                            </Button>
                        </div>

                        {/* Info Banner */}
                        {steps.length < 2 && (
                            <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                                <div className="flex items-start gap-3">
                                    <Target className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-amber-900 dark:text-amber-200">
                                            At least 2 steps required
                                        </p>
                                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                            Add more steps to create a complete conversion funnel that tracks user journey.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Summary Card */}
                        {steps.length >= 2 && (
                            <div className="mt-8 p-6 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                                <div className="flex items-center gap-3 mb-4">
                                    <BarChart3 className="h-5 w-5 text-emerald-600" />
                                    <h3 className="font-semibold text-slate-900 dark:text-white">Funnel Summary</h3>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-400">Total Steps:</span>
                                        <span className="font-medium text-slate-900 dark:text-white">{steps.length}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-400">Entry Point:</span>
                                        <span className="font-medium text-slate-900 dark:text-white">{steps[0]?.name || 'Not set'}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-400">Conversion Goal:</span>
                                        <span className="font-medium text-slate-900 dark:text-white">{steps[steps.length - 1]?.name || 'Not set'}</span>
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
                    steps: steps
                }}
                websiteId={websiteId}
            />
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
