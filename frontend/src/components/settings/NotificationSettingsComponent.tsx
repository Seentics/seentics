import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  listChannels, createChannel, deleteChannel, 
  listAlerts, createAlert, deleteAlert, toggleAlert 
} from '@/lib/notifications-api';
import { toast } from 'sonner';
import { 
  Loader2, Bell, Mail, Webhook, Slack, 
  Plus, Trash2, ShieldAlert, CheckCircle2, XCircle,
  Activity, ArrowUpRight, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger 
} from '@/components/ui/dialog';

export function NotificationSettingsComponent({ websiteId }: { websiteId: string }) {
  const queryClient = useQueryClient();
  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [isAddingAlert, setIsAddingAlert] = useState(false);
  
  const [newChannelType, setNewChannelType] = useState<'email' | 'slack' | 'webhook'>('email');
  const [newChannelConfig, setNewChannelConfig] = useState<any>({ email: '' });

  const [newAlertType, setNewAlertType] = useState('traffic');
  const [newAlertCondition, setNewAlertCondition] = useState('spike');
  const [newAlertThreshold, setNewAlertThreshold] = useState(20);
  const [newAlertInterval, setNewAlertInterval] = useState('hourly');
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);

  const { data: channels, isLoading: isLoadingChannels } = useQuery({
    queryKey: ['notification-channels', websiteId],
    queryFn: () => listChannels(websiteId),
  });

  const { data: alerts, isLoading: isLoadingAlerts } = useQuery({
    queryKey: ['notification-alerts', websiteId],
    queryFn: () => listAlerts(websiteId),
  });

  const createChannelMutation = useMutation({
    mutationFn: (data: any) => createChannel(websiteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-channels', websiteId] });
      toast.success('Notification channel added');
      setIsAddingChannel(false);
      setNewChannelConfig({ email: '' });
    },
    onError: (error: any) => toast.error(error.message || 'Failed to add channel'),
  });

  const deleteChannelMutation = useMutation({
    mutationFn: (id: string) => deleteChannel(websiteId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-channels', websiteId] });
      queryClient.invalidateQueries({ queryKey: ['notification-alerts', websiteId] });
      toast.success('Channel removed');
    },
  });

  const createAlertMutation = useMutation({
    mutationFn: (data: any) => createAlert(websiteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-alerts', websiteId] });
      toast.success('Alert created');
      setIsAddingAlert(false);
      setSelectedChannels([]);
    },
    onError: (error: any) => toast.error(error.message || 'Failed to create alert'),
  });

  const deleteAlertMutation = useMutation({
    mutationFn: (id: string) => deleteAlert(websiteId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-alerts', websiteId] });
      toast.success('Alert deleted');
    },
  });

  const toggleAlertMutation = useMutation({
    mutationFn: (id: string) => toggleAlert(websiteId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-alerts', websiteId] });
    },
  });

  const handleCreateChannel = () => {
    let config = {};
    if (newChannelType === 'email') {
      if (!newChannelConfig.email) return toast.error('Email is required');
      config = { email: newChannelConfig.email };
    } else if (newChannelType === 'slack' || newChannelType === 'webhook') {
      if (!newChannelConfig.webhook_url) return toast.error('Webhook URL is required');
      config = { webhook_url: newChannelConfig.webhook_url };
    }
    createChannelMutation.mutate({ type: newChannelType, config });
  };

  const handleCreateAlert = () => {
    if (selectedChannels.length === 0) return toast.error('Select at least one channel');
    createAlertMutation.mutate({
      type: newAlertType,
      condition: newAlertCondition,
      threshold: Number(newAlertThreshold),
      interval: newAlertInterval,
      channels: selectedChannels,
      is_active: true
    });
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'slack': return <Slack className="h-4 w-4" />;
      case 'webhook': return <Webhook className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  if (isLoadingChannels || isLoadingAlerts) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold tracking-tight">Notifications & Alerts</h2>
        <p className="text-muted-foreground text-sm">Configure how you want to be notified about your website traffic and performance.</p>
      </div>

      {/* Notification Channels */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base font-semibold">Notification Channels</CardTitle>
            <CardDescription>Where should we send your alerts?</CardDescription>
          </div>
          <Dialog open={isAddingChannel} onOpenChange={setIsAddingChannel}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 gap-1">
                <Plus className="h-3.5 w-3.5" /> Add Channel
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Notification Channel</DialogTitle>
                <DialogDescription>
                  Choose a channel to receive alerts and notifications.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Channel Type</Label>
                  <Select 
                    value={newChannelType} 
                    onValueChange={(v: any) => setNewChannelType(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="slack">Slack Webhook</SelectItem>
                      <SelectItem value="webhook">Generic Webhook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newChannelType === 'email' ? (
                  <div className="grid gap-2">
                    <Label>Email Address</Label>
                    <Input 
                      placeholder="alerts@example.com" 
                      value={newChannelConfig.email}
                      onChange={(e) => setNewChannelConfig({ ...newChannelConfig, email: e.target.value })}
                    />
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <Label>Webhook URL</Label>
                    <Input 
                      placeholder="https://hooks.slack.com/services/..." 
                      value={newChannelConfig.webhook_url}
                      onChange={(e) => setNewChannelConfig({ ...newChannelConfig, webhook_url: e.target.value })}
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddingChannel(false)}>Cancel</Button>
                <Button onClick={handleCreateChannel} disabled={createChannelMutation.isPending}>
                  {createChannelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Channel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {channels?.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed rounded-lg">
                <Bell className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No notification channels configured yet.</p>
              </div>
            ) : (
              channels?.map((channel) => (
                <div key={channel.id} className="flex items-center justify-between p-3 rounded-lg border bg-background/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-full text-primary">
                      {getChannelIcon(channel.type)}
                    </div>
                    <div>
                      <p className="text-sm font-medium capitalize">{channel.type}</p>
                      <p className="text-xs text-muted-foreground">
                        {channel.type === 'email' ? channel.config.email : channel.config.webhook_url}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => deleteChannelMutation.mutate(channel.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base font-semibold">Smart Alerts</CardTitle>
            <CardDescription>Get notified when specific conditions are met.</CardDescription>
          </div>
          <Dialog open={isAddingAlert} onOpenChange={setIsAddingAlert}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 gap-1" disabled={channels?.length === 0}>
                <Plus className="h-3.5 w-3.5" /> Create Alert
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create Smart Alert</DialogTitle>
                <DialogDescription>
                  Configure an alert based on traffic or performance metrics.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Metric Type</Label>
                    <Select value={newAlertType} onValueChange={setNewAlertType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="traffic">Traffic (Visitors)</SelectItem>
                        <SelectItem value="performance">Performance (WebVitals)</SelectItem>
                        <SelectItem value="conversion">Conversion Rate</SelectItem>
                        <SelectItem value="error">Error Rate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Condition</Label>
                    <Select value={newAlertCondition} onValueChange={setNewAlertCondition}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="spike">Spike (Increase %)</SelectItem>
                        <SelectItem value="drop">Drop (Decrease %)</SelectItem>
                        <SelectItem value="above">Above Value</SelectItem>
                        <SelectItem value="below">Below Value</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Threshold</Label>
                    <div className="flex items-center gap-2">
                      <Input 
                        type="number" 
                        value={newAlertThreshold} 
                        onChange={(e) => setNewAlertThreshold(Number(e.target.value))}
                      />
                      <span className="text-sm text-muted-foreground">{newAlertCondition.includes('spike') || newAlertCondition.includes('drop') ? '%' : ''}</span>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Interval</Label>
                    <Select value={newAlertInterval} onValueChange={setNewAlertInterval}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="realtime">Real-time (5m)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Send notifications to:</Label>
                  <div className="grid gap-2 max-h-[150px] overflow-y-auto p-2 border rounded-md">
                    {channels?.map(channel => (
                      <div key={channel.id} className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          id={`ch-${channel.id}`}
                          checked={selectedChannels.includes(channel.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedChannels([...selectedChannels, channel.id]);
                            else setSelectedChannels(selectedChannels.filter(id => id !== channel.id));
                          }}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <Label htmlFor={`ch-${channel.id}`} className="text-sm cursor-pointer flex items-center gap-2">
                          {getChannelIcon(channel.type)} 
                          <span className="capitalize">{channel.type}</span>: 
                          <span className="text-muted-foreground truncate max-w-[200px]">
                            {channel.type === 'email' ? channel.config.email : channel.config.webhook_url}
                          </span>
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddingAlert(false)}>Cancel</Button>
                <Button onClick={handleCreateAlert} disabled={createAlertMutation.isPending}>
                  {createAlertMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Alert
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {alerts?.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed rounded-lg bg-muted/20">
                <Activity className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground font-medium">No alerts configured</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Add a notification channel first to enable alerts.</p>
              </div>
            ) : (
              alerts?.map((alert) => (
                <div key={alert.id} className="flex flex-col gap-3 p-4 rounded-xl border bg-background/40 hover:bg-background/60 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-md ${alert.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {alert.condition === 'spike' ? <ArrowUpRight className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold capitalize flex items-center gap-2">
                          {alert.type} Alert
                          {!alert.is_active && <Badge variant="secondary" className="text-[10px] h-4">Paused</Badge>}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Notify when {alert.type} {alert.condition} {alert.threshold}{alert.condition === 'spike' || alert.condition === 'drop' ? '%' : ''} ({alert.interval})
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={alert.is_active} 
                        onCheckedChange={() => toggleAlertMutation.mutate(alert.id)}
                      />
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteAlertMutation.mutate(alert.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {alert.channels.map(channelId => {
                      const ch = channels?.find(c => c.id === channelId);
                      if (!ch) return null;
                      return (
                        <Badge key={channelId} variant="outline" className="text-[10px] py-0 h-5 gap-1 bg-background">
                          {getChannelIcon(ch.type)}
                          <span className="capitalize">{ch.type}</span>
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage limits or tips */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex gap-3">
        <ShieldAlert className="h-5 w-5 text-primary shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-semibold">Pro Tip: Avoiding Notification Fatigue</p>
          <p className="text-xs text-muted-foreground">
            Try setting higher thresholds for "Spike" alerts to only get notified about significant traffic changes. 
            Hourly intervals are recommended for most production websites.
          </p>
        </div>
      </div>
    </div>
  );
}
