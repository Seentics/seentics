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
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/analytics-api';

type EventItem = {
	event_type: string;
	count: number;
	description?: string;
	common_properties?: string[];
	sample_properties?: Record<string, any>;
	sample_event?: Record<string, any>;
};

interface EventsDetailsProps {
	items: EventItem[];
}

export function EventsDetails({ items }: EventsDetailsProps) {
	const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

	if (!items || items.length === 0) {
		return (
			<div className="h-64 flex flex-col items-center justify-center text-center space-y-2 opacity-50">
        <Target className="h-10 w-10 text-muted-foreground mb-2" />
        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">No conversions detected</p>
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

	const eventMeta = (type: string) => {
		const t = type.toLowerCase();
		if (t.includes('form_submit')) return { label: 'Form Submit', icon: FormInput, color: '#3B82F6' };
		if (t.includes('external_link')) return { label: 'External Link', icon: ExternalLink, color: '#06B6D4' };
		if (t.includes('file_download')) return { label: 'File Download', icon: FileDown, color: '#F59E0B' };
		if (t.includes('search')) return { label: 'Search', icon: Search, color: '#10B981' };
		if (t.includes('video')) return { label: 'Video', icon: PlayCircle, color: '#D946EF' };
		if (t.includes('conversion')) return { label: 'Conversion', icon: MousePointerClick, color: '#8B5CF6' };
		return { label: type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), icon: Target, color: '#64748B' };
	};

  const maxVal = Math.max(...items.map(i => i.count), 1);

	return (
		<div className="space-y-0">
			{items.map((event, index) => {
				const meta = eventMeta(event.event_type);
				const filtered = filterEventProps(event.sample_properties);
				const chips = [
					filtered.element_text && { label: String(filtered.element_text), variant: 'outline' },
					(event.sample_properties as any)?.page && { label: String((event.sample_properties as any).page).split('?')[0], variant: 'outline' }
				].filter(Boolean) as { label: string; variant: 'outline' | 'secondary' }[];

				const key = `${event.event_type}-${index}`;
				const isOpen = !!expanded[key];

				return (
					<div key={key} className="group flex flex-col border-b transition-all hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
						<div className="flex items-center justify-between p-2 py-3">
							<div className="flex items-center space-x-4 flex-1 min-w-0">
								<div className="flex-shrink-0">
									<meta.icon className="h-4 w-4" style={{ color: meta.color }} />
								</div>
								
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2 mb-0.5">
                    <div className="font-medium text-sm text-foreground truncate" title={meta.label}>
                      {meta.label}
                    </div>
                    {chips.slice(0, 1).map((c, i) => (
                      <Badge key={i} variant="outline" className="hidden sm:inline-flex text-[9px] px-1 py-0 font-bold uppercase tracking-wider h-4 bg-muted/50">
                        {truncate(c.label, 20)}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest truncate">
                    {event.event_type}
                  </div>
								</div>
							</div>

              <div className="flex items-center gap-6 shrink-0 text-right">
                <div className="text-right">
                  <div className="font-bold text-base leading-tight">
                    {formatNumber(event.count)}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                    Events
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0 rounded-md"
                    onClick={() => setExpanded(prev => ({ ...prev, [key]: !isOpen }))}
                  >
                    {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
						</div>

						{isOpen && (
              <div className="px-10 pb-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                {Object.keys(filtered).length > 0 && (
                  <div className="bg-muted/30 rounded-xl p-4 border shadow-inner">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Detailed Payload</span>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 px-3 text-[10px] font-bold gap-2 hover:bg-background" 
                        onClick={() => copyToClipboard(pretty(filtered))}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        COPY JSON
                      </Button>
                    </div>
                    <pre className="text-[11px] font-mono text-foreground overflow-x-auto selection:bg-primary/20">
                      <code>{pretty(filtered)}</code>
                    </pre>
                  </div>
                )}
                {event.description && (
                  <p className="text-xs text-muted-foreground italic bg-muted/20 p-2 rounded-lg border border-dashed">{event.description}</p>
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
