'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { UTMPerformanceChart } from './UTMPerformanceChart';
import { 
  Target, 
  TrendingUp, 
  BarChart3, 
  Users, 
  MousePointer, 
  Zap,
  Globe,
  ExternalLink,
  Mail,
  Share2,
  Search,
  Megaphone,
  CreditCard,
  Users2,
  Rocket,
  Lightbulb,
  ShoppingCart,
  Gift,
  Calendar,
  Tag
} from 'lucide-react';
import Image from 'next/image';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';

interface CustomEvent {
  event_type: string;
  page_url: string;
  user_agent: string;
  timestamp: string;
  properties?: Record<string, any>;
  description?: string;
  common_properties?: string[];
  sample_properties?: Record<string, any>;
  sample_event?: Record<string, any>;
}

interface CustomEventsData {
  timeseries: Array<{ date: string; count: number }>;
  top_events: Array<{ 
    event_type: string; 
    count: number;
    description?: string;
    common_properties?: string[];
    sample_properties?: Record<string, any>;
    sample_event?: Record<string, any>;
  }>;
  total_events?: number;
  unique_events?: number;
  utm_performance?: {
    sources: Array<{
      source: string;
      unique_visitors: number;
      visits: number;
    }>;
    mediums: Array<{
      medium: string;
      unique_visitors: number;
      visits: number;
    }>;
    campaigns: Array<{
      campaign: string;
      unique_visitors: number;
      visits: number;
    }>;
    terms: Array<{
      term: string;
      unique_visitors: number;
      visits: number;
    }>;
    content: Array<{
      content: string;
      unique_visitors: number;
      visits: number;
    }>;
    avg_ctr: number;
    total_campaigns: number;
    total_sources: number;
    total_mediums: number;
  };
}

interface EventTrendData {
  day: string;
  pageViews: number;
  clicks: number;
  conversions: number;
}

interface EventsAndCampaignsProps {
  customEvents?: CustomEventsData;
  customEventsLoading?: boolean;
  isDemo?: boolean;
  className?: string;
}

