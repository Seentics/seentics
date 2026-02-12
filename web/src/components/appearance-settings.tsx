'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { 
  Palette, 
  Bell, 
  Eye, 
  Save, 
  Monitor, 
  Sun, 
  Moon, 
  Smartphone,
  Tablet,
  Zap,
  Sparkles,
  Settings,
  RefreshCw,
  CheckCircle
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

interface DisplaySettings {
  compactMode: boolean;
  showAnimations: boolean;
  autoSave: boolean;
  showTooltips: boolean;
  showNotifications: boolean;
  sidebarCollapsed: boolean;
  density: 'comfortable' | 'compact' | 'spacious';
  fontSize: 'small' | 'medium' | 'large';
}

interface NotificationSettings {
  email: boolean;
  push: boolean;
  marketing: boolean;
  updates: boolean;
  security: boolean;
  billing: boolean;
  workflow: boolean;
  analytics: boolean;
}

export function AppearanceSettings() {
  const { toast } = useToast();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>({
    compactMode: false,
    showAnimations: true,
    autoSave: true,
    showTooltips: true,
    showNotifications: true,
    sidebarCollapsed: false,
    density: 'comfortable',
    fontSize: 'medium',
  });

  const [notifications, setNotifications] = useState<NotificationSettings>({
    email: true,
    push: false,
    marketing: false,
    updates: true,
    security: true,
    billing: true,
    workflow: true,
    analytics: false,
  });

  const [customization, setCustomization] = useState({
    accentColor: 'blue',
    borderRadius: 6,
    shadowIntensity: 2,
    animationSpeed: 1,
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const savedDisplaySettings = localStorage.getItem('display-settings');
    const savedNotificationSettings = localStorage.getItem('notification-settings');
    const savedCustomization = localStorage.getItem('customization-settings');

    if (savedDisplaySettings) {
      setDisplaySettings(JSON.parse(savedDisplaySettings));
    }
    if (savedNotificationSettings) {
      setNotifications(JSON.parse(savedNotificationSettings));
    }
    if (savedCustomization) {
      setCustomization(JSON.parse(savedCustomization));
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('display-settings', JSON.stringify(displaySettings));
    }
  }, [displaySettings, mounted]);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('notification-settings', JSON.stringify(notifications));
    }
  }, [notifications, mounted]);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('customization-settings', JSON.stringify(customization));
    }
  }, [customization, mounted]);

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    toast({
      title: "Theme Updated",
      description: `Theme changed to ${newTheme} mode.`,
    });
  };

  const handleDisplayChange = (key: keyof DisplaySettings, value: any) => {
    setDisplaySettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleNotificationChange = (key: keyof NotificationSettings) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleCustomizationChange = (key: keyof typeof customization, value: any) => {
    setCustomization(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const resetToDefaults = () => {
    setDisplaySettings({
      compactMode: false,
      showAnimations: true,
      autoSave: true,
      showTooltips: true,
      showNotifications: true,
      sidebarCollapsed: false,
      density: 'comfortable',
      fontSize: 'medium',
    });
    
    setNotifications({
      email: true,
      push: false,
      marketing: false,
      updates: true,
      security: true,
      billing: true,
      workflow: true,
      analytics: false,
    });

    setCustomization({
      accentColor: 'blue',
      borderRadius: 6,
      shadowIntensity: 2,
      animationSpeed: 1,
    });

    toast({
      title: "Settings Reset",
      description: "All settings have been reset to defaults.",
    });
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Theme & Appearance
          </CardTitle>
          <CardDescription>
            Customize the look and feel of your workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label>Theme</Label>
              <div className="grid grid-cols-3 gap-4 mt-2">
                {(['light', 'dark', 'system'] as const).map((themeOption) => (
                  <Button
                    key={themeOption}
                    variant={theme === themeOption ? "default" : "outline"}
                    className="h-20 flex flex-col items-center justify-center gap-2"
                    onClick={() => handleThemeChange(themeOption)}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded border-2",
                      themeOption === 'light' && "bg-white border-gray-300",
                      themeOption === 'dark' && "bg-gray-900 border-gray-600",
                      themeOption === 'system' && "bg-gradient-to-r from-white to-gray-900 border-gray-300"
                    )} />
                    <span className="text-xs capitalize">{themeOption}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Compact Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Reduce spacing for a more compact layout
                  </p>
                </div>
                <Switch
                  checked={displaySettings.compactMode}
                  onCheckedChange={(checked) => handleDisplayChange('compactMode', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Animations</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable smooth transitions and animations
                  </p>
                </div>
                <Switch
                  checked={displaySettings.showAnimations}
                  onCheckedChange={(checked) => handleDisplayChange('showAnimations', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto Save</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically save changes as you work
                  </p>
                </div>
                <Switch
                  checked={displaySettings.autoSave}
                  onCheckedChange={(checked) => handleDisplayChange('autoSave', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Tooltips</Label>
                  <p className="text-sm text-muted-foreground">
                    Display helpful tooltips and hints
                  </p>
                </div>
                <Switch
                  checked={displaySettings.showTooltips}
                  onCheckedChange={(checked) => handleDisplayChange('showTooltips', checked)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Density</Label>
                <Select 
                  value={displaySettings.density} 
                  onValueChange={(value: 'comfortable' | 'compact' | 'spacious') => 
                    handleDisplayChange('density', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comfortable">Comfortable</SelectItem>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="spacious">Spacious</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Font Size</Label>
                <Select 
                  value={displaySettings.fontSize} 
                  onValueChange={(value: 'small' | 'medium' | 'large') => 
                    handleDisplayChange('fontSize', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customization Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Advanced Customization
          </CardTitle>
          <CardDescription>
            Fine-tune the visual appearance of your interface
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Accent Color</Label>
              <div className="grid grid-cols-6 gap-2">
                {['blue', 'green', 'purple', 'red', 'orange', 'pink'].map((color) => (
                  <Button
                    key={color}
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-10 w-full",
                      customization.accentColor === color && "ring-2 ring-primary"
                    )}
                    onClick={() => handleCustomizationChange('accentColor', color)}
                  >
                    <div 
                      className={cn(
                        "w-4 h-4 rounded-full",
                        `bg-${color}-500`
                      )} 
                    />
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Border Radius: {customization.borderRadius}px</Label>
              <Slider
                value={[customization.borderRadius]}
                onValueChange={(value) => handleCustomizationChange('borderRadius', value[0])}
                max={12}
                min={0}
                step={1}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label>Shadow Intensity: {customization.shadowIntensity}</Label>
              <Slider
                value={[customization.shadowIntensity]}
                onValueChange={(value) => handleCustomizationChange('shadowIntensity', value[0])}
                max={5}
                min={0}
                step={1}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label>Animation Speed: {customization.animationSpeed}x</Label>
              <Slider
                value={[customization.animationSpeed]}
                onValueChange={(value) => handleCustomizationChange('animationSpeed', value[0])}
                max={3}
                min={0.5}
                step={0.1}
                className="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Manage your notification preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <h4 className="font-medium text-sm">General Notifications</h4>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm">Email Notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Receive important updates via email
                  </p>
                </div>
                <Switch
                  checked={notifications.email}
                  onCheckedChange={() => handleNotificationChange('email')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm">Push Notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Get real-time notifications in your browser
                  </p>
                </div>
                <Switch
                  checked={notifications.push}
                  onCheckedChange={() => handleNotificationChange('push')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm">Marketing Emails</Label>
                  <p className="text-xs text-muted-foreground">
                    Receive updates about new features and offers
                  </p>
                </div>
                <Switch
                  checked={notifications.marketing}
                  onCheckedChange={() => handleNotificationChange('marketing')}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-sm">Specific Notifications</h4>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm">Product Updates</Label>
                  <p className="text-xs text-muted-foreground">
                    Get notified about new features
                  </p>
                </div>
                <Switch
                  checked={notifications.updates}
                  onCheckedChange={() => handleNotificationChange('updates')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm">Security Alerts</Label>
                  <p className="text-xs text-muted-foreground">
                    Important security notifications
                  </p>
                </div>
                <Switch
                  checked={notifications.security}
                  onCheckedChange={() => handleNotificationChange('security')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm">Workflow Alerts</Label>
                  <p className="text-xs text-muted-foreground">
                    Workflow execution notifications
                  </p>
                </div>
                <Switch
                  checked={notifications.workflow}
                  onCheckedChange={() => handleNotificationChange('workflow')}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Actions
          </CardTitle>
          <CardDescription>
            Manage your appearance settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="outline" 
              onClick={resetToDefaults}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reset to Defaults
            </Button>
            
            <Button 
              className="flex items-center gap-2"
              onClick={() => {
                toast({
                  title: "Settings Saved",
                  description: "All appearance settings have been saved.",
                });
              }}
            >
              <Save className="h-4 w-4" />
              Save All Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
