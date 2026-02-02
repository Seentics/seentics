'use client';

import React, { useState, useEffect } from 'react';
import { 
    Bookmark, 
    Save, 
    Trash2, 
    ChevronDown, 
    Check, 
    Loader2,
    Calendar,
    Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';

interface SavedReport {
    id: string;
    name: string;
    filters: any;
}

interface SavedReportManagerProps {
    websiteId: string;
    currentFilters: any;
    onApplyReport: (filters: any) => void;
}

export function SavedReportManager({ 
    websiteId, 
    currentFilters, 
    onApplyReport 
}: SavedReportManagerProps) {
    const [reports, setReports] = useState<SavedReport[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [newReportName, setNewReportName] = useState('');
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (websiteId && websiteId !== 'demo') {
            fetchReports();
        }
    }, [websiteId]);

    const fetchReports = async () => {
        try {
            setIsLoading(true);
            const response = await api.get(`/user/websites/${websiteId}/reports`);
            setReports(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch reports:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveReport = async () => {
        if (!newReportName.trim()) {
            toast({
                title: "Error",
                description: "Report name is required",
                variant: "destructive"
            });
            return;
        }

        try {
            setIsSaving(true);
            const response = await api.post(`/user/websites/${websiteId}/reports`, {
                name: newReportName.trim(),
                filters: currentFilters
            });

            setReports([response.data, ...reports]);
            setIsSaveModalOpen(false);
            setNewReportName('');
            toast({
                title: "Report saved",
                description: "Your report configuration has been saved successfully.",
            });
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.response?.data?.error || "Failed to save report",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteReport = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try {
            await api.delete(`/user/websites/${websiteId}/reports/${id}`);
            setReports(reports.filter(r => r.id !== id));
            toast({
                title: "Report deleted",
                description: "The saved report has been removed.",
            });
        } catch (error: any) {
            toast({
                title: "Error",
                description: "Failed to delete report",
                variant: "destructive"
            });
        }
    };

    if (websiteId === 'demo') return null;

    return (
        <div className="flex items-center gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-9 gap-2 border-border/40 font-bold bg-accent/5 hover:bg-accent/10"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Bookmark className="h-4 w-4 text-primary" />
                        )}
                        <span className="hidden sm:inline">Saved Reports</span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[280px] p-1 shadow-2xl border-border/40">
                    <DropdownMenuLabel className="flex items-center justify-between px-3 py-2">
                        <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">My Reports</span>
                        <Badge variant="secondary" className="text-[9px] font-bold px-1.5 h-4">{reports.length}</Badge>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-border/40" />
                    <div className="max-h-[300px] overflow-y-auto">
                        {reports.length === 0 ? (
                            <div className="px-3 py-6 text-center">
                                <Bookmark className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                                <p className="text-[11px] text-muted-foreground font-medium">No saved reports yet.</p>
                            </div>
                        ) : (
                            reports.map((report) => (
                                <DropdownMenuItem 
                                    key={report.id}
                                    onClick={() => onApplyReport(report.filters)}
                                    className="flex items-center justify-between group cursor-pointer py-2.5 px-3 focus:bg-primary/5 rounded"
                                >
                                    <div className="flex flex-col gap-0.5 truncate mr-2">
                                        <span className="text-sm font-bold truncate group-hover:text-primary transition-colors">{report.name}</span>
                                        <div className="flex items-center gap-2 opacity-50">
                                            <div className="flex items-center gap-1 text-[9px] font-medium">
                                                <Filter className="h-2.5 w-2.5" />
                                                {Object.keys(report.filters || {}).length} filters
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 transition-all"
                                        onClick={(e) => handleDeleteReport(e, report.id)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </DropdownMenuItem>
                            ))
                        )}
                    </div>
                    <DropdownMenuSeparator className="bg-border/40" />
                    <div className="p-1">
                        <Dialog open={isSaveModalOpen} onOpenChange={setIsSaveModalOpen}>
                            <DialogTrigger asChild>
                                <Button 
                                    variant="ghost" 
                                    className="w-full justify-start gap-2 h-9 text-xs font-bold hover:bg-primary/10 hover:text-primary"
                                >
                                    <Save className="h-4 w-4" />
                                    Save Current Filters
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle className="font-black text-xl tracking-tight">Save Current Report</DialogTitle>
                                    <DialogDescription className="font-medium text-slate-500">
                                        Save the current filter configuration as a reusable report.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-6">
                                    <div className="space-y-2">
                                        <label htmlFor="name" className="text-sm font-bold text-slate-700">Report Name</label>
                                        <Input
                                            id="name"
                                            placeholder="e.g., UK Chrome Stakeholders"
                                            value={newReportName}
                                            onChange={(e) => setNewReportName(e.target.value)}
                                            className="h-11 font-medium bg-slate-50 border-slate-200 focus:ring-primary/20"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded border border-slate-200">
                                        <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 mb-3">Filters being saved:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {Object.entries(currentFilters).map(([key, value]) => (
                                                value !== 'all' && (
                                                    <Badge key={key} variant="outline" className="bg-white border-slate-200 text-xs py-1 px-2.5">
                                                        <span className="text-slate-400 mr-1 capitalize">{key}:</span>
                                                        <span className="font-bold text-slate-900 capitalize">{String(value)}</span>
                                                    </Badge>
                                                )
                                            ))}
                                            {Object.values(currentFilters).every(v => v === 'all') && (
                                                <p className="text-xs font-medium text-slate-400 italic">No specific filters applied (Global Dashboard)</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsSaveModalOpen(false)} disabled={isSaving}>Cancel</Button>
                                    <Button 
                                        onClick={handleSaveReport} 
                                        disabled={isSaving}
                                        className="font-bold shadow-lg shadow-primary/20"
                                    >
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Saving...
                                            </>
                                        ) : "Save Report"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
