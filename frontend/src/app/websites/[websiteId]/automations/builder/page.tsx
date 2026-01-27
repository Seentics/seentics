'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeft,
    Plus,
    Zap,
    Mail,
    Globe,
    Bell,
    Database,
    Clock,
    MousePointer,
    Filter,
    Save,
    Play,
    Loader2,
    Trash2,
    Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateAutomation, useAutomation, useUpdateAutomation } from '@/lib/automations-api';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

const triggerTypes = [
    { value: 'event', label: 'Custom Event', icon: Zap, description: 'Trigger when a custom event occurs' },
    { value: 'page_visit', label: 'Page Visit', icon: MousePointer, description: 'Trigger when a specific page is visited' },
    { value: 'time_based', label: 'Time Based', icon: Clock, description: 'Trigger at specific times or intervals' },
    { value: 'utm_campaign', label: 'UTM Campaign', icon: Filter, description: 'Trigger based on UTM parameters' },
];

const actionTypes = [
    { value: 'email', label: 'Send Email', icon: Mail, description: 'Send an email notification' },
    { value: 'webhook', label: 'Webhook', icon: Globe, description: 'Send data to a webhook URL' },
    { value: 'slack', label: 'Slack Message', icon: Bell, description: 'Post a message to Slack' },
    { value: 'discord', label: 'Discord Message', icon: Bell, description: 'Post a message to Discord' },
    { value: 'custom', label: 'Custom Action', icon: Database, description: 'Execute custom logic' },
];

