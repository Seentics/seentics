'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileText, FileSpreadsheet, Code } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EnhancedDataExportProps {
  websiteId: string;
  dateRange: number;
  filters?: any;
}

export function EnhancedDataExport({ websiteId, dateRange, filters }: EnhancedDataExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async (format: 'csv' | 'json' | 'excel') => {
    setIsExporting(true);

    try {
      // Simulate export API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      toast({
        title: 'Export Started',
        description: `Your ${format.toUpperCase()} export will download shortly.`,
      });

      // In production, trigger actual file download here
      // const response = await api.get(`/analytics/export/${websiteId}?format=${format}&days=${dateRange}`)
      // downloadFile(response.data)

    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'There was an error exporting your data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 h-10 font-bold text-xs uppercase tracking-wider"
          disabled={isExporting}
        >
          <Download className="h-4 w-4" />
          {isExporting ? 'Exporting...' : 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wider">
          Export Format
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={() => handleExport('csv')} disabled={isExporting}>
          <FileText className="h-4 w-4 mr-2" />
          CSV File
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => handleExport('excel')} disabled={isExporting}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel (.xlsx)
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => handleExport('json')} disabled={isExporting}>
          <Code className="h-4 w-4 mr-2" />
          JSON Data
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <div className="px-2 py-1.5">
          <p className="text-xs text-muted-foreground">
            Includes data for last {dateRange} days
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
