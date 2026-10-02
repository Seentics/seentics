/** Domain types for the privacy feature. */




export interface WebsitePrivacySettings {
  ipAnonymization: 'none' | 'partial' | 'full';
  respectDnt: boolean;
  consentMode: 'cookieless' | 'strict' | 'none';
  dataRetentionDays: number | null;
}


export interface ImportResult {
  events: number;
  sessions: number;
  goals: number;
  funnels: number;
}
