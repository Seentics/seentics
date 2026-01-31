'use client';

import React, { useState } from 'react';
import { Download, Upload, FileJson, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, Filter } from 'lucide-react';
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
  dateRange: number;
}

export const DataImportExportModal = ({ websiteId, dateRange }: DataImportExportModalProps) => {
  const [open, setOpen] = useState(false);
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
      // Fetch analytics data
      const response = await fetch(`/api/analytics/${websiteId}/export?format=${exportFormat}&days=${dateRange}`, {
        method: 'GET',
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const timestamp = new Date().toISOString().split('T')[0];
      link.download = `analytics-${websiteId}-${timestamp}.${exportFormat === 'json' ? 'json' : 'csv'}`;
      
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

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus('idle');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('websiteId', websiteId);

      const response = await fetch('/api/analytics/import', {
        method: 'POST',
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
        <Button className="h-10 px-4 bg-slate-800 backdrop-blur-md hover:bg-card transition-colors rounded shadow-sm font-bold text-xs uppercase tracking-widest gap-2">
          <Download className="h-3.5 w-3.5" />
          Import/Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] rounded-xl border border-white/5 bg-gray-900/80 backdrop-blur-xl shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold tracking-tight text-white">Import / Export Analytics</DialogTitle>
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 opacity-60 mt-2">
            Manage your analytics data
          </p>
        </DialogHeader>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(80vh-120px)] bg-gray-800/50">
          <Tabs defaultValue="export" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-white/5 rounded-lg h-10 p-1">
              <TabsTrigger value="export" className="text-xs font-bold uppercase tracking-widest gap-1.5 data-[state=active]:bg-white/10 data-[state=active]:text-white">
                <Download size={14} />
                Export
              </TabsTrigger>
              <TabsTrigger value="import" className="text-xs font-bold uppercase tracking-widest gap-1.5 data-[state=active]:bg-white/10 data-[state=active]:text-white">
                <Upload size={14} />
                Import
              </TabsTrigger>
            </TabsList>

            {/* Export Tab */}
            <TabsContent value="export" className="space-y-6 mt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 opacity-60">
                    Export Format
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* JSON Export */}
                  <button
                    onClick={() => setExportFormat('json')}
                    className={`p-4 rounded-xl border transition-all text-left ${
                      exportFormat === 'json'
                        ? 'border-primary bg-primary/10'
                        : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                        <FileJson size={16} />
                      </div>
                      <h4 className="font-bold text-sm text-white">JSON</h4>
                    </div>
                    <p className="text-xs text-slate-400">Structured format for processing</p>
                  </button>

                  {/* CSV Export */}
                  <button
                    onClick={() => setExportFormat('csv')}
                    className={`p-4 rounded-xl border transition-all text-left ${
                      exportFormat === 'csv'
                        ? 'border-primary bg-primary/10'
                        : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400">
                        <FileSpreadsheet size={16} />
                      </div>
                      <h4 className="font-bold text-sm text-white">CSV</h4>
                    </div>
                    <p className="text-xs text-slate-400">Spreadsheet compatible</p>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 opacity-60">
                    What to Export
                  </label>
                </div>

                <div className="space-y-2 p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                  <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                    <input type="checkbox" defaultChecked className="rounded border-white/10 bg-white/5 w-4 h-4 accent-primary" />
                    <span className="font-semibold text-sm text-slate-200">Page views data</span>
                  </label>
                  <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                    <input type="checkbox" defaultChecked className="rounded border-white/10 bg-white/5 w-4 h-4 accent-primary" />
                    <span className="font-semibold text-sm text-slate-200">Visitor demographics</span>
                  </label>
                  <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                    <input type="checkbox" defaultChecked className="rounded border-white/10 bg-white/5 w-4 h-4 accent-primary" />
                    <span className="font-semibold text-sm text-slate-200">Traffic sources</span>
                  </label>
                  <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                    <input type="checkbox" className="rounded border-white/10 bg-white/5 w-4 h-4 accent-primary" />
                    <span className="font-semibold text-sm text-slate-200">Custom events</span>
                  </label>
                </div>
              </div>

              {exportStatus === 'success' && (
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-green-100 text-sm">Export successful!</p>
                    <p className="text-xs text-green-400/80 mt-0.5">Your analytics data has been downloaded.</p>
                  </div>
                </div>
              )}

              {exportStatus === 'error' && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                  <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-red-100 text-sm">Export failed</p>
                    <p className="text-xs text-red-400/80 mt-0.5">Please try again or contact support.</p>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Import Tab */}
            <TabsContent value="import" className="space-y-6 mt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 opacity-60">
                    Upload File
                  </label>
                </div>

                <div className="border-2 border-dashed rounded-xl p-8 text-center hover:border-primary/50 hover:bg-white/5 transition-all cursor-pointer bg-white/[0.02] border-white/5">
                  <input
                    type="file"
                    accept=".json,.csv"
                    onChange={handleImport}
                    disabled={isImporting}
                    className="hidden"
                    id="file-import"
                  />
                  <label htmlFor="file-import" className="cursor-pointer block space-y-2">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mx-auto">
                      <Upload size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-white">Drop file or click to browse</p>
                      <p className="text-xs text-slate-400 mt-1">JSON or CSV formats</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 opacity-60">
                    Import Mode
                  </label>
                </div>

                <div className="space-y-2 p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                  <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                    <input type="radio" name="import-mode" defaultChecked className="w-4 h-4 accent-primary" />
                    <span className="font-semibold text-sm text-slate-200">Merge with existing data</span>
                  </label>
                  <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                    <input type="radio" name="import-mode" className="w-4 h-4 accent-primary" />
                    <span className="font-semibold text-sm text-slate-200">Replace existing data</span>
                  </label>
                </div>
              </div>

              {importStatus === 'success' && (
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-green-100 text-sm">Import successful!</p>
                    <p className="text-xs text-green-400/80 mt-0.5">{importMessage}</p>
                  </div>
                </div>
              )}

              {importStatus === 'error' && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                  <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-red-100 text-sm">Import failed</p>
                    <p className="text-xs text-red-400/80 mt-0.5">{importMessage || 'Check file format and try again.'}</p>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="border-t border-white/5 bg-white/[0.02] px-6 py-4 flex items-center justify-between">
          <p className="text-xs text-slate-400 font-semibold italic">
            Last {dateRange} days available
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-10 rounded-lg font-bold text-xs uppercase tracking-widest border-white/10 hover:bg-white/5 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              variant="brand"
              onClick={handleExport}
              disabled={isExporting}
              className="h-10 rounded-lg font-bold text-xs uppercase tracking-widest gap-2 shadow-lg shadow-primary/20"
            >
              {isExporting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download size={14} />
                  Download {exportFormat.toUpperCase()}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 blur-3xl -ml-16 -mb-16 rounded-full pointer-events-none" />
      </DialogContent>
    </Dialog>
  );
};
