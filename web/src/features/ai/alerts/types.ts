/** Anomaly alerts, as `GET /ai/alerts/:website_id` returns them. */

export type AlertType = 'traffic_drop' | 'traffic_spike' | 'tracking_outage' | 'error_surge' | 'conversion_drop';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertSensitivity = 'low' | 'normal' | 'high';
export type AlertStatus = 'open' | 'resolved';

export interface AlertView {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  summary: string;
  /** One sentence on the likely cause; `null` when nothing could be said. */
  explanation: string | null;
  explanationSource: 'ai' | 'rules' | null;
  metric: 'pageviews' | 'visitors' | 'errors' | 'conversions';
  observed: number;
  expected: number;
  changePct: number | null;
  windowStart: string;
  windowEnd: string;
  detectedAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  /** Suffix under `/websites/:id/` — `''` for the overview. */
  path: string;
  /** The question "Ask AI why" types into the composer. */
  askPrompt: string;
}

export interface AlertSettings {
  enabled: boolean;
  sensitivity: AlertSensitivity;
}

export interface AlertsResponse {
  alerts: AlertView[];
  settings: AlertSettings;
  canManage: boolean;
}

export interface AlertSettingsResponse extends AlertSettings {
  canManage: boolean;
}
