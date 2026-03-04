'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Plus,
  Trash2,
  Loader2,
  Clock,
  Mail,
  Calendar,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';
import {
  reportsAPI,
  type ScheduledReport,
  type ReportFrequency,
  type ReportSection,
} from '@/lib/reports-api';
import { cn } from '@/lib/utils';

const FREQUENCY_OPTIONS: { value: ReportFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const DAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const SECTION_OPTIONS: { value: ReportSection; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'pages', label: 'Top Pages' },
  { value: 'sources', label: 'Traffic Sources' },
  { value: 'devices', label: 'Devices' },
  { value: 'geography', label: 'Geography' },
  { value: 'events', label: 'Events' },
];

export function ReportsSettingsComponent() {
  const params = useParams();
  const websiteId = params?.websiteId as string;

  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Create form
  const [formName, setFormName] = useState('');
  const [formFrequency, setFormFrequency] = useState<ReportFrequency>('weekly');
  const [formDayOfWeek, setFormDayOfWeek] = useState(1);
  const [formDayOfMonth, setFormDayOfMonth] = useState(1);
  const [formHour, setFormHour] = useState(9);
  const [formRecipientInput, setFormRecipientInput] = useState('');
  const [formRecipients, setFormRecipients] = useState<string[]>([]);
  const [formSections, setFormSections] = useState<ReportSection[]>(['overview', 'pages', 'sources', 'devices']);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await reportsAPI.list();
      setReports(data);
    } catch {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formName.trim()) { toast.error('Please enter a name'); return; }
    if (formRecipients.length === 0) { toast.error('Add at least one recipient'); return; }

    try {
      setCreating(true);
      const report = await reportsAPI.create({
        websiteId,
        name: formName.trim(),
        frequency: formFrequency,
        dayOfWeek: formDayOfWeek,
        dayOfMonth: formDayOfMonth,
        hourUtc: formHour,
        recipients: formRecipients,
        sections: formSections,
      });
      setReports((prev) => [report, ...prev]);
      setShowCreate(false);
      resetForm();
      toast.success('Report schedule created');
    } catch {
      toast.error('Failed to create report');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await reportsAPI.update(id, { enabled });
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
    } catch {
      toast.error('Failed to update report');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this scheduled report?')) return;
    try {
      setDeleting(id);
      await reportsAPI.remove(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      toast.success('Report deleted');
    } catch {
      toast.error('Failed to delete report');
    } finally {
      setDeleting(null);
    }
  };

  const addRecipient = () => {
    const email = formRecipientInput.trim();
    if (!email || !email.includes('@')) { toast.error('Enter a valid email'); return; }
    if (formRecipients.includes(email)) { toast.error('Already added'); return; }
    setFormRecipients((prev) => [...prev, email]);
    setFormRecipientInput('');
  };

  const removeRecipient = (email: string) => {
    setFormRecipients((prev) => prev.filter((r) => r !== email));
  };

  const toggleSection = (section: ReportSection) => {
    setFormSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const resetForm = () => {
    setFormName('');
    setFormFrequency('weekly');
    setFormDayOfWeek(1);
    setFormDayOfMonth(1);
    setFormHour(9);
    setFormRecipients([]);
    setFormRecipientInput('');
    setFormSections(['overview', 'pages', 'sources', 'devices']);
  };

  const getScheduleLabel = (report: ScheduledReport) => {
    switch (report.frequency) {
      case 'daily': return `Daily at ${report.hourUtc}:00 UTC`;
      case 'weekly': return `${DAY_OPTIONS[report.dayOfWeek]?.label || 'Monday'}s at ${report.hourUtc}:00 UTC`;
      case 'monthly': return `${report.dayOfMonth}${ordinalSuffix(report.dayOfMonth)} of each month at ${report.hourUtc}:00 UTC`;
      default: return report.frequency;
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Scheduled Reports</h3>
          <p className="text-sm text-muted-foreground">
            Receive automated analytics digests via email.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          New Report
        </Button>
      </div>

      {reports.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <h4 className="text-sm font-medium mb-1">No scheduled reports</h4>
            <p className="text-xs text-muted-foreground max-w-sm mb-4">
              Set up automated email reports to stay on top of your analytics.
            </p>
            <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Create Your First Report
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {reports.map((report) => (
            <Card key={report.id} className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
                      report.enabled ? 'bg-primary/5' : 'bg-muted/50'
                    )}>
                      <FileText className={cn('h-4 w-4', report.enabled ? 'text-primary' : 'text-muted-foreground')} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn('text-sm font-medium truncate', !report.enabled && 'text-muted-foreground')}>{report.name}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">{report.frequency}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {getScheduleLabel(report)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {report.recipients.length} recipient{report.recipients.length !== 1 ? 's' : ''}
                        </span>
                        {report.nextSend && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Next: {formatDate(report.nextSend)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={report.enabled}
                      onCheckedChange={(checked) => handleToggle(report.id, checked)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-500"
                      onClick={() => handleDelete(report.id)}
                      disabled={deleting === report.id}
                    >
                      {deleting === report.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Scheduled Report</DialogTitle>
            <DialogDescription>
              Set up an automated email digest of your analytics data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Report Name</Label>
              <Input
                placeholder="e.g. Weekly Traffic Summary"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={formFrequency} onValueChange={(v) => setFormFrequency(v as ReportFrequency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Send Time (UTC)</Label>
                <Select value={String(formHour)} onValueChange={(v) => setFormHour(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>{`${i.toString().padStart(2, '0')}:00`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formFrequency === 'weekly' && (
              <div className="space-y-2">
                <Label>Day of Week</Label>
                <Select value={String(formDayOfWeek)} onValueChange={(v) => setFormDayOfWeek(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAY_OPTIONS.map((d) => (
                      <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formFrequency === 'monthly' && (
              <div className="space-y-2">
                <Label>Day of Month</Label>
                <Select value={String(formDayOfMonth)} onValueChange={(v) => setFormDayOfMonth(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{`${i + 1}${ordinalSuffix(i + 1)}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Recipients</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={formRecipientInput}
                  onChange={(e) => setFormRecipientInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRecipient())}
                />
                <Button type="button" variant="outline" size="sm" onClick={addRecipient}>Add</Button>
              </div>
              {formRecipients.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {formRecipients.map((email) => (
                    <span key={email} className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs">
                      {email}
                      <button type="button" onClick={() => removeRecipient(email)} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Report Sections</Label>
              <div className="flex flex-wrap gap-2">
                {SECTION_OPTIONS.map((section) => (
                  <button
                    key={section.value}
                    type="button"
                    onClick={() => toggleSection(section.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                      formSections.includes(section.value)
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    )}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !formName.trim() || formRecipients.length === 0} className="gap-1.5">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              Create Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
