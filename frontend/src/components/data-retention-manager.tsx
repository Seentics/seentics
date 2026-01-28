'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Clock, 
  Trash2, 
  Database, 
  Settings, 
  AlertTriangle,
  CheckCircle,
  Info,
  Shield,
  Calendar,
  BarChart3,
  Workflow,
  User
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RetentionPolicy {
  id: string;
  dataType: string;
  retentionPeriod: number;
  retentionUnit: 'days' | 'months' | 'years';
  autoDelete: boolean;
  description: string;
  lastCleanup: Date;
  nextCleanup: Date;
  recordsAffected: number;
}

interface DataRetentionManagerProps {
  websiteId: string;
}

const DEFAULT_POLICIES: RetentionPolicy[] = [
  {
    id: '1',
    dataType: 'Analytics Events',
    retentionPeriod: 2,
    retentionUnit: 'years',
    autoDelete: true,
    description: 'Raw analytics events (page views, clicks, etc.)',
    lastCleanup: new Date('2024-01-15'),
    nextCleanup: new Date('2024-02-15'),
    recordsAffected: 1250000
  },
  {
    id: '2',
    dataType: 'Session Data',
    retentionPeriod: 1,
    retentionUnit: 'year',
    autoDelete: true,
    description: 'User session information and behavior patterns',
    lastCleanup: new Date('2024-01-15'),
    nextCleanup: new Date('2024-02-15'),
    recordsAffected: 450000
  },
  {
    id: '3',
    dataType: 'Workflow Executions',
    retentionPeriod: 6,
    retentionUnit: 'months',
    autoDelete: true,
    description: 'Individual workflow execution logs and results',
    lastCleanup: new Date('2024-01-15'),
    nextCleanup: new Date('2024-02-15'),
    recordsAffected: 89000
  },
  {
    id: '4',
    dataType: 'User Profiles',
    retentionPeriod: 0,
    retentionUnit: 'years',
    autoDelete: false,
    description: 'User account information and preferences',
    lastCleanup: new Date('2024-01-15'),
    nextCleanup: new Date('2024-01-15'),
    recordsAffected: 1250
  },
  {
    id: '5',
    dataType: 'IP Addresses',
    retentionPeriod: 90,
    retentionUnit: 'days',
    autoDelete: true,
    description: 'Visitor IP addresses for security and analytics',
    lastCleanup: new Date('2024-01-15'),
    nextCleanup: new Date('2024-02-15'),
    recordsAffected: 75000
  }
];