export default function AutomationBuilderPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const websiteId = params?.websiteId as string;
    const automationId = searchParams.get('id');
    const { toast } = useToast();

    const createAutomation = useCreateAutomation();
    const updateAutomation = useUpdateAutomation();
    const { data: existingAutomation, isLoading: isLoadingExisting } = useAutomation(websiteId, automationId as string);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [triggerType, setTriggerType] = useState('');
    const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({});
    const [actions, setActions] = useState<Array<{ id?: string; actionType: string; actionConfig: Record<string, any> }>>([]);

    useEffect(() => {
        if (existingAutomation) {
            setName(existingAutomation.name);
            setDescription(existingAutomation.description || '');
            setTriggerType(existingAutomation.triggerType);
            setTriggerConfig(existingAutomation.triggerConfig || {});
            setActions((existingAutomation.actions || []).map(a => ({
                id: a.id,
                actionType: a.actionType,
                actionConfig: a.actionConfig
            })));
        }
    }, [existingAutomation]);

    const handleAddAction = () => {
        setActions([...actions, { actionType: '', actionConfig: {} }]);
    };

    const handleRemoveAction = (index: number) => {
        setActions(actions.filter((_, i) => i !== index));
    };

    const handleActionTypeChange = (index: number, actionType: string) => {
        const newActions = [...actions];
        newActions[index].actionType = actionType;
        setActions(newActions);
    };

    const handleActionConfigChange = (index: number, key: string, value: any) => {
        const newActions = [...actions];
        newActions[index].actionConfig = { ...newActions[index].actionConfig, [key]: value };
        setActions(newActions);
    };

    const handleTriggerConfigChange = (key: string, value: any) => {
        setTriggerConfig({ ...triggerConfig, [key]: value });
    };

    const handleSave = async () => {
        if (!name || !triggerType || actions.length === 0) {
            toast({
                title: "Validation Error",
                description: "Please fill in all required fields and add at least one action.",
                variant: "destructive",
            });
            return;
        }

        try {
            if (automationId) {
                await updateAutomation.mutateAsync({
                    websiteId,
                    automationId,
                    data: {
                        name,
                        description,
                        triggerType,
                        triggerConfig,
                        actions: actions.map(a => ({
                            actionType: a.actionType,
                            actionConfig: a.actionConfig,
                        })),
                    },
                });
                toast({
                    title: "Automation Updated",
                    description: `"${name}" has been updated successfully.`,
                });
            } else {
                await createAutomation.mutateAsync({
                    websiteId,
                    data: {
                        name,
                        description,
                        triggerType,
                        triggerConfig,
                        actions: actions.map(a => ({
                            actionType: a.actionType,
                            actionConfig: a.actionConfig,
                        })),
                    },
                });
                toast({
                    title: "Automation Created",
                    description: `"${name}" has been created successfully.`,
                });
            }

            router.push(`/websites/${websiteId}/automations`);
        } catch (error) {
            toast({
                title: "Error",
                description: `Failed to ${automationId ? 'update' : 'create'} automation. Please try again.`,
                variant: "destructive",
            });
        }
    };

    if (automationId && isLoadingExisting) {
        return <BuilderSkeleton />;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 sm:p-6 lg:p-12">
            <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <Link href={`/websites/${websiteId}/automations`}>
                            <Button variant="ghost" size="icon" className="rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-border/50 hover:scale-105 transition-transform">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight">{automationId ? 'Edit Workflow' : 'Automation Builder'}</h1>
                            <p className="text-muted-foreground font-medium text-sm">Design your intelligent customer journey.</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            className="h-12 px-8 rounded-2xl font-black border-2 border-border/50"
                            onClick={() => router.push(`/websites/${websiteId}/automations`)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="brand"
                            className="h-12 px-8 rounded-2xl font-black gap-2 shadow-xl shadow-primary/20"
                            onClick={handleSave}
                            disabled={createAutomation.isPending || updateAutomation.isPending}
                        >
                            {createAutomation.isPending || updateAutomation.isPending ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-5 w-5" />
                                    {automationId ? 'Update Workflow' : 'Launch Automation'}
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        {/* Basic Info */}
                        <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none bg-card dark:bg-gray-800/50 rounded-[2.5rem] overflow-hidden border border-muted-foreground/5 backdrop-blur-sm">
                            <CardHeader className="px-8 pt-8 pb-4">
                                <CardTitle className="text-xl font-black">Workflow Identity</CardTitle>
                                <CardDescription className="font-medium">What should we call this automation?</CardDescription>
                            </CardHeader>
                            <CardContent className="px-8 pb-8 space-y-6">
                                <div className="space-y-3">
                                    <Label htmlFor="name" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Automation Name *</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g., High-Value Segment Reveal"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="h-14 rounded-2xl bg-muted/20 border-none font-bold text-lg focus-visible:ring-primary/20"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <Label htmlFor="description" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Internal Description</Label>
                                    <Textarea
                                        id="description"
                                        placeholder="What's the goal of this workflow? (Optional)"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="rounded-2xl min-h-[120px] bg-muted/20 border-none font-medium text-sm focus-visible:ring-primary/20"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Actions */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                        <Play className="h-4 w-4 text-emerald-500" />
                                    </div>
                                    <h2 className="text-xl font-black">Execution Sequence</h2>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-10 px-5 rounded-xl font-bold gap-2 border-2 border-border/50 bg-white dark:bg-slate-900"
                                    onClick={handleAddAction}
                                >
                                    <Plus className="h-4 w-4" />
                                    Add Action
                                </Button>
                            </div>

                            <div className="space-y-6">
                                {actions.length === 0 ? (
                                    <div className="text-center py-20 border-4 border-dashed rounded-[2.5rem] border-muted-foreground/10 bg-muted/5">
                                        <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
                                            <Activity className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                        <h3 className="text-lg font-bold text-muted-foreground">Sequence Empty</h3>
                                        <p className="text-sm text-muted-foreground/60 mb-6 font-medium">Add at least one action to execute when triggered.</p>
                                        <Button variant="ghost" className="font-black hover:bg-primary/10 hover:text-primary rounded-xl" onClick={handleAddAction}>
                                            <Plus className="h-4 w-4 mr-2" /> Initialize Action
                                        </Button>
                                    </div>
                                ) : (
                                    actions.map((action, index) => (
                                        <Card key={index} className="border-none shadow-sm bg-card dark:bg-gray-800/50 rounded-3xl overflow-hidden border border-muted-foreground/5 animate-in slide-in-from-right-4 duration-300">
                                            <div className="flex border-b border-muted-foreground/5 bg-muted/20 px-6 py-4 items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-black">
                                                        {index + 1}
                                                    </span>
                                                    <h4 className="font-black text-sm uppercase tracking-widest">Step {index + 1}</h4>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                                                    onClick={() => handleRemoveAction(index)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <CardContent className="p-8 space-y-6">
                                                <div className="space-y-3">
                                                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Select Outcome</Label>
                                                    <Select value={action.actionType} onValueChange={(value) => handleActionTypeChange(index, value)}>
                                                        <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none font-bold">
                                                            <SelectValue placeholder="What should happen?" />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-2xl border-muted-foreground/10 p-2">
                                                            {actionTypes.map((type) => {
                                                                const Icon = type.icon;
                                                                return (
                                                                    <SelectItem key={type.value} value={type.value} className="rounded-xl font-bold py-3 px-4">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                                                                <Icon className="h-4 w-4" />
                                                                            </div>
                                                                            <div>
                                                                                <p>{type.label}</p>
                                                                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">{type.description.split(' ')[0]} Action</p>
                                                                            </div>
                                                                        </div>
                                                                    </SelectItem>
                                                                );
                                                            })}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {/* Action Configs */}
                                                {action.actionType === 'email' && (
                                                    <div className="space-y-4 pt-2 animate-in fade-in duration-500">
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Recipient Address</Label>
                                                            <Input
                                                                placeholder="e.g., admin@yoursite.com"
                                                                value={action.actionConfig.to || ''}
                                                                onChange={(e) => handleActionConfigChange(index, 'to', e.target.value)}
                                                                className="h-11 rounded-xl bg-muted/10 border-muted-foreground/20"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Subject Line</Label>
                                                            <Input
                                                                placeholder="The spark that starts the journey"
                                                                value={action.actionConfig.subject || ''}
                                                                onChange={(e) => handleActionConfigChange(index, 'subject', e.target.value)}
                                                                className="h-11 rounded-xl bg-muted/10 border-muted-foreground/20"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Message Body</Label>
                                                            <Textarea
                                                                placeholder="What's the message?"
                                                                value={action.actionConfig.body || ''}
                                                                onChange={(e) => handleActionConfigChange(index, 'body', e.target.value)}
                                                                className="rounded-xl min-h-[100px] bg-muted/10 border-muted-foreground/20"
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {action.actionType === 'webhook' && (
                                                    <div className="space-y-4 pt-2 animate-in fade-in duration-500">
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Target URL</Label>
                                                            <Input
                                                                placeholder="https://api.thirdparty.com/hook"
                                                                value={action.actionConfig.url || ''}
                                                                onChange={(e) => handleActionConfigChange(index, 'url', e.target.value)}
                                                                className="h-11 rounded-xl bg-muted/10 border-muted-foreground/20 font-medium"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">HTTP Method</Label>
                                                            <Select
                                                                value={action.actionConfig.method || 'POST'}
                                                                onValueChange={(value) => handleActionConfigChange(index, 'method', value)}
                                                            >
                                                                <SelectTrigger className="h-11 rounded-xl bg-muted/10 border-muted-foreground/20">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent className="rounded-xl">
                                                                    <SelectItem value="POST" className="font-bold">POST</SelectItem>
                                                                    <SelectItem value="GET" className="font-bold">GET</SelectItem>
                                                                    <SelectItem value="PUT" className="font-bold">PUT</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                )}

                                                {(action.actionType === 'slack' || action.actionType === 'discord') && (
                                                    <div className="space-y-4 pt-2 animate-in fade-in duration-500">
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Webhook URL</Label>
                                                            <Input
                                                                placeholder={`${action.actionType === 'slack' ? 'Slack' : 'Discord'} Incoming Webhook`}
                                                                value={action.actionConfig.webhookUrl || ''}
                                                                onChange={(e) => handleActionConfigChange(index, 'webhookUrl', e.target.value)}
                                                                className="h-11 rounded-xl bg-muted/10 border-muted-foreground/20"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Rich Message</Label>
                                                            <Textarea
                                                                placeholder="Dynamic data enabled..."
                                                                value={action.actionConfig.message || ''}
                                                                onChange={(e) => handleActionConfigChange(index, 'message', e.target.value)}
                                                                className="rounded-xl min-h-[100px] bg-muted/10 border-muted-foreground/20"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-8">
                        {/* Trigger Selection */}
                        <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none bg-primary/5 dark:bg-primary/10 rounded-[2.5rem] overflow-hidden border border-primary/10 backdrop-blur-sm">
                            <CardHeader className="px-8 pt-8 pb-4">
                                <CardTitle className="text-xl font-black flex items-center gap-2">
                                    <Zap className="h-5 w-5 text-primary" />
                                    The Spark
                                </CardTitle>
                                <CardDescription className="text-primary/70 font-medium">What triggers this workflow?</CardDescription>
                            </CardHeader>
                            <CardContent className="px-8 pb-8 space-y-4">
                                <div className="grid grid-cols-1 gap-3">
                                    {triggerTypes.map((trigger) => {
                                        const Icon = trigger.icon;
                                        const isSelected = triggerType === trigger.value;
                                        return (
                                            <button
                                                key={trigger.value}
                                                onClick={() => setTriggerType(trigger.value)}
                                                className={`p-4 rounded-[1.5rem] border-2 transition-all text-left flex items-start gap-4 ${isSelected
                                                    ? 'border-primary bg-white dark:bg-slate-900 shadow-lg scale-[1.02]'
                                                    : 'border-transparent bg-muted/20 hover:bg-muted/40 hover:scale-[1.01]'
                                                    }`}
                                            >
                                                <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-primary text-white' : 'bg-muted'}`}>
                                                    <Icon className="h-5 w-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="font-black text-sm">{trigger.label}</h3>
                                                    <p className="text-[10px] font-medium text-muted-foreground leading-tight mt-1 truncate">{trigger.description}</p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Trigger configuration details */}
                                {triggerType && (
                                    <Card className="mt-4 border-none bg-white dark:bg-slate-900 rounded-[1.5rem] p-6 shadow-sm border border-border/50 animate-in zoom-in-95 duration-300">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-4">Configurations</h4>
                                        {triggerType === 'event' && (
                                            <div className="space-y-3">
                                                <Label className="text-[11px] font-bold">Event Name</Label>
                                                <Input
                                                    placeholder="e.g., checkout_start"
                                                    value={triggerConfig.eventType || ''}
                                                    onChange={(e) => handleTriggerConfigChange('eventType', e.target.value)}
                                                    className="h-10 rounded-xl bg-muted/10 border-none font-bold"
                                                />
                                            </div>
                                        )}
                                        {triggerType === 'page_visit' && (
                                            <div className="space-y-3">
                                                <Label className="text-[11px] font-bold">Page Path</Label>
                                                <Input
                                                    placeholder="/pricing"
                                                    value={triggerConfig.pageUrl || ''}
                                                    onChange={(e) => handleTriggerConfigChange('pageUrl', e.target.value)}
                                                    className="h-10 rounded-xl bg-muted/10 border-none font-bold"
                                                />
                                            </div>
                                        )}
                                        {triggerType === 'utm_campaign' && (
                                            <div className="space-y-3">
                                                <Label className="text-[11px] font-bold">Campaign Name</Label>
                                                <Input
                                                    placeholder="black-friday"
                                                    value={triggerConfig.utmCampaign || ''}
                                                    onChange={(e) => handleTriggerConfigChange('utmCampaign', e.target.value)}
                                                    className="h-10 rounded-xl bg-muted/10 border-none font-bold"
                                                />
                                            </div>
                                        )}
                                        <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground font-medium bg-muted/20 p-3 rounded-xl border border-dotted border-muted-foreground/20">
                                            <Activity className="h-3 w-3 text-primary" />
                                            Monitoring 24/7 once active
                                        </div>
                                    </Card>
                                )}
                            </CardContent>
                        </Card>

                        {/* Summary View */}
                        <Card className="border-none shadow-sm bg-slate-900 text-white rounded-[2.5rem] p-8 hidden lg:block">
                            <h3 className="text-lg font-black mb-6 flex items-center gap-3">
                                <Filter className="h-5 w-5 text-primary" />
                                Blueprint
                            </h3>
                            <div className="space-y-6">
                                <div className="space-y-2 border-l-2 border-primary/30 pl-4 py-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 italic">IF</p>
                                    <p className="font-bold text-sm">
                                        {triggerType 
                                            ? `Users trigger ${triggerTypes.find(t => t.value === triggerType)?.label}`
                                            : 'No trigger defined'}
                                    </p>
                                </div>
                                <div className="space-y-4 border-l-2 border-emerald-500/30 pl-4 py-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 italic">THEN</p>
                                    {actions.length > 0 ? (
                                        <ul className="space-y-3">
                                            {actions.map((a, i) => (
                                                <li key={i} className="flex items-center gap-2 text-sm font-bold">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                    {actionTypes.find(at => at.value === a.actionType)?.label || 'Anew action'}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm font-bold text-slate-500">Wait for actions...</p>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}

function BuilderSkeleton() {
    return (
        <div className="min-h-screen bg-muted/20 p-4 sm:p-6 lg:p-12">
            <div className="max-w-5xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded-2xl" />
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-48 rounded-lg" />
                            <Skeleton className="h-4 w-64 rounded-md" />
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Skeleton className="h-12 w-32 rounded-2xl" />
                        <Skeleton className="h-12 w-44 rounded-2xl" />
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        <Skeleton className="h-64 w-full rounded-[2.5rem]" />
                        <Skeleton className="h-96 w-full rounded-[2.5rem]" />
                    </div>
                    <div className="space-y-8">
                        <Skeleton className="h-[400px] w-full rounded-[2.5rem]" />
                        <Skeleton className="h-[300px] w-full rounded-[2.5rem]" />
                    </div>
                </div>
            </div>
        </div>
    );
}
