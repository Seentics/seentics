'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateAutomation } from '@/lib/automations-api';
import { useToast } from '@/hooks/use-toast';
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
    const router = useRouter();
    const websiteId = params?.websiteId as string;
    const { toast } = useToast();

    const createAutomation = useCreateAutomation();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [triggerType, setTriggerType] = useState('');
    const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({});
    const [actions, setActions] = useState<Array<{ actionType: string; actionConfig: Record<string, any> }>>([]);

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
        newActions[index].actionConfig[key] = value;
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

            router.push(`/websites/${websiteId}/automations`);
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to create automation. Please try again.",
                variant: "destructive",
            });
        }
    };

    const selectedTrigger = triggerTypes.find(t => t.value === triggerType);

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 sm:p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={`/websites/${websiteId}/automations`}>
                            <Button variant="ghost" size="icon" className="rounded-xl">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight">Automation Builder</h1>
                            <p className="text-muted-foreground text-sm">Create powerful workflows with triggers and actions</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            className="h-10 px-6 rounded-xl font-bold"
                            onClick={() => router.push(`/websites/${websiteId}/automations`)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="brand"
                            className="h-10 px-6 rounded-xl font-bold gap-2"
                            onClick={handleSave}
                            disabled={createAutomation.isPending}
                        >
                            {createAutomation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4" />
                                    Save Automation
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Basic Info */}
                <Card className="border-muted-foreground/10 rounded-3xl shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-xl font-black">Basic Information</CardTitle>
                        <CardDescription>Give your automation a name and description</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-sm font-bold">Automation Name *</Label>
                            <Input
                                id="name"
                                placeholder="e.g., Welcome Email Sequence"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="h-12 rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description" className="text-sm font-bold">Description</Label>
                            <Textarea
                                id="description"
                                placeholder="Describe what this automation does..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="rounded-xl min-h-[100px]"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Trigger Selection */}
                <Card className="border-muted-foreground/10 rounded-3xl shadow-lg bg-gradient-to-br from-primary/5 to-transparent">
                    <CardHeader>
                        <CardTitle className="text-xl font-black flex items-center gap-2">
                            <Zap className="h-5 w-5 text-primary" />
                            Trigger
                        </CardTitle>
                        <CardDescription>Choose what starts this automation</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {triggerTypes.map((trigger) => {
                                const Icon = trigger.icon;
                                const isSelected = triggerType === trigger.value;
                                return (
                                    <button
                                        key={trigger.value}
                                        onClick={() => setTriggerType(trigger.value)}
                                        className={`p-4 rounded-2xl border-2 transition-all text-left ${isSelected
                                            ? 'border-primary bg-primary/10 shadow-lg scale-105'
                                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-xl ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                                <Icon className="h-5 w-5" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-bold text-sm mb-1">{trigger.label}</h3>
                                                <p className="text-xs text-muted-foreground">{trigger.description}</p>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Trigger Configuration */}
                        {triggerType && (
                            <div className="mt-6 p-6 rounded-2xl bg-background border border-border space-y-4">
                                <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Trigger Configuration</h4>

                                {triggerType === 'event' && (
                                    <div className="space-y-2">
                                        <Label htmlFor="eventType" className="text-sm font-bold">Event Type</Label>
                                        <Input
                                            id="eventType"
                                            placeholder="e.g., signup, purchase, download"
                                            value={triggerConfig.eventType || ''}
                                            onChange={(e) => handleTriggerConfigChange('eventType', e.target.value)}
                                            className="h-10 rounded-xl"
                                        />
                                    </div>
                                )}

                                {triggerType === 'page_visit' && (
                                    <div className="space-y-2">
                                        <Label htmlFor="pageUrl" className="text-sm font-bold">Page URL</Label>
                                        <Input
                                            id="pageUrl"
                                            placeholder="/pricing, /checkout, etc."
                                            value={triggerConfig.pageUrl || ''}
                                            onChange={(e) => handleTriggerConfigChange('pageUrl', e.target.value)}
                                            className="h-10 rounded-xl"
                                        />
                                    </div>
                                )}

                                {triggerType === 'utm_campaign' && (
                                    <div className="space-y-2">
                                        <Label htmlFor="utmCampaign" className="text-sm font-bold">UTM Campaign</Label>
                                        <Input
                                            id="utmCampaign"
                                            placeholder="summer-sale, launch-2024, etc."
                                            value={triggerConfig.utmCampaign || ''}
                                            onChange={(e) => handleTriggerConfigChange('utmCampaign', e.target.value)}
                                            className="h-10 rounded-xl"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Actions */}
                <Card className="border-muted-foreground/10 rounded-3xl shadow-lg">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl font-black flex items-center gap-2">
                                    <Play className="h-5 w-5 text-emerald-500" />
                                    Actions
                                </CardTitle>
                                <CardDescription>Define what happens when triggered</CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 px-4 rounded-xl font-bold gap-2"
                                onClick={handleAddAction}
                            >
                                <Plus className="h-4 w-4" />
                                Add Action
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {actions.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed rounded-2xl">
                                <p className="text-muted-foreground mb-4">No actions added yet</p>
                                <Button variant="brand" size="sm" className="rounded-xl" onClick={handleAddAction}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Your First Action
                                </Button>
                            </div>
                        ) : (
                            actions.map((action, index) => {
                                const selectedAction = actionTypes.find(a => a.value === action.actionType);
                                const ActionIcon = selectedAction?.icon || Database;

                                return (
                                    <div key={index} className="p-6 rounded-2xl bg-muted/30 border border-border space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-bold text-sm flex items-center gap-2">
                                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-black">
                                                    {index + 1}
                                                </span>
                                                Action {index + 1}
                                            </h4>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                onClick={() => handleRemoveAction(index)}
                                            >
                                                Remove
                                            </Button>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-sm font-bold">Action Type</Label>
                                            <Select value={action.actionType} onValueChange={(value) => handleActionTypeChange(index, value)}>
                                                <SelectTrigger className="h-10 rounded-xl">
                                                    <SelectValue placeholder="Select an action type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {actionTypes.map((actionType) => {
                                                        const Icon = actionType.icon;
                                                        return (
                                                            <SelectItem key={actionType.value} value={actionType.value}>
                                                                <div className="flex items-center gap-2">
                                                                    <Icon className="h-4 w-4" />
                                                                    {actionType.label}
                                                                </div>
                                                            </SelectItem>
                                                        );
                                                    })}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Action-specific configuration */}
                                        {action.actionType === 'email' && (
                                            <div className="space-y-3">
                                                <div className="space-y-2">
                                                    <Label className="text-sm font-bold">To Email</Label>
                                                    <Input
                                                        placeholder="user@example.com or {{visitor.email}}"
                                                        value={action.actionConfig.to || ''}
                                                        onChange={(e) => handleActionConfigChange(index, 'to', e.target.value)}
                                                        className="h-10 rounded-xl"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-sm font-bold">Subject</Label>
                                                    <Input
                                                        placeholder="Email subject"
                                                        value={action.actionConfig.subject || ''}
                                                        onChange={(e) => handleActionConfigChange(index, 'subject', e.target.value)}
                                                        className="h-10 rounded-xl"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-sm font-bold">Message</Label>
                                                    <Textarea
                                                        placeholder="Email body"
                                                        value={action.actionConfig.body || ''}
                                                        onChange={(e) => handleActionConfigChange(index, 'body', e.target.value)}
                                                        className="rounded-xl"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {action.actionType === 'webhook' && (
                                            <div className="space-y-3">
                                                <div className="space-y-2">
                                                    <Label className="text-sm font-bold">Webhook URL</Label>
                                                    <Input
                                                        placeholder="https://example.com/webhook"
                                                        value={action.actionConfig.url || ''}
                                                        onChange={(e) => handleActionConfigChange(index, 'url', e.target.value)}
                                                        className="h-10 rounded-xl"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-sm font-bold">Method</Label>
                                                    <Select
                                                        value={action.actionConfig.method || 'POST'}
                                                        onValueChange={(value) => handleActionConfigChange(index, 'method', value)}
                                                    >
                                                        <SelectTrigger className="h-10 rounded-xl">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="POST">POST</SelectItem>
                                                            <SelectItem value="GET">GET</SelectItem>
                                                            <SelectItem value="PUT">PUT</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        )}

                                        {(action.actionType === 'slack' || action.actionType === 'discord') && (
                                            <div className="space-y-3">
                                                <div className="space-y-2">
                                                    <Label className="text-sm font-bold">Webhook URL</Label>
                                                    <Input
                                                        placeholder={`${action.actionType === 'slack' ? 'Slack' : 'Discord'} webhook URL`}
                                                        value={action.actionConfig.webhookUrl || ''}
                                                        onChange={(e) => handleActionConfigChange(index, 'webhookUrl', e.target.value)}
                                                        className="h-10 rounded-xl"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-sm font-bold">Message</Label>
                                                    <Textarea
                                                        placeholder="Message to send"
                                                        value={action.actionConfig.message || ''}
                                                        onChange={(e) => handleActionConfigChange(index, 'message', e.target.value)}
                                                        className="rounded-xl"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
