'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserPreferences, DEFAULT_PREFERENCES, getPreferences, updatePreferences } from '@/lib/preferences-api';
import { useAuth } from '@/stores/useAuthStore';
import { useLayoutStore, LayoutMode } from '@/stores/useLayoutStore';

interface ThemeCustomizationContextValue {
  preferences: UserPreferences;
  isLoading: boolean;
  savePreferences: (partial: Partial<UserPreferences>) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

const ThemeCustomizationContext = createContext<ThemeCustomizationContextValue>({
  preferences: DEFAULT_PREFERENCES,
  isLoading: false,
  savePreferences: async () => {},
  resetToDefaults: async () => {},
});

export function useThemeCustomization() {
  return useContext(ThemeCustomizationContext);
}

function applyTheme(prefs: UserPreferences) {
  const root = document.documentElement;

  if (prefs.background) root.style.setProperty('--background', prefs.background);
  else root.style.removeProperty('--background');

  if (prefs.card) root.style.setProperty('--card', prefs.card);
  else root.style.removeProperty('--card');

  if (prefs.primary) {
    root.style.setProperty('--primary', prefs.primary);
    root.style.setProperty('--ring', prefs.primary);
    root.style.setProperty('--sidebar-primary', prefs.primary);
  } else {
    root.style.removeProperty('--primary');
    root.style.removeProperty('--ring');
    root.style.removeProperty('--sidebar-primary');
  }

  if (prefs.radius) root.style.setProperty('--radius', `${prefs.radius}rem`);
  else root.style.removeProperty('--radius');

  if (prefs.fontFamily) {
    root.style.setProperty('font-family', prefs.fontFamily);
    root.style.setProperty('--font-body', prefs.fontFamily);
  } else {
    root.style.removeProperty('font-family');
    root.style.removeProperty('--font-body');
  }

  const fontSizeMap: Record<string, string> = {
    small: '14px',
    medium: '16px',
    large: '18px',
  };
  if (prefs.fontSize && fontSizeMap[prefs.fontSize]) {
    root.style.setProperty('font-size', fontSizeMap[prefs.fontSize]);
  } else {
    root.style.removeProperty('font-size');
  }

  if (prefs.density) {
    root.setAttribute('data-density', prefs.density);
  } else {
    root.removeAttribute('data-density');
  }
}

function clearTheme() {
  const root = document.documentElement;
  ['--background', '--card', '--primary', '--ring', '--sidebar-primary', '--radius',
    'font-family', '--font-body', 'font-size'].forEach(prop => root.style.removeProperty(prop));
  root.removeAttribute('data-density');
}

export function ThemeCustomizationProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const setLayoutMode = useLayoutStore((s) => s.setLayoutMode);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    getPreferences()
      .then(prefs => {
        setPreferences(prefs);
        applyTheme(prefs);
        if (prefs.layoutMode && ['sidebar', 'dock', 'header', 'floating-header'].includes(prefs.layoutMode)) {
          setLayoutMode(prefs.layoutMode as LayoutMode);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [isAuthenticated]);

  const savePreferences = useCallback(async (partial: Partial<UserPreferences>) => {
    const merged = { ...preferences, ...partial };
    await updatePreferences(merged);
    setPreferences(merged);
    applyTheme(merged);
  }, [preferences]);

  const resetToDefaults = useCallback(async () => {
    await updatePreferences(DEFAULT_PREFERENCES);
    setPreferences(DEFAULT_PREFERENCES);
    clearTheme();
    setLayoutMode('sidebar');
  }, []);

  return (
    <ThemeCustomizationContext.Provider value={{ preferences, isLoading, savePreferences, resetToDefaults }}>
      {children}
    </ThemeCustomizationContext.Provider>
  );
}
