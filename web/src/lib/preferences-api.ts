import api from '@/lib/api';

export interface UserPreferences {
  background: string;
  card: string;
  primary: string;
  radius: string;
  fontFamily: string;
  fontSize: string;
  density: string;
  dashboardTitle: string;
  logoUrl: string;
  layoutMode: string;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  background: '',
  card: '',
  primary: '',
  radius: '',
  fontFamily: '',
  fontSize: 'medium',
  density: 'comfortable',
  dashboardTitle: '',
  logoUrl: '',
  layoutMode: 'sidebar',
};

export async function getPreferences(): Promise<UserPreferences> {
  const response = await api.get('/user/users/preferences');
  return { ...DEFAULT_PREFERENCES, ...(response.data?.data ?? {}) };
}

export async function updatePreferences(prefs: Partial<UserPreferences>): Promise<void> {
  await api.put('/user/users/preferences', prefs);
}
