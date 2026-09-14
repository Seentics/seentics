/** Domain types for the reports feature. */



export type ReportFrequency = 'daily' | 'weekly' | 'monthly';

export type ReportSection = 'overview' | 'pages' | 'sources' | 'devices' | 'geography' | 'events';

export interface ScheduledReport {
  id: string;
  userId: string;
  websiteId: string;
  name: string;
  frequency: ReportFrequency;
  dayOfWeek: number;
  dayOfMonth: number;
  hourUtc: number;
  recipients: string[];
  sections: ReportSection[];
  enabled: boolean;
  lastSent?: string;
  nextSend?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReportRequest {
  websiteId: string;
  name: string;
  frequency?: ReportFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  hourUtc?: number;
  recipients: string[];
  sections?: ReportSection[];
}
