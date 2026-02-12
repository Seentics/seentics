'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Cookie, 
  Settings, 
  Info, 
  Shield, 
  BarChart3, 
  Target, 
  X,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
}

interface CookieConsentManagerProps {
  onConsentChange?: (preferences: CookiePreferences) => void;
  showBanner?: boolean;
}

const COOKIE_CATEGORIES = {
  essential: {
    title: 'Essential Cookies',
    description: 'Required for basic website functionality. Cannot be disabled.',
    icon: Shield,
    color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    examples: ['Authentication', 'Security', 'Session management']
  },
  analytics: {
    title: 'Analytics Cookies',
    description: 'Help us understand how visitors interact with our website.',
    icon: BarChart3,
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    examples: ['Page views', 'User behavior', 'Performance metrics']
  },
  marketing: {
    title: 'Marketing Cookies',
    description: 'Used to deliver personalized advertisements and track campaign performance.',
    icon: Target,
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
    examples: ['Ad targeting', 'Campaign tracking', 'Social media pixels']
  },
  preferences: {
    title: 'Preference Cookies',
    description: 'Remember your settings and preferences for a better experience.',
    icon: Settings,
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
    examples: ['Language settings', 'Theme preferences', 'Form data']
  }
};

export default function CookieConsentManager({ 
  onConsentChange, 
  showBanner = true 
}: CookieConsentManagerProps) {
  const [showConsentBanner, setShowConsentBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    analytics: false,
    marketing: false,
    preferences: false
  });

  useEffect(() => {
    // Check if user has already given consent
    const savedConsent = localStorage.getItem('seentics_cookie_consent');
    if (!savedConsent && showBanner) {
      setShowConsentBanner(true);
    } else if (savedConsent) {
      const parsed = JSON.parse(savedConsent);
      setPreferences(parsed);
    }
  }, [showBanner]);

  const handleConsentChange = (category: keyof CookiePreferences, value: boolean) => {
    const newPreferences = { ...preferences, [category]: value };
    setPreferences(newPreferences);
    
    // Essential cookies cannot be disabled
    if (category === 'essential') {
      newPreferences.essential = true;
    }
    
    localStorage.setItem('seentics_cookie_consent', JSON.stringify(newPreferences));
    onConsentChange?.(newPreferences);
  };

  const acceptAll = () => {
    const allAccepted = {
      essential: true,
      analytics: true,
      marketing: true,
      preferences: true
    };
    setPreferences(allAccepted);
    localStorage.setItem('seentics_cookie_consent', JSON.stringify(allAccepted));
    setShowConsentBanner(false);
    onConsentChange?.(allAccepted);
  };

  const acceptSelected = () => {
    localStorage.setItem('seentics_cookie_consent', JSON.stringify(preferences));
    setShowConsentBanner(false);
    onConsentChange?.(preferences);
  };

  const rejectAll = () => {
    const minimal = {
      essential: true,
      analytics: false,
      marketing: false,
      preferences: false
    };
    setPreferences(minimal);
    localStorage.setItem('seentics_cookie_consent', JSON.stringify(minimal));
    setShowConsentBanner(false);
    onConsentChange?.(minimal);
  };

  const openSettings = () => {
    setShowSettings(true);
  };

  const closeSettings = () => {
    setShowSettings(false);
  };

  // Don't render if consent banner is not needed
  if (!showConsentBanner && !showSettings) {
    return null;
  }

  return (
    <>
      {/* Cookie Consent Banner */}
      {showConsentBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shadow-lg">
          <div className="container mx-auto px-4 py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Cookie className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    We use cookies to enhance your experience
                  </h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  We use cookies and similar technologies to provide, protect, and improve our services. 
                  By clicking "Accept All", you consent to our use of cookies for analytics and marketing purposes.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openSettings}
                  className="w-full sm:w-auto"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Customize
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={rejectAll}
                  className="w-full sm:w-auto"
                >
                  Reject All
                </Button>
                <Button
                  size="sm"
                  onClick={acceptAll}
                  className="w-full sm:w-auto"
                >
                  Accept All
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cookie Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cookie className="h-5 w-5 text-blue-600" />
              Cookie Preferences
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              <p>
                Manage your cookie preferences below. Essential cookies are required for the website to function properly.
              </p>
            </div>

            {Object.entries(COOKIE_CATEGORIES).map(([key, category]) => {
              const Icon = category.icon;
              const isEssential = key === 'essential';
              
              return (
                <Card key={key} className="border-slate-200 dark:border-slate-700">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded ${category.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {category.title}
                            {isEssential && (
                              <Badge variant="secondary" className="text-xs">
                                Required
                              </Badge>
                            )}
                          </CardTitle>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            {category.description}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`cookie-${key}`}
                          checked={preferences[key as keyof CookiePreferences]}
                          onCheckedChange={(checked) => 
                            handleConsentChange(key as keyof CookiePreferences, checked)
                          }
                          disabled={isEssential}
                        />
                        <Label htmlFor={`cookie-${key}`} className="sr-only">
                          Enable {category.title}
                        </Label>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Examples:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {category.examples.map((example, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {example}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            <Separator />

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <Button variant="outline" onClick={rejectAll}>
                Reject All
              </Button>
              <Button onClick={acceptSelected}>
                Save Preferences
              </Button>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
              <p>
                You can change these settings at any time by clicking the cookie icon in the footer.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
