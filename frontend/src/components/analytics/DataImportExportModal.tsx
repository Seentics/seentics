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
      
      <DialogContent className="sm:max-w-[700px] rounded-2xl border border-border/40 bg-card/90 backdrop-blur-2xl shadow-2xl p-0 overflow-hidden outline-none">
        <div className="flex flex-col h-[600px]">
          {/* Header */}
          <DialogHeader className="p-6 pb-4 border-b border-border/40 bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Download className="h-5 w-5 text-primary" />
                  </div>
                  Data Management
                </DialogTitle>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 mt-2">
                  Import or export your analytics data
                </p>
              </div>
              {/* <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setOpen(false)}
                className="rounded-full hover:bg-muted text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </Button> */}
            </div>
          </DialogHeader>

          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar Tabs */}
            <div className="w-48 border-r border-border/40 bg-muted/20 p-2 space-y-1">
              <button
                onClick={() => setActiveTab('export')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                  activeTab === 'export' ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Download size={14} className={activeTab === 'export' ? "text-primary-foreground" : "text-primary"} />
                Export
              </button>
              <button
                onClick={() => setActiveTab('import')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                  activeTab === 'import' ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Upload size={14} className={activeTab === 'import' ? "text-primary-foreground" : "text-primary"} />
                Import
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-background/30">
              {activeTab === 'export' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 opacity-60">Export Format</label>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setExportFormat('json')}
                        className={`p-4 rounded-xl border transition-all text-left ${
                          exportFormat === 'json'
                            ? 'border-primary bg-primary/10'
                            : 'border-border/40 bg-card hover:border-border/80 hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                            <FileJson size={16} />
                          </div>
                          <h4 className="font-bold text-sm text-foreground">JSON</h4>
                        </div>
                        <p className="text-xs text-muted-foreground">Structured format</p>
                      </button>

                      <button
                        onClick={() => setExportFormat('csv')}
                        className={`p-4 rounded-xl border transition-all text-left ${
                          exportFormat === 'csv'
                            ? 'border-primary bg-primary/10'
                            : 'border-border/40 bg-card hover:border-border/80 hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
                            <FileSpreadsheet size={16} />
                          </div>
                          <h4 className="font-bold text-sm text-foreground">CSV</h4>
                        </div>
                        <p className="text-xs text-muted-foreground">Excel friendly</p>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 opacity-60">Include Data</label>
                    </div>
                    <div className="space-y-2 p-4 rounded-xl border border-border/40 bg-muted/20">
                      {['Page views', 'Visitor demographics', 'Traffic sources', 'Custom events'].map((item) => (
                        <label key={item} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 cursor-pointer transition-colors group">
                          <div className="w-4 h-4 rounded border border-border/60 flex items-center justify-center group-hover:border-primary transition-colors">
                              <div className="w-2 h-2 rounded-sm bg-primary" />
                          </div>
                          <span className="font-semibold text-xs text-foreground/80">{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {exportStatus === 'success' && (
                    <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-start gap-3 animate-in slide-in-from-top-2">
                      <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
                      <div>
                        <p className="font-bold text-green-600 dark:text-green-400 text-xs">Export successful!</p>
                        <p className="text-[10px] text-green-600/70 dark:text-green-400/70 mt-0.5">Your data has been downloaded.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'import' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 opacity-60">Select Source</label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {['seentics', 'ga4', 'plausible', 'umami', 'fathom'].map((src) => (
                        <button
                          key={src}
                          onClick={() => setImportSource(src as any)}
                          className={`px-3 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all ${
                            importSource === src
                              ? 'bg-primary/20 border-primary text-primary shadow-lg shadow-primary/5'
                              : 'bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {src}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 opacity-60">Upload Data</label>
                    </div>
                    
                    <div className="border-2 border-dashed rounded-2xl p-8 text-center bg-muted/20 border-border/40 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer relative group">
                        <input
                          type="file"
                          accept=".json,.csv"
                          onChange={handleImport}
                          disabled={isImporting}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <div className="space-y-3">
                          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto group-hover:scale-110 transition-transform">
                            {isImporting ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-foreground">
                              {isImporting ? 'Uploading...' : 'Click to upload file'}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-medium mt-1">
                              Supports JSON and CSV
                            </p>
                          </div>
                        </div>
                    </div>
                  </div>

                  {importStatus === 'success' && (
                    <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-start gap-3 animate-in slide-in-from-top-2">
                      <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
                      <div>
                        <p className="font-bold text-green-600 dark:text-green-400 text-xs">Import Successful!</p>
                        <p className="text-[10px] text-green-600/70 dark:text-green-400/70 mt-0.5">{importMessage}</p>
                      </div>
                    </div>
                  )}

                  {importStatus === 'error' && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 animate-in slide-in-from-top-2">
                      <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
                      <div>
                        <p className="font-bold text-red-600 dark:text-red-400 text-xs">Import Failed</p>
                        <p className="text-[10px] text-red-600/70 dark:text-red-400/70 mt-0.5">{importMessage}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-border/40 bg-muted/20 flex items-center justify-between">
            <p className="text-[10px] font-bold text-muted-foreground opacity-60 uppercase tracking-widest italic">
              Website: {websiteId}
            </p>
            
            <div className="flex items-center gap-3">
               {activeTab === 'export' ? (
                 <Button 
                     onClick={handleExport}
                     disabled={isExporting}
                     className="h-10 px-8 rounded-xl bg-primary text-primary-foreground font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                 >
                    {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    Download Data
                 </Button>
               ) : (
                 <label htmlFor="file-import-footer">
                    <Button 
                        asChild
                        disabled={isImporting}
                        className="h-10 px-8 rounded-xl bg-primary text-primary-foreground font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <span>
                        {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                        Select File to Import
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
