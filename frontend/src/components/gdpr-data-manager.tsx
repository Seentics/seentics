'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Download, 
  Trash2, 
  Eye, 
  Shield, 
  FileText, 
  Mail, 
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Database,
  Settings
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { privacyAPI } from '@/lib/privacy-api';

interface DataRequest {
  id: string;
  type: 'export' | 'deletion' | 'correction';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  completedAt?: Date;
  description?: string;
}

interface GDPRDataManagerProps {
  userId: string;
  userEmail: string;
}

export default function GDPRDataManager({ userId, userEmail }: GDPRDataManagerProps) {
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showDeletionDialog, setShowDeletionDialog] = useState(false);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');
  const [correctionDetails, setCorrectionDetails] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const { toast } = useToast();

  // Data requests state
  const [dataRequests, setDataRequests] = useState<DataRequest[]>([]);

  // Load existing requests on component mount
  useEffect(() => {
    const loadExistingRequests = async () => {
      if (!userId) return;
      
      setIsLoadingRequests(true);
      try {
        const response = await privacyAPI.getPrivacyRequests();
        if (response.success && response.data.requests) {
          const requests = response.data.requests.map((req: any) => ({
            id: req.id || req._id,
            type: req.type,
            status: req.status,
            createdAt: new Date(req.createdAt),
            completedAt: req.completedAt ? new Date(req.completedAt) : undefined,
            description: req.reason || req.details
          }));
          setDataRequests(requests);
        }
      } catch (error) {
        console.error('Failed to load existing requests:', error);
      } finally {
        setIsLoadingRequests(false);
      }
    };

    loadExistingRequests();
  }, [userId]);

  // Check if user has pending requests of a specific type
  const hasPendingRequest = (type: string) => {
    return dataRequests.some(req => req.type === type && (req.status === 'pending' || req.status === 'processing'));
  };

  const handleDataExport = async () => {
    setIsProcessing(true);
    try {
      // Direct export - get data immediately
      const response = await privacyAPI.exportUserData();
      
      if (response.success) {
        // Create downloadable file
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        // Create download link
        const link = document.createElement('a');
        link.href = url;
        link.download = `seentics-data-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
          title: "Data Exported",
          description: "Your data has been exported and downloaded successfully.",
        });
      }

      setShowExportDialog(false);
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: error.message || "There was an error exporting your data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDataDeletion = async () => {
    if (!deletionReason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for data deletion.",
        variant: "destructive"
      });
      return;
    }

    if (deletionReason.trim().length < 1) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for data deletion.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Direct deletion using the delete endpoint
      const response = await privacyAPI.processDataDeletion(deletionReason);
      
      if (response.success) {
        toast({
          title: "Account Deleted",
          description: "Your account and all associated data have been permanently deleted.",
        });

        // Redirect to home page or logout
        window.location.href = '/';
      }

      setShowDeletionDialog(false);
      setDeletionReason('');
    } catch (error: any) {
      console.error('Deletion error:', error);
      toast({
        title: "Deletion Failed",
        description: error.message || "There was an error deleting your data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDataCorrection = async () => {
    // Check for existing pending correction request
    if (hasPendingRequest('correction')) {
      toast({
        title: "Request Already Exists",
        description: "You already have a correction request in progress. Please wait for it to complete.",
        variant: "destructive"
      });
      return;
    }

    if (!correctionDetails.trim()) {
      toast({
        title: "Details Required",
        description: "Please provide details about what data needs to be corrected.",
        variant: "destructive"
      });
      return;
    }

    if (correctionDetails.trim().length < 10) {
      toast({
        title: "Details Too Short",
        description: "Please provide more detailed information (at least 10 characters).",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Create privacy request for data correction
      const response = await privacyAPI.createPrivacyRequest({
        type: 'correction',
        details: correctionDetails
      });
      
      // Add to requests history
      const newRequest: DataRequest = {
        id: response.data.request.id,
        type: 'correction',
        status: response.data.request.status,
        createdAt: new Date(response.data.request.createdAt),
        description: correctionDetails
      };
      setDataRequests(prev => [newRequest, ...prev]);

      toast({
        title: "Correction Request Submitted",
        description: "Your data correction request has been submitted. We'll review and process it within 30 days.",
      });

      setShowCorrectionDialog(false);
      setCorrectionDetails('');
    } catch (error: any) {
      console.error('Correction request error:', error);
      
      // Handle specific error cases
      if (error.message?.includes('already have') || error.message?.includes('in progress')) {
        toast({
          title: "Request Already Exists",
          description: "You already have a correction request in progress. Please wait for it to complete.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Request Failed",
          description: error.message || "There was an error submitting your correction request. Please try again.",
          variant: "destructive"
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400', icon: Clock },
      processing: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400', icon: Settings },
      completed: { color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400', icon: CheckCircle },
      failed: { color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400', icon: AlertTriangle }
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    const Icon = config.icon;

    return (
      <Badge className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      export: Download,
      deletion: Trash2,
      correction: Eye
    };
    const Icon = icons[type as keyof typeof icons];
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded">
          <Shield className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Data Privacy & Rights
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Manage your data and exercise your GDPR/CCPA rights
          </p>
        </div>
      </div>

      {/* Rights Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Your Data Rights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100">Right to Access</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Download a copy of all personal data we hold about you.
              </p>
              <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export My Data
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Export Your Data</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      We'll prepare a comprehensive export of all your personal data, including:
                    </p>
                    <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1 ml-4">
                      <li>• Profile information</li>
                      <li>• Analytics data</li>
                      <li>• Workflow configurations</li>
                      <li>• Usage history</li>
                    </ul>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setShowExportDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleDataExport} disabled={isProcessing}>
                        {isProcessing ? 'Processing...' : 'Export Data'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100">Right to Deletion</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Request deletion of your personal data (processed within 30 days).
              </p>
              <Dialog open={showDeletionDialog} onOpenChange={setShowDeletionDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/20">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Request Deletion
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request Data Deletion</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="deletion-reason">Reason for deletion</Label>
                      <Textarea
                        id="deletion-reason"
                        placeholder="Please explain why you want your data deleted..."
                        value={deletionReason}
                        onChange={(e) => setDeletionReason(e.target.value)}
                        rows={3}
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Reason required ({deletionReason.length} characters)
                      </p>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded p-3">
                      <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm font-medium">Important</span>
                      </div>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                        This action cannot be undone. All your data will be permanently deleted within 30 days.
                      </p>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setShowDeletionDialog(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleDataDeletion} 
                        disabled={isProcessing || !deletionReason.trim()}
                        variant="destructive"
                      >
                        {isProcessing ? 'Processing...' : 'Delete All Data'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100">Right to Correction</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Request correction of inaccurate or incomplete personal data.
              </p>
              <Dialog open={showCorrectionDialog} onOpenChange={setShowCorrectionDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-2" />
                    Request Correction
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request Data Correction</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="correction-details">What needs to be corrected?</Label>
                      <Textarea
                        id="correction-details"
                        placeholder="Please describe what data is inaccurate and what it should be..."
                        value={correctionDetails}
                        onChange={(e) => setCorrectionDetails(e.target.value)}
                        rows={3}
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Minimum 10 characters required ({correctionDetails.length}/10)
                      </p>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setShowCorrectionDialog(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleDataCorrection} 
                        disabled={isProcessing || !correctionDetails.trim() || correctionDetails.trim().length < 10}
                      >
                        {isProcessing ? 'Processing...' : 'Submit Request'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100">Right to Portability</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Receive your data in a structured, machine-readable format.
              </p>
              <Button variant="outline" size="sm" disabled>
                <Download className="h-4 w-4 mr-2" />
                Coming Soon
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Request History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" />
              Request History
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const loadExistingRequests = async () => {
                  if (!userId) return;
                  
                  setIsLoadingRequests(true);
                  try {
                    const response = await privacyAPI.getPrivacyRequests();
                    if (response.success && response.data.requests) {
                      const requests = response.data.requests.map((req: any) => ({
                        id: req.id || req._id,
                        type: req.type,
                        status: req.status,
                        createdAt: new Date(req.createdAt),
                        completedAt: req.completedAt ? new Date(req.completedAt) : undefined,
                        description: req.reason || req.details
                      }));
                      setDataRequests(requests);
                    }
                  } catch (error) {
                    console.error('Failed to load existing requests:', error);
                  } finally {
                    setIsLoadingRequests(false);
                  }
                };
                loadExistingRequests();
              }}
              disabled={isLoadingRequests}
            >
              <Settings className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingRequests ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Settings className="h-4 w-4 animate-spin" />
                <span>Loading requests...</span>
              </div>
            </div>
          ) : dataRequests.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-center py-8">
              No data requests yet
            </p>
          ) : (
            <div className="space-y-3">
              {dataRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded">
                      {getTypeIcon(request.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {request.type.charAt(0).toUpperCase() + request.type.slice(1)} Request
                        </span>
                        {getStatusBadge(request.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                        <span>Submitted: {request.createdAt.toLocaleDateString()}</span>
                        {request.completedAt && (
                          <span>Completed: {request.completedAt.toLocaleDateString()}</span>
                        )}
                      </div>
                      {request.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                          {request.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compliance Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Compliance Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">GDPR Compliance</h4>
                <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                  <li>• Right to access personal data</li>
                  <li>• Right to rectification</li>
                  <li>• Right to erasure ("right to be forgotten")</li>
                  <li>• Right to data portability</li>
                  <li>• Right to restrict processing</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">CCPA Compliance</h4>
                <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                  <li>• Right to know what data is collected</li>
                  <li>• Right to delete personal data</li>
                  <li>• Right to opt-out of data sales</li>
                  <li>• Right to non-discrimination</li>
                  <li>• Right to data portability</li>
                </ul>
              </div>
            </div>
            <Separator />
            <div className="text-sm text-slate-600 dark:text-slate-400">
              <p>
                <strong>Response Time:</strong> We process all data requests within 30 days as required by GDPR and CCPA.
              </p>
              <p className="mt-1">
                <strong>Contact:</strong> For urgent requests or questions, contact our Data Protection Officer at{' '}
                <a href="mailto:dpo@seentics.com" className="text-blue-600 hover:underline">
                  dpo@seentics.com
                </a>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
