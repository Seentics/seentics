'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ExternalLink, 
  FileDown, 
  FormInput, 
  MousePointerClick, 
  PlayCircle, 
  Search, 
  ChevronDown, 
  ChevronUp,
  Copy,
  Target,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/analytics-api';
import { Skeleton } from '@/components/ui/skeleton';

type EventItem = {
	event_type: string;
	count: number;
	sample_properties: Record<string, any>;
	description?: string;
};

interface EventsDetailsProps {
	items: EventItem[];
	isLoading?: boolean;
}

export function EventsDetails({ items, isLoading }: EventsDetailsProps) {
	const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

	if (isLoading) {
		return (
			<div className="space-y-4 h-[400px]">
				{[...Array(5)].map((_, i) => (
					<div key={i} className="flex items-center justify-between p-4 bg-accent/5 rounded border border-border/40">
						<div className="flex items-center gap-3">
							<Skeleton className="h-4 w-4 rounded-full" />
							<Skeleton className="h-4 w-32" />
						</div>
						<Skeleton className="h-4 w-12" />
					</div>
				))}
			</div>
		);
	}

	if (!items || items.length === 0) {
		return (
			<div className="h-64 flex flex-col items-center justify-center text-center space-y-4 opacity-50 bg-accent/5 rounded border border-dashed border-border/60">
        <div className="h-16 w-16 bg-accent/20 rounded-full flex items-center justify-center">
            <Target className="h-8 w-8 text-muted-foreground opacity-20" />
        </div>
        <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">No conversions detected</p>
            <p className="text-xs italic opacity-60">Goal tracking will activate as visitors trigger events</p>
        </div>
      </div>
		);
	}

	const pretty = (obj?: Record<string, any>) => {
		try {
			return JSON.stringify(obj || {}, null, 2);
		} catch (e) {
			return '{}';
		}
	};

	const truncate = (text?: string, len: number = 60) => {
		if (!text) return '';
		return text.length > len ? text.slice(0, len) + '…' : text;
	};

	const excludedKeys = new Set([
		'browser', 'city', 'country', 'device', 'language', 'os', 'referrer',
		'screen_height', 'screen_width', 'time_on_page', 'timezone', 'user_agent',
		'utm_campaign', 'utm_content', 'utm_medium', 'utm_source', 'utm_term',
		'page', 'session_id', 'visitor_id', 'ip', 'timestamp'
	]);

	const allowedPrefixes = [
		'element_', 'form_', 'search_', 'file_', 'video_', 'position', 'href'
	];

	const isAllowedKey = (key: string) => {
		if (excludedKeys.has(key)) return false;
		return allowedPrefixes.some(prefix => key === prefix || key.startsWith(prefix));
	};

	const filterEventProps = (obj?: Record<string, any>) => {
		if (!obj || typeof obj !== 'object') return {} as Record<string, any>;
		const filtered: Record<string, any> = {};
		Object.entries(obj).forEach(([key, value]) => {
			if (isAllowedKey(key)) {
				filtered[key] = value;
			}
		});
		if (filtered.element_class && typeof filtered.element_class === 'string') {
			filtered.element_class = truncate(filtered.element_class, 120);
		}
		return filtered;
	};

	const copyToClipboard = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
		} catch { }
	};

	const eventMeta = (type: string, props?: Record<string, any>) => {
		const t = type.toLowerCase();
		if (t.includes('form_submit') || t.includes('form_submission')) {
			const formId = props?.form_id || props?.form_name || 'Form';
			return { label: `Form: ${formId}`, icon: FormInput, color: '#3B82F6' };
		}
		if (t.includes('click')) {
			const target = props?.element_text || props?.element_id || props?.element_tag || 'Element';
			return { label: `Click: ${target}`, icon: MousePointerClick, color: '#10B981' };
		}
		if (t.includes('external_link')) return { label: 'External Link', icon: ExternalLink, color: '#06B6D4' };
		if (t.includes('file_download')) return { label: 'File Download', icon: FileDown, color: '#F59E0B' };
		if (t.includes('search')) return { label: 'Search', icon: Search, color: '#10B981' };
		if (t.includes('video')) return { label: 'Video Activity', icon: PlayCircle, color: '#D946EF' };
		if (t.includes('conversion')) return { label: 'Goal Conversion', icon: Target, color: '#8B5CF6' };
		if (t.includes('scroll_depth')) {
			const depth = props?.depth || '0';
			return { label: `Scroll: ${depth}%`, icon: Activity, color: '#6366f1' };
		}
		return { label: type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), icon: Activity, color: '#64748B' };
	};

	return (
		<div className="space-y-1 h-[400px] overflow-y-auto pr-1 custom-scrollbar">
			{items.map((event, index) => {
				const meta = eventMeta(event.event_type, event.sample_properties);
				const filtered = filterEventProps(event.sample_properties);
				const chips = [
					filtered.element_text && { label: String(filtered.element_text), variant: 'outline' },
					(event.sample_properties as any)?.page && { label: String((event.sample_properties as any).page).split('?')[0], variant: 'outline' }
				].filter(Boolean) as { label: string; variant: 'outline' | 'secondary' }[];

				const key = `${event.event_type}-${index}`;
				const isOpen = !!expanded[key];

				return (
					<div key={key} className="group flex flex-col border-b border-border/40 transition-all duration-300 hover:bg-accent/5 rounded">
						<div className="flex items-center justify-between p-3 px-4">
							<div className="flex items-center space-x-4 flex-1 min-w-0">
								<div className="h-9 w-9 rounded bg-accent/10 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
									<meta.icon className="h-4 w-4" style={{ color: meta.color }} />
								</div>
								
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2 mb-1">
                    <div className="font-semibold text-sm leading-tight text-foreground truncate " title={meta.label}>
                      {meta.label}
                    </div>
                    {chips.slice(0, 1).map((c, i) => (
                      <Badge key={i} variant="outline" className="hidden sm:inline-flex text-[9px] px-1.5 py-0 font-bold uppercase tracking-wider h-4 bg-primary/5 border-primary/20 text-primary">
                        {truncate(c.label, 20)}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest opacity-50 truncate">
                    {event.event_type}
                  </div>
								</div>
							</div>

              <div className="flex items-center gap-6 shrink-0 text-right">
                <div className="text-right">
                  <div className="font-bold text-base leading-tight tracking-tight">
                    {formatNumber(event.count)}
                  </div>
                  <div className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider opacity-50">
                    Conversions
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-primary shrink-0 rounded hover:bg-primary/5 transition-all"
                    onClick={() => setExpanded(prev => ({ ...prev, [key]: !isOpen }))}
                  >
                    {isOpen ? <ChevronUp className="h-4 w-4" strokeWidth={3} /> : <ChevronDown className="h-4 w-4" strokeWidth={3} />}
                  </Button>
                </div>
              </div>
						</div>

						{isOpen && (
              <div className="px-6 pb-6 pt-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                {Object.keys(filtered).length > 0 && (
                  <div className="bg-accent/5 rounded p-6 border border-border/40 shadow-inner relative group/payload overflow-hidden">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/20">
                      <div className="flex items-center gap-2">
                         <div className="w-1.25 h-1.25 rounded-full bg-primary/60" />
                         <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground opacity-50">Event Payload Structure</span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 px-4 text-[10px] font-bold uppercase tracking-widest gap-2 hover:bg-primary/10 text-primary rounded transition-all" 
                        onClick={() => copyToClipboard(pretty(filtered))}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Capture Metadata
                      </Button>
                    </div>
                    <pre className="text-[11px] font-mono text-foreground overflow-x-auto selection:bg-primary/20 leading-relaxed opacity-80 custom-scrollbar">
                      <code>{pretty(filtered)}</code>
                    </pre>
                    <div className="absolute -bottom-1 -right-1 h-20 w-20 bg-primary/5 blur-3xl opacity-0 group-hover/payload:opacity-100 transition-all duration-700" />
                  </div>
                )}
                {event.description && (
                  <div className="flex items-start gap-3 bg-primary/5 p-3 rounded border border-dashed border-primary/20">
                    <Activity className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <p className="text-[11px] text-muted-foreground font-medium leading-relaxed italic">{event.description}</p>
                  </div>
                )}
              </div>
            )}
					</div>
				);
			})}
		</div>
	);
}

export default EventsDetails;
