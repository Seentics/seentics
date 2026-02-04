'use client';

import React, { useState } from 'react';
import { Download, Upload, FileJson, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DataImportExportModalProps {
  websiteId: string;
  websiteName?: string;
  dateRange: number;
}

export const DataImportExportModal = ({ websiteId, websiteName, dateRange }: DataImportExportModalProps) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');

  const handleExport = async () => {
    setIsExporting(true);
    setExportStatus('idle');

    try {
      // Fetch analytics data from the correct v1 API
      const response = await fetch(`/api/v1/analytics/export/${websiteId}?format=${exportFormat}&days=${dateRange}`, {
        method: 'GET',
        headers: {
            // Need authorization header here if using fetch directly
            // Better to use our 'api' axios instance or pass the token
            'Authorization': `Bearer ${localStorage.getItem('auth-storage') ? JSON.parse(localStorage.getItem('auth-storage')!).state.access_token : ''}`
        }
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const timestamp = new Date().toISOString().split('T')[0];
      const safeName = (websiteName || websiteId).toLowerCase().replace(/[^a-z0-9]/g, '-');
      link.download = `analytics-${safeName}-${timestamp}.${exportFormat === 'json' ? 'json' : 'csv'}`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 3000);
    } catch (error) {
      console.error('Export error:', error);
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const [importSource, setImportSource] = useState<'seentics' | 'ga4' | 'plausible' | 'umami' | 'fathom'>('seentics');

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus('idle');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('websiteId', websiteId);
      formData.append('source', importSource);

      const response = await fetch('/api/v1/analytics/import', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth-storage') ? JSON.parse(localStorage.getItem('auth-storage')!).state.access_token : ''}`
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Import failed');
      }

      const result = await response.json();
      setImportMessage(`Successfully imported ${result.count || 0} records`);
      setImportStatus('success');
      setTimeout(() => setImportStatus('idle'), 3000);
    } catch (error) {
      console.error('Import error:', error);
      setImportMessage(error instanceof Error ? error.message : 'Import failed');
      setImportStatus('error');
      setTimeout(() => setImportStatus('idle'), 3000);
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-10 px-4 bg-card/50 backdrop-blur-md hover:bg-card transition-all rounded shadow-sm font-bold text-xs uppercase tracking-widest gap-2 text-foreground border border-border/50 active:scale-95">
          <Download className="h-3.5 w-3.5 text-primary" />
          Import/Export
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[650px] rounded-3xl border border-border/10 bg-background shadow-2xl p-0 overflow-hidden outline-none">
        <div className="flex flex-col h-[520px]">
          {/* Header */}
          <DialogHeader className="p-6 pb-4 border-b border-border/10 bg-muted/5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <DialogTitle className="text-xl font-black tracking-tight text-foreground">
                  Data Management
                </DialogTitle>
                <p className="text-xs font-medium text-muted-foreground">
                  Import or export your analytics data
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar Tabs */}
            <div className="w-44 border-r border-border/10 bg-muted/20 p-3 space-y-1">
              <button
                onClick={() => setActiveTab('export')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                  activeTab === 'export' 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <Download size={14} />
                Export Data
              </button>
              <button
                onClick={() => setActiveTab('import')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                  activeTab === 'import' 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <Upload size={14} />
                Import Data
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'export' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Export Format</label>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setExportFormat('json')}
                        className={`p-4 rounded-2xl border transition-all duration-300 text-left relative overflow-hidden group ${
                          exportFormat === 'json'
                            ? 'border-primary bg-primary/10 ring-1 ring-primary/50'
                            : 'border-border/10 bg-background hover:border-border/30 hover:bg-muted/30 shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-2 relative z-10">
                          <div className={`h-8 w-8 rounded-xl flex items-center justify-center transition-colors ${
                              exportFormat === 'json' ? 'bg-primary text-white' : 'bg-blue-500/10 text-blue-500'
                          }`}>
                            <FileJson size={18} />
                          </div>
                          <h4 className="font-extrabold text-sm">JSON</h4>
                        </div>
                        <p className="text-[11px] text-muted-foreground font-medium relative z-10">Optimized for developers and API integrations.</p>
                      </button>

                      <button
                        onClick={() => setExportFormat('csv')}
                        className={`p-4 rounded-2xl border transition-all duration-300 text-left relative overflow-hidden group ${
                          exportFormat === 'csv'
                            ? 'border-primary bg-primary/10 ring-1 ring-primary/50'
                            : 'border-border/10 bg-background hover:border-border/30 hover:bg-muted/30 shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-2 relative z-10">
                          <div className={`h-8 w-8 rounded-xl flex items-center justify-center transition-colors ${
                              exportFormat === 'csv' ? 'bg-primary text-white' : 'bg-green-500/10 text-green-500'
                          }`}>
                            <FileSpreadsheet size={18} />
                          </div>
                          <h4 className="font-extrabold text-sm">CSV</h4>
                        </div>
                        <p className="text-[11px] text-muted-foreground font-medium relative z-10">Easy analysis in Excel or Google Sheets.</p>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Data Scope</label>
                    <div className="grid grid-cols-1 gap-2 p-1 rounded-2xl border border-border/10 bg-muted/5">
                      {['Page views & Visitors', 'Traffic Sources & Referrals', 'Technology & Devices', 'Custom Event Data'].map((item) => (
                        <div key={item} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/20 transition-all group">
                          <div className="w-5 h-5 rounded-lg border-2 border-primary/20 flex items-center justify-center group-hover:border-primary transition-colors bg-background">
                              <div className="w-2.5 h-2.5 rounded-sm bg-primary scale-0 group-hover:scale-100 transition-transform" />
                          </div>
                          <span className="font-bold text-sm text-foreground/80">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {exportStatus === 'success' && (
                    <div className="p-4 rounded-2xl bg-green-500/5 border border-green-500/20 flex items-center gap-4 animate-in slide-in-from-top-2">
                      <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 shrink-0">
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <p className="font-black text-green-600 dark:text-green-400 text-sm">Download Ready</p>
                        <p className="text-xs text-green-600/70 dark:text-green-400/70 font-medium">Your analytics report has been generated.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'import' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Select Source</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['seentics', 'ga4', 'plausible', 'umami', 'fathom'].map((src) => (
                        <button
                          key={src}
                          onClick={() => setImportSource(src as any)}
                          className={`px-4 py-3 rounded-xl border text-xs font-black uppercase tracking-widest transition-all duration-200 shadow-sm ${
                            importSource === src
                              ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[1.02]'
                              : 'bg-background border-border/10 text-muted-foreground hover:bg-muted/40 hover:border-border/30'
                          }`}
                        >
                          {src}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Upload Archive</label>
                    
                    <div className="border-2 border-dashed rounded-3xl p-8 text-center bg-muted/10 border-border/20 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer relative group">
                        <input
                          type="file"
                          accept=".json,.csv"
                          onChange={handleImport}
                          disabled={isImporting}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <div className="space-y-3">
                          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto group-hover:scale-110 transition-transform duration-300">
                            {isImporting ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
                          </div>
                          <div>
                            <p className="font-black text-base text-foreground">
                              {isImporting ? 'Processing Data...' : 'Drop file here'}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-medium mt-1">
                              Support for JSON and CSV exports
                            </p>
                          </div>
                        </div>
                    </div>
                  </div>

                  {importStatus === 'success' && (
                    <div className="p-4 rounded-2xl bg-green-500/5 border border-green-500/20 flex items-center gap-4 animate-in slide-in-from-top-2">
                      <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 shrink-0">
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <p className="font-black text-green-600 dark:text-green-400 text-sm">Import Complete</p>
                        <p className="text-xs text-green-600/70 dark:text-green-400/70 font-medium">{importMessage}</p>
                      </div>
                    </div>
                  )}

                  {importStatus === 'error' && (
                    <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20 flex items-center gap-4 animate-in slide-in-from-top-2">
                      <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 shrink-0">
                        <AlertCircle size={20} />
                      </div>
                      <div>
                        <p className="font-black text-red-600 dark:text-red-400 text-sm">Transfer Failed</p>
                        <p className="text-xs text-red-600/70 dark:text-red-400/70 font-medium">{importMessage}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border/10 bg-muted/5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Active Instance</span>
              <span className="text-xs font-bold text-foreground/60">{websiteName || websiteId}</span>
            </div>
            
            <div className="flex items-center gap-3">
               {activeTab === 'export' ? (
                 <Button 
                     onClick={handleExport}
                     disabled={isExporting}
                     className="h-10 px-8 rounded-xl bg-primary text-primary-foreground font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3"
                 >
                    {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    Generate Report
                 </Button>
               ) : (
                 <label htmlFor="file-import-footer">
                    <Button 
                        asChild
                        disabled={isImporting}
                        className="h-10 px-8 rounded-xl bg-primary text-primary-foreground font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 cursor-pointer"
                    >
                      <span>
                        {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        Select Source File
                      </span>
                    </Button>
                    <input
                      id="file-import-footer"
                      type="file"
                      accept=".json,.csv"
                      onChange={handleImport}
                      disabled={isImporting}
                      className="hidden"
                    />
                 </label>
               )}
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[120px] -mr-32 -mt-32 rounded-full pointer-events-none animate-pulse" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/10 blur-[120px] -ml-32 -mb-32 rounded-full pointer-events-none animate-pulse" />
      </DialogContent>
    </Dialog>
  );
};