export default function DataRetentionManager({ websiteId }: DataRetentionManagerProps) {
  const [policies, setPolicies] = useState<RetentionPolicy[]>(DEFAULT_POLICIES);
  const [showPolicyDialog, setShowPolicyDialog] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<RetentionPolicy | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handlePolicyUpdate = async (policyId: string, updates: Partial<RetentionPolicy>) => {
    setIsProcessing(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setPolicies(prev => prev.map(policy => 
        policy.id === policyId ? { ...policy, ...updates } : policy
      ));

      toast({
        title: "Policy Updated",
        description: "Data retention policy has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update retention policy. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoDeleteToggle = (policyId: string, enabled: boolean) => {
    handlePolicyUpdate(policyId, { autoDelete: enabled });
  };

  const handleRetentionChange = (policyId: string, period: number, unit: 'days' | 'months' | 'years') => {
    handlePolicyUpdate(policyId, { retentionPeriod: period, retentionUnit: unit });
  };

  const runManualCleanup = async (policyId: string) => {
    setIsProcessing(true);
    try {
      // Simulate cleanup process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const policy = policies.find(p => p.id === policyId);
      if (policy) {
        const now = new Date();
        const nextCleanup = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
        
        handlePolicyUpdate(policyId, {
          lastCleanup: now,
          nextCleanup: nextCleanup,
          recordsAffected: Math.floor(Math.random() * 100000) + 10000
        });
      }

      toast({
        title: "Cleanup Complete",
        description: "Data cleanup has been completed successfully.",
      });
    } catch (error) {
      toast({
        title: "Cleanup Failed",
        description: "Data cleanup failed. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getRetentionUnitOptions = () => [
    { value: 'days', label: 'Days' },
    { value: 'months', label: 'Months' },
    { value: 'years', label: 'Years' }
  ];

  const getRetentionPeriodOptions = (unit: string) => {
    if (unit === 'days') {
      return Array.from({ length: 30 }, (_, i) => ({ value: i + 1, label: `${i + 1} day${i > 0 ? 's' : ''}` }));
    } else if (unit === 'months') {
      return Array.from({ length: 24 }, (_, i) => ({ value: i + 1, label: `${i + 1} month${i > 0 ? 's' : ''}` }));
    } else {
      return Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: `${i + 1} year${i > 0 ? 's' : ''}` }));
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getDataTypeIcon = (dataType: string) => {
    const icons: Record<string, any> = {
      'Analytics Events': BarChart3,
      'Session Data': Clock,
      'Workflow Executions': Workflow,
      'User Profiles': User,
      'IP Addresses': Shield
    };
    const Icon = icons[dataType] || Info;
    return <Icon className="h-4 w-4" />;
  };

  const getDataTypeColor = (dataType: string) => {
    const colors: Record<string, string> = {
      'Analytics Events': 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      'Session Data': 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      'Workflow Executions': 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
      'User Profiles': 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
      'IP Addresses': 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    };
    return colors[dataType] || 'bg-slate-100 text-slate-800 dark:bg-slate-900/20 dark:text-slate-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded">
          <Database className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Data Retention Policies
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Manage how long different types of data are stored and when they're automatically cleaned up
          </p>
        </div>
      </div>

      {/* Compliance Notice */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">GDPR & CCPA Compliance</p>
              <p>
                These retention policies ensure we only keep data for as long as necessary and comply with 
                data protection regulations. Personal data is automatically anonymized or deleted according to these schedules.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Retention Policies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-600" />
            Current Policies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {policies.map((policy) => (
              <div key={policy.id} className="border border-slate-200 dark:border-slate-700 rounded p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded ${getDataTypeColor(policy.dataType)}`}>
                      {getDataTypeIcon(policy.dataType)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                        {policy.dataType}
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {policy.description}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant={policy.autoDelete ? "default" : "secondary"}>
                      {policy.autoDelete ? "Auto-cleanup" : "Manual only"}
                    </Badge>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <Label className="text-xs text-slate-500 dark:text-slate-400">Retention Period</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Select
                        value={policy.retentionPeriod.toString()}
                        onValueChange={(value) => handleRetentionChange(policy.id, parseInt(value), policy.retentionUnit)}
                        disabled={isProcessing}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getRetentionPeriodOptions(policy.retentionUnit).map((option) => (
                            <SelectItem key={option.value} value={option.value.toString()}>
                              {option.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={policy.retentionUnit}
                        onValueChange={(value: 'days' | 'months' | 'years') => 
                          handleRetentionChange(policy.id, policy.retentionPeriod, value)
                        }
                        disabled={isProcessing}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getRetentionUnitOptions().map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-500 dark:text-slate-400">Auto Cleanup</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Switch
                        id={`auto-delete-${policy.id}`}
                        checked={policy.autoDelete}
                        onCheckedChange={(checked) => handleAutoDeleteToggle(policy.id, checked)}
                        disabled={isProcessing}
                      />
                      <Label htmlFor={`auto-delete-${policy.id}`} className="text-sm">
                        {policy.autoDelete ? 'Enabled' : 'Disabled'}
                      </Label>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-500 dark:text-slate-400">Last Cleanup</Label>
                    <p className="text-sm text-slate-900 dark:text-slate-100 mt-1">
                      {formatDate(policy.lastCleanup)}
                    </p>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-500 dark:text-slate-400">Next Cleanup</Label>
                    <p className="text-sm text-slate-900 dark:text-slate-100 mt-1">
                      {formatDate(policy.nextCleanup)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-medium">{policy.recordsAffected.toLocaleString()}</span> records currently stored
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runManualCleanup(policy.id)}
                      disabled={isProcessing}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Run Cleanup
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cleanup Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Cleanup Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800 dark:text-green-200">Next Scheduled Cleanup</span>
                </div>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Automatic data cleanup runs daily at 2:00 AM UTC. The next cleanup will process{' '}
                  <span className="font-medium">
                    {policies.filter(p => p.autoDelete).length} data types
                  </span>.
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-800 dark:text-blue-200">Data Anonymization</span>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Before deletion, personal identifiers are anonymized to maintain analytics integrity 
                  while ensuring privacy compliance.
                </p>
              </div>
            </div>

            <Separator />

            <div className="text-sm text-slate-600 dark:text-slate-400">
              <p className="mb-2">
                <strong>Important Notes:</strong>
              </p>
              <ul className="space-y-1 ml-4">
                <li>• Data retention policies cannot be shorter than 30 days for legal compliance</li>
                <li>• User profile data is retained indefinitely unless manually deleted</li>
                <li>• Analytics data is automatically aggregated before deletion</li>
                <li>• All cleanup operations are logged for audit purposes</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