export function EventsAndCampaigns({ 
  customEvents, 
  customEventsLoading = false,
  isDemo = false,
  className = '' 
}: EventsAndCampaignsProps) {
  const [eventsTab, setEventsTab] = useState<string>('utm'); // Start with UTM tab
  
  const generateDemoEventTrendData = (): EventTrendData[] => [
    { day: 'Mon', pageViews: 1200, clicks: 450, conversions: 23 },
    { day: 'Tue', pageViews: 1350, clicks: 520, conversions: 28 },
    { day: 'Wed', pageViews: 980, clicks: 380, conversions: 19 },
    { day: 'Thu', pageViews: 1420, clicks: 610, conversions: 31 },
    { day: 'Fri', pageViews: 1180, clicks: 480, conversions: 25 },
    { day: 'Sat', pageViews: 890, clicks: 320, conversions: 16 },
    { day: 'Sun', pageViews: 1050, clicks: 410, conversions: 21 }
  ];

  const eventTrendData = isDemo ? generateDemoEventTrendData() : (customEvents?.timeseries || []);

  // Check if we have any meaningful data
  const hasData = customEvents && (
    (customEvents.top_events && customEvents.top_events.length > 0) ||
    (customEvents.utm_performance && Object.keys(customEvents.utm_performance.sources || {}).length > 0) ||
    (customEvents.total_events && customEvents.total_events > 0)
  );

  // Helper function to get appropriate image for traffic source
  const getSourceImage = (source: string) => {
    const lowerSource = source.toLowerCase();
    
    if (lowerSource.includes('google')) return '/images/search.png';
    if (lowerSource.includes('facebook')) return '/images/facebook.png';
    if (lowerSource.includes('twitter')) return '/images/twitter.png';
    if (lowerSource.includes('linkedin')) return '/images/linkedin.png';
    if (lowerSource.includes('instagram')) return '/images/instagram.png';
    if (lowerSource.includes('youtube')) return '/images/search.png';
    if (lowerSource.includes('tiktok')) return '/images/tiktok.png';
    if (lowerSource.includes('pinterest')) return '/images/pinterest.png';
    if (lowerSource.includes('whatsapp')) return '/images/whatsapp.png';
    if (lowerSource.includes('telegram')) return '/images/telegram.png';
    if (lowerSource.includes('email')) return '/images/search.png';
    if (lowerSource.includes('direct') || !source) return '/images/link.png';
            if (lowerSource.includes('internal') || lowerSource.includes('localhost') || lowerSource.includes('navigation') || lowerSource.includes('127.0.0.1')) return '/images/link.png';
    
    return '/images/planet-earth.png';
  };

  // Helper function to get appropriate icon for marketing campaign
  const getCampaignIcon = (campaign: string) => {
    const lowerCampaign = campaign.toLowerCase();
    
    if (lowerCampaign.includes('brand') || lowerCampaign.includes('awareness')) return <Lightbulb className="h-4 w-4 text-yellow-600" />;
    if (lowerCampaign.includes('product') || lowerCampaign.includes('launch')) return <Rocket className="h-4 w-4 text-blue-600" />;
    if (lowerCampaign.includes('sale') || lowerCampaign.includes('discount')) return <ShoppingCart className="h-4 w-4 text-green-600" />;
    if (lowerCampaign.includes('newsletter') || lowerCampaign.includes('email')) return <Mail className="h-4 w-4 text-blue-600" />;
    if (lowerCampaign.includes('social') || lowerCampaign.includes('community')) return <Users2 className="h-4 w-4 text-purple-600" />;
    if (lowerCampaign.includes('seasonal') || lowerCampaign.includes('holiday')) return <Calendar className="h-4 w-4 text-red-600" />;
    if (lowerCampaign.includes('referral') || lowerCampaign.includes('affiliate')) return <Gift className="h-4 w-4 text-orange-600" />;
    if (lowerCampaign.includes('retargeting') || lowerCampaign.includes('remarketing')) return <Target className="h-4 w-4 text-indigo-600" />;
    
    return <Tag className="h-4 w-4 text-gray-600" />;
  };

  // Helper function to get appropriate icon for marketing medium
  const getMediumIcon = (medium: string) => {
    const lowerMedium = medium.toLowerCase();
    
    if (lowerMedium.includes('cpc') || lowerMedium.includes('ppc')) return <CreditCard className="h-4 w-4 text-blue-600" />;
    if (lowerMedium.includes('social')) return <Share2 className="h-4 w-4 text-purple-600" />;
    if (lowerMedium.includes('email')) return <Mail className="h-4 w-4 text-green-600" />;
    if (lowerMedium.includes('organic') || lowerMedium.includes('seo')) return <Search className="h-4 w-4 text-green-600" />;
    if (lowerMedium.includes('referral')) return <ExternalLink className="h-4 w-4 text-orange-600" />;
    if (lowerMedium.includes('display') || lowerMedium.includes('banner')) return <Globe className="h-4 w-4 text-indigo-600" />;
    if (lowerMedium.includes('video')) return <Globe className="h-4 w-4 text-red-600" />;
    if (lowerMedium.includes('affiliate')) return <Users2 className="h-4 w-4 text-purple-600" />;
    
    return <Tag className="h-4 w-4 text-gray-600" />;
  };

  return (
    <Card className={cn("bg-card/50 shadow-sm shadow-black/5 border-border/40 overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold tracking-tight">Campaigns & Events</CardTitle>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest opacity-50">UTM performance and custom event tracking</p>
        </div>
        <Tabs value={eventsTab} onValueChange={setEventsTab} className="w-auto">
          <TabsList className="grid w-full grid-cols-2 h-9 p-1 rounded">
            <TabsTrigger value="utm" className="text-[10px] font-semibold uppercase tracking-wider px-3 gap-1.5 rounded active:bg-background">UTM Performance</TabsTrigger>
            <TabsTrigger value="events" className="text-[10px] font-semibold uppercase tracking-wider px-3 gap-1.5 rounded active:bg-background">Custom Events</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        {/* Show loading state */}
        {customEventsLoading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading campaigns and events data...</p>
          </div>
        )}

        {/* Show no data state */}
        {!customEventsLoading && !hasData && !isDemo && (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-medium mb-2">No Campaign Data Yet</h3>
            <p className="text-sm mb-4">Start tracking UTM campaigns and custom events to see data here.</p>
            <div className="bg-muted/30 rounded p-4 text-left max-w-md mx-auto">
              <h4 className="font-medium mb-2">What you'll see:</h4>
              <ul className="text-xs space-y-1">
                <li>• UTM campaign performance</li>
                <li>• Traffic source analysis</li>
                <li>• Custom event tracking</li>
                <li>• Click-through rates</li>
              </ul>
            </div>
          </div>
        )}

        {/* Show content when there's data or in demo mode */}
        {(hasData || isDemo) && (
          <div className="mt-0 max-h-[32rem] overflow-y-auto">
            {eventsTab === 'events' && (
              <div className="space-y-6">
              



                {/* Custom Events List */}
                {customEvents && customEvents.top_events && customEvents.top_events.length > 0 ? (
                  <div className="space-y-0">
                    <div className="flex items-center gap-2 mb-4">
                      <MousePointer className="h-4 w-4 text-purple-600" />
                      <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">Custom Events Breakdown</h4>
                      <Badge variant="secondary" className="ml-auto text-[10px] uppercase font-bold tracking-tighter h-5">
                        {customEvents.top_events.filter(e => e.event_type !== 'pageview' && e.event_type !== 'page_view').length} Types
                      </Badge>
                    </div>
                    <div className="divide-y divide-border/40 border-t border-border/40">
                      {customEvents.top_events
                        .filter(e => !['pageview', 'page_view', 'page_hidden', 'page_visible', 'exit_intent'].includes(e.event_type)) // Hide low-signal events
                        .sort((a, b) => b.count - a.count) // Sort by count descending
                        .map((event, index) => (
                          <div key={index} className="flex items-center justify-between py-4 hover:bg-accent/5 transition-colors group px-1">
                            {/* Event Header */}
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                                  {index + 1}
                                </span>
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-foreground capitalize group-hover:text-primary transition-colors">
                                  {event.event_type === 'click' ? 'Click' :
                                   event.event_type === 'submit' ? 'Form Submit' :
                                   event.event_type === 'conversion_click' ? 'Conversion Click' :
                                   event.event_type === 'form_field_focus' ? 'Form Field Focus' :
                                   event.event_type === 'external_link_click' ? 'External Link Click' :
                                   event.event_type === 'search_initiated' ? 'Search Initiated' :
                                   event.event_type === 'search_submitted' ? 'Search Submitted' :
                                   event.event_type === 'file_download' ? 'File Download' :
                                   event.event_type === 'video_interaction' ? 'Video Interaction' :
                                   event.event_type === 'scroll_milestone' ? 'Scroll Milestone' :
                                   event.event_type === 'exit_intent' ? 'Exit Intent' :
                                   event.event_type === 'page_hidden' ? 'Page Hidden' :
                                   event.event_type === 'page_visible' ? 'Page Visible' :
                                   event.event_type === 'engagement_update' ? 'Engagement Update' :
                                   event.event_type === 'performance_details' ? 'Performance Details' :
                                   event.event_type === 'session_summary' ? 'Session Summary' :
                                   event.event_type}
                                </div>
                                <div className="text-[10px] text-muted-foreground uppercase font-medium tracking-widest opacity-50">
                                   {event.event_type}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-base font-bold text-foreground">
                                {event.count.toLocaleString()}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider opacity-40">
                                {((event.count / (customEvents.top_events.filter(e => !['pageview', 'page_view', 'page_hidden', 'page_visible', 'exit_intent'].includes(e.event_type)).reduce((sum, e) => sum + e.count, 0) || 1)) * 100).toFixed(1)}%
                              </div>
                            </div>
                          </div>
                      ))}
                    </div>
                  </div>
                ) : (

                            {/* Event Description */}
                            {event.description && (
                              <div className="mb-3 p-3 bg-muted/50 rounded">
                                <div className="text-xs font-medium text-muted-foreground mb-1">Description</div>
                                <div className="text-sm text-foreground">{event.description}</div>
                              </div>
                            )}

                            {/* Common Properties */}
                            {event.common_properties && event.common_properties.length > 0 && (
                              <div className="mb-3">
                                <div className="text-xs font-medium text-muted-foreground mb-2">Common Properties</div>
                                <div className="flex flex-wrap gap-2">
                                  {event.common_properties.map((prop, propIndex) => (
                                    <Badge key={propIndex} variant="outline" className="text-xs">
                                      {prop}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Sample Properties */}
                            {event.sample_properties && Object.keys(event.sample_properties).length > 0 ? (
                              <div className="mb-3">
                                <div className="text-xs font-medium text-muted-foreground mb-2">Sample Properties</div>
                                <div className="bg-muted/30 rounded p-3">
                                  <pre className="text-xs text-foreground overflow-x-auto">
                                    {JSON.stringify(event.sample_properties, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            ) : (
                              <div className="mb-3">
                                <div className="text-xs font-medium text-muted-foreground mb-2">Sample Properties</div>
                                <div className="bg-muted/30 rounded p-3 text-center">
                                  <span className="text-xs text-muted-foreground">No custom properties available</span>
                                </div>
                              </div>
                            )}

                            {/* Sample Event Data */}
                            {event.sample_event && Object.keys(event.sample_event).length > 0 ? (
                              <div className="mb-3">
                                <div className="text-xs font-medium text-muted-foreground mb-2">Sample Event Data</div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  {Object.entries(event.sample_event).map(([key, value]) => {
                                    if (value && value !== '' && value !== 0) {
                                      return (
                                        <div key={key} className="flex justify-between">
                                          <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}:</span>
                                          <span className="text-foreground font-medium">
                                            {typeof value === 'string' && value.length > 30 
                                              ? `${value.substring(0, 30)}...` 
                                              : String(value)}
                                          </span>
                                        </div>
                                      );
                                    }
                                    return null;
                                  })}
                                </div>
                              </div>
                            ) : (
                              <div className="mb-3">
                                <div className="text-xs font-medium text-muted-foreground mb-2">Sample Event Data</div>
                                <div className="bg-muted/30 rounded p-3 text-center">
                                  <span className="text-xs text-muted-foreground">No event data available</span>
                                </div>
                              </div>
                            )}

                            {/* Event Information */}
                            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                              <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">ℹ️ Event Information</div>
                              <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                                {event.event_type === 'click' && (
                                  <>
                                    <p>• This event tracks basic button/link clicks</p>
                                    <p>• For richer data, use smart tracking events like:</p>
                                    <p>  - <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">conversion_click</code> for high-value interactions</p>
                                    <p>  - <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">external_link_click</code> for outbound links</p>
                                  </>
                                )}
                                {event.event_type === 'form_submit' && (
                                  <>
                                    <p>• This event tracks form submissions</p>
                                    <p>• <strong>Expected Properties:</strong> form_action, form_method, form_id, form_class, field_count, page</p>
                                    <p>• <strong>Status:</strong> {event.sample_properties && Object.keys(event.sample_properties).length > 0 ? '✅ Properties captured' : '⚠️ Properties not captured (check backend)'}</p>
                                    <p>• <strong>Troubleshooting:</strong> Check if form elements have proper IDs and classes</p>
                                  </>
                                )}
                                {event.event_type === 'conversion_click' && (
                                  <>
                                    <p>• This event tracks high-value user interactions</p>
                                    <p>• <strong>Expected Properties:</strong> element_type, element_text, element_id, element_class, href, position, page</p>
                                    <p>• <strong>Status:</strong> {event.sample_properties && Object.keys(event.sample_properties).length > 0 ? '✅ Properties captured' : '⚠️ Properties not captured (check backend)'}</p>
                                    <p>• <strong>Troubleshooting:</strong> Ensure buttons have meaningful text, IDs, or classes</p>
                                  </>
                                )}
                                {event.event_type === 'page_visible' && (
                                  <>
                                    <p>• This event tracks when pages become visible</p>
                                    <p>• Useful for engagement and time-on-page metrics</p>
                                    <p>• <strong>Expected Properties:</strong> page, time_on_page</p>
                                  </>
                                )}
                                {event.event_type === 'page_hidden' && (
                                  <>
                                    <p>• This event tracks when pages become hidden</p>
                                    <p>• Helps measure actual user engagement time</p>
                                    <p>• <strong>Expected Properties:</strong> page, time_on_page</p>
                                  </>
                                )}
                                {event.event_type === 'exit_intent' && (
                                  <>
                                    <p>• This event tracks when users are about to leave</p>
                                    <p>• <strong>Expected Properties:</strong> mouse_position, trigger, page</p>
                                    <p>• <strong>Status:</strong> {event.sample_properties && Object.keys(event.sample_properties).length > 0 ? '✅ Properties captured' : '⚠️ Properties not captured (check backend)'}</p>
                                    <p>• <strong>Troubleshooting:</strong> Mouse position tracking should work automatically</p>
                                  </>
                                )}
                                {!['click', 'form_submit', 'page_visible', 'page_hidden', 'conversion_click', 'exit_intent'].includes(event.event_type) && (
                                  <>
                                    <p>• This event type may have custom properties</p>
                                    <p>• Properties will appear above when available</p>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Backend Status */}
                            <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                              <div className="text-xs font-medium text-yellow-700 dark:text-yellow-300 mb-2">🔧 Backend Status</div>
                              <div className="text-xs text-yellow-600 dark:text-yellow-400 space-y-1">
                                <p>• <strong>Event Processing:</strong> {event.sample_properties && Object.keys(event.sample_properties).length > 0 ? '✅ Working' : '⚠️ Issues detected'}</p>
                                <p>• <strong>Properties Storage:</strong> {event.sample_properties && Object.keys(event.sample_properties).length > 0 ? '✅ Stored' : '❌ Not stored'}</p>
                                <p>• <strong>Recommendation:</strong> {event.sample_properties && Object.keys(event.sample_properties).length > 0 ? 'All systems operational' : 'Check backend logs for event processing errors'}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : isDemo ? (
                  <div className="bg-muted/30 rounded p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <MousePointer className="h-5 w-5 text-purple-600" />
                      <h4 className="font-semibold text-foreground">Custom Events Breakdown</h4>
                      <Badge variant="secondary" className="ml-auto">Demo Data</Badge>
                    </div>
                    <div className="space-y-3">
                      {[
                        { event_type: 'pageview', count: 1250, percentage: 45.2 },
                        { event_type: 'click', count: 890, percentage: 32.1 },
                        { event_type: 'submit', count: 234, percentage: 8.4 },
                        { event_type: 'scroll', count: 156, percentage: 5.6 },
                        { event_type: 'conversion', count: 89, percentage: 3.2 },
                        { event_type: 'download', count: 67, percentage: 2.4 },
                        { event_type: 'error', count: 23, percentage: 0.8 },
                        { event_type: 'performance', count: 12, percentage: 0.4 }
                      ].map((event, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-background rounded border border-border hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                              <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                                {index + 1}
                              </span>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-foreground capitalize">
                                {event.event_type === 'pageview' || event.event_type === 'page_view' ? 'Page View' : 
                                 event.event_type === 'click' ? 'Click' :
                                 event.event_type === 'submit' ? 'Form Submit' :
                                 event.event_type === 'scroll' ? 'Scroll' :
                                 event.event_type === 'conversion' ? 'Conversion' :
                                 event.event_type === 'download' ? 'Download' :
                                 event.event_type === 'error' ? 'Error' :
                                 event.event_type === 'performance' ? 'Performance' :
                                 event.event_type === 'performance_details' ? 'Performance Details' :
                                 event.event_type === 'engagement_update' ? 'Engagement Update' :
                                 event.event_type === 'session_summary' ? 'Session Summary' :
                                 event.event_type}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Event ID: {event.event_type}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                              {event.count.toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {event.percentage}% of total
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <MousePointer className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    <div className="text-sm">No custom events tracked yet</div>
                    <div className="text-xs">Custom events will appear here when they are tracked. The system automatically tracks performance metrics, engagement updates, and other user interactions.</div>
                  </div>
                )}
              </div>
            )}
            
            {eventsTab === 'utm' && (
              <div className="space-y-6">
                {/* UTM Overview Cards */}
                {customEvents && customEvents.utm_performance ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded border border-blue-200/50 dark:border-blue-800/30">
                      <div className="flex items-center justify-center mb-2">
                        <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                        {customEvents.utm_performance.total_sources || 0}
                      </div>
                      <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Active UTM Sources</div>
                      <div className="text-xs text-blue-500 dark:text-blue-400 mt-1">This month</div>
                    </div>
                    
                    <div className="text-center p-4 bg-green-50/50 dark:bg-green-950/20 rounded border border-green-200/50 dark:border-green-800/30">
                      <div className="flex items-center justify-center mb-2">
                        <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                        {customEvents.utm_performance.avg_ctr ? `${customEvents.utm_performance.avg_ctr.toFixed(1)}%` : '0%'}
                      </div>
                      <div className="text-sm text-green-600 dark:text-green-400 font-medium">Avg CTR</div>
                      <div className="text-xs text-green-500 dark:text-green-400 mt-1">Click-through rate</div>
                    </div>
                    
                    <div className="text-center p-4 bg-purple-50/50 dark:bg-purple-950/20 rounded border border-purple-200/50 dark:border-purple-800/30">
                      <div className="flex items-center justify-center mb-2">
                        <Target className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                        {customEvents.utm_performance.total_campaigns || 0}
                      </div>
                      <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">Total Campaigns</div>
                      <div className="text-xs text-purple-500 dark:text-purple-400 mt-1">Active campaigns</div>
                    </div>
                  </div>
                ) : isDemo ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-muted/30 rounded border border-border">
                      <div className="flex items-center justify-center mb-2">
                        <Target className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="text-2xl font-bold text-foreground">24</div>
                      <div className="text-sm text-muted-foreground font-medium">Active UTM Sources</div>
                      <div className="text-xs text-muted-foreground mt-1">This month</div>
                    </div>
                    
                    <div className="text-center p-4 bg-muted/30 rounded border border-border">
                      <div className="flex items-center justify-center mb-2">
                        <TrendingUp className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="text-2xl font-bold text-foreground">4.2%</div>
                      <div className="text-sm text-muted-foreground font-medium">Avg CTR</div>
                      <div className="text-xs text-muted-foreground mt-1">Click-through rate</div>
                    </div>
                    
                    <div className="text-center p-4 bg-muted/30 rounded border border-border">
                      <div className="flex items-center justify-center mb-2">
                        <Target className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="text-2xl font-bold text-foreground">$89</div>
                      <div className="text-sm text-muted-foreground font-medium">Avg CPA</div>
                      <div className="text-xs text-muted-foreground mt-1">Cost per acquisition</div>
                    </div>
                  </div>
                                 ) : isDemo ? (
                   <div className="space-y-4">
                     {/* Demo UTM Sources */}
                     <div className="bg-muted/30 rounded p-4">
                       <div className="flex items-center gap-2 mb-4">
                         <Target className="h-5 w-5 text-blue-600" />
                         <h4 className="font-semibold text-foreground">Traffic Sources</h4>
                       </div>
                       <div className="space-y-2">
                         {[
                           { source: 'Google', visitors: 1250, events: 3200 },
                           { source: 'Facebook', visitors: 890, events: 2100 },
                           { source: 'Direct', visitors: 650, events: 1800 },
                           { source: 'Twitter', visitors: 320, events: 950 }
                         ].map((item, index) => (
                           <div key={index} className="flex items-center justify-between p-2 bg-background rounded border">
                             <span className="text-sm font-medium">{item.source}</span>
                             <div className="text-right text-xs text-muted-foreground">
                               <div>{item.visitors} visitors</div>
                               <div>{item.events} events</div>
                             </div>
                           </div>
                         ))}
                       </div>
                     </div>
                     
                     {/* Demo UTM Campaigns */}
                     <div className="bg-muted/30 rounded p-4">
                       <div className="flex items-center gap-2 mb-4">
                         <TrendingUp className="h-5 w-5 text-green-600" />
                         <h4 className="font-semibold text-foreground">Marketing Campaigns</h4>
                       </div>
                       <div className="space-y-2">
                         {[
                           { campaign: 'Summer Sale', visitors: 890, events: 2200 },
                           { campaign: 'Product Launch', visitors: 650, events: 1800 },
                           { campaign: 'Newsletter', visitors: 420, events: 1200 }
                         ].map((item, index) => (
                           <div key={index} className="flex items-center justify-between p-2 bg-background rounded border">
                             <span className="text-sm font-medium">{item.campaign}</span>
                             <div className="text-right text-xs text-muted-foreground">
                               <div>{item.visitors} visitors</div>
                               <div>{item.events} events</div>
                             </div>
                           </div>
                         ))}
                       </div>
                     </div>
                   </div>
                 ) : (
                   <div className="text-center py-8 text-muted-foreground">
                     <div className="text-sm">No UTM data available</div>
                     <div className="text-xs">UTM campaign data will appear here when campaigns are tracked</div>
                   </div>
                 )}

                {/* Detailed UTM Breakdown */}
                {customEvents && customEvents.utm_performance ? (
                  <div className="space-y-4">
                    {/* UTM Sources */}
                    {customEvents.utm_performance.sources && customEvents.utm_performance.sources.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <Target className="h-5 w-5 text-blue-600" />
                          <h4 className="font-semibold text-foreground">Traffic Sources</h4>
                        </div>
                        <div className="space-y-0 divide-y divide-border/40">
                          {customEvents.utm_performance.sources.map((item: any) => (
                            <div key={item.source} className="flex items-center justify-between py-3 hover:bg-accent/5 transition-colors group px-1">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded flex items-center justify-center bg-accent/10 group-hover:bg-primary/10 overflow-hidden transition-colors">
                                  <Image
                                    src={getSourceImage(item.source)}
                                    alt={item.source || 'Direct'}
                                    width={20}
                                    height={20}
                                    className="object-contain"
                                    onError={(e) => {
                                      // Fallback to icon if image fails to load
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      target.nextElementSibling?.classList.remove('hidden');
                                    }}
                                  />
                                  <div className="hidden">
                                    {item.source && item.source.toLowerCase().includes('google') ? (
                                      <Search className="h-4 w-4 text-blue-600" />
                                    ) : item.source && item.source.toLowerCase().includes('facebook') ? (
                                      <Share2 className="h-4 w-4 text-blue-600" />
                                    ) : item.source && item.source.toLowerCase().includes('email') ? (
                                      <Mail className="h-4 w-4 text-blue-600" />
                                    ) : item.source && (item.source.toLowerCase().includes('internal') || item.source.toLowerCase().includes('localhost') || item.source.toLowerCase().includes('navigation') || item.source.toLowerCase().includes('127.0.0.1')) ? (
                                      <ExternalLink className="h-4 w-4 text-blue-600" />
                                    ) : (
                                      <Globe className="h-4 w-4 text-blue-600" />
                                    )}
                                  </div>
                                </div>
                                <span className="text-sm font-semibold">{item.source || 'Direct'}</span>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold">{item.unique_visitors || 0} visitors</div>
                                <div className="text-[10px] text-muted-foreground uppercase font-medium tracking-widest opacity-50">{item.visits || 0} events</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* UTM Campaigns */}
                    {customEvents.utm_performance.campaigns && customEvents.utm_performance.campaigns.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                          <h4 className="font-semibold text-foreground">Marketing Campaigns</h4>
                        </div>
                        <div className="space-y-0 divide-y divide-border/40">
                          {customEvents.utm_performance.campaigns.map((item: any) => (
                            <div key={item.campaign} className="flex items-center justify-between py-3 hover:bg-accent/5 transition-colors group px-1">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded flex items-center justify-center bg-accent/10 group-hover:bg-primary/10 transition-colors">
                                  {getCampaignIcon(item.campaign)}
                                </div>
                                <span className="text-sm font-semibold">{item.campaign || 'None'}</span>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold">{item.unique_visitors || 0} visitors</div>
                                <div className="text-[10px] text-muted-foreground uppercase font-medium tracking-widest opacity-50">{item.visits || 0} events</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* UTM Mediums */}
                    {customEvents.utm_performance.mediums && customEvents.utm_performance.mediums.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <Target className="h-5 w-5 text-purple-600" />
                          <h4 className="font-semibold text-foreground">Marketing Mediums</h4>
                        </div>
                        <div className="space-y-0 divide-y divide-border/40">
                          {customEvents.utm_performance.mediums.map((item: any) => (
                            <div key={item.medium} className="flex items-center justify-between py-3 hover:bg-accent/5 transition-colors group px-1">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded flex items-center justify-center bg-accent/10 group-hover:bg-primary/10 transition-colors">
                                  {getMediumIcon(item.medium)}
                                </div>
                                <span className="text-sm font-semibold">{item.medium || 'None'}</span>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold">{item.unique_visitors || 0} visitors</div>
                                <div className="text-[10px] text-muted-foreground uppercase font-medium tracking-widest opacity-50">{item.visits || 0} events</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : isDemo ? (
                  <div className="space-y-4">
                    {/* Demo UTM Sources */}
                    <div className="bg-muted/30 rounded p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Target className="h-5 w-5 text-blue-600" />
                        <h4 className="font-semibold text-foreground">Traffic Sources</h4>
                      </div>
                      <div className="space-y-2">
                        {[
                          { source: 'google', visitors: 1250, events: 3200 },
                          { source: 'facebook', visitors: 890, events: 2100 },
                          { source: 'Direct', visitors: 650, events: 1800 },
                          { source: 'twitter', visitors: 320, events: 950 }
                        ].map((item, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-background rounded border hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 overflow-hidden">
                                <Image
                                  src={getSourceImage(item.source)}
                                  alt={item.source}
                                  width={20}
                                  height={20}
                                  className="object-contain"
                                  onError={(e) => {
                                    // Fallback to icon if image fails to load
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    target.nextElementSibling?.classList.remove('hidden');
                                  }}
                                />
                                <div className="hidden">
                                  {item.source.toLowerCase().includes('google') ? (
                                    <Search className="h-4 w-4 text-blue-600" />
                                  ) : item.source.toLowerCase().includes('facebook') ? (
                                    <Share2 className="h-4 w-4 text-blue-600" />
                                  ) : item.source.toLowerCase().includes('twitter') ? (
                                    <Share2 className="h-4 w-4 text-blue-600" />
                                  ) : item.source.toLowerCase().includes('internal') || item.source.toLowerCase().includes('localhost') || item.source.toLowerCase().includes('navigation') || item.source.toLowerCase().includes('127.0.0.1') ? (
                                    <ExternalLink className="h-4 w-4 text-blue-600" />
                                  ) : (
                                    <Globe className="h-4 w-4 text-blue-600" />
                                  )}
                                </div>
                              </div>
                              <span className="text-sm font-medium">{item.source}</span>
                            </div>
                            <div className="text-right text-xs text-muted-foreground">
                              <div>{item.visitors} visitors</div>
                              <div>{item.events} events</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Demo UTM Campaigns */}
                    <div className="bg-muted/30 rounded p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        <h4 className="font-semibold text-foreground">Marketing Campaigns</h4>
                      </div>
                      <div className="space-y-2">
                        {[
                          { campaign: 'brand_awareness', visitors: 890, events: 2200 },
                          { campaign: 'product_launch', visitors: 650, events: 1800 },
                          { campaign: 'summer_sale', visitors: 420, events: 1200 }
                        ].map((item, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-background rounded border hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded flex items-center justify-center bg-green-100 dark:bg-green-900/30">
                                {getCampaignIcon(item.campaign)}
                              </div>
                              <span className="text-sm font-medium">{item.campaign.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                            </div>
                            <div className="text-right text-xs text-muted-foreground">
                              <div>{item.visitors} visitors</div>
                              <div>{item.events} events</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Demo UTM Mediums */}
                    <div className="bg-muted/30 rounded p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Target className="h-5 w-5 text-purple-600" />
                        <h4 className="font-semibold text-foreground">Marketing Mediums</h4>
                      </div>
                      <div className="space-y-2">
                        {[
                          { medium: 'cpc', visitors: 890, events: 2200 },
                          { medium: 'social', visitors: 650, events: 1800 },
                          { medium: 'email', visitors: 420, events: 1200 }
                        ].map((item, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-background rounded border hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded flex items-center justify-center bg-purple-100 dark:bg-purple-900/30">
                                {getMediumIcon(item.medium)}
                              </div>
                              <span className="text-sm font-medium">{item.medium.toUpperCase()}</span>
                            </div>
                            <div className="text-right text-xs text-muted-foreground">
                              <div>{item.visitors} visitors</div>
                              <div>{item.events} events</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="text-sm">No UTM data available</div>
                    <div className="text-xs">UTM campaign data will appear here when campaigns are tracked</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
