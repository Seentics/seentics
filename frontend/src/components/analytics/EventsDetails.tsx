'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, FileDown, FormInput, MousePointerClick, PlayCircle, Search } from 'lucide-react';
import React from 'react';

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
			<div className="text-center py-6 text-muted-foreground text-sm">No events to display</div>
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

	// Exclude generic context fields; prefer event-specific properties
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
		// Hard-trim very long element_class
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
		if (t.includes('form_submit')) return { label: 'Form Submit', icon: <FormInput className="w-4 h-4" />, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };
		if (t.includes('external_link')) return { label: 'External Link', icon: <ExternalLink className="w-4 h-4" />, color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' };
		if (t.includes('file_download')) return { label: 'File Download', icon: <FileDown className="w-4 h-4" />, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
		if (t.includes('search')) return { label: 'Search', icon: <Search className="w-4 h-4" />, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' };
		if (t.includes('video')) return { label: 'Video', icon: <PlayCircle className="w-4 h-4" />, color: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300' };
		if (t.includes('conversion')) return { label: 'Conversion Click', icon: <MousePointerClick className="w-4 h-4" />, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' };
		return { label: type.replace(/_/g, ' '), icon: <MousePointerClick className="w-4 h-4" />, color: 'bg-muted text-foreground' };
	};

	return (
		<div className="space-y-3">
			{items.map((event, index) => {
				const meta = eventMeta(event.event_type);
				const filtered = filterEventProps(event.sample_properties);
				const chips = [
					filtered.element_text && { label: String(filtered.element_text), variant: 'outline' },
					filtered.element_type && { label: String(filtered.element_type), variant: 'secondary' },
					filtered.element_id && filtered.element_id !== 'no-id' && { label: `#${String(filtered.element_id)}`, variant: 'outline' },
					(event.sample_properties as any)?.page && { label: String((event.sample_properties as any).page), variant: 'outline' }
				].filter(Boolean) as { label: string; variant: 'outline' | 'secondary' }[];

				const key = `${event.event_type}-${index}`;
				const isOpen = !!expanded[key];

				return (
					<div key={key} className="p-3 sm:p-4 bg-muted/30 rounded-lg border border-border">
						<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-2">
							<div className="flex items-center gap-2 sm:gap-3 min-w-0">
								<div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${meta.color}`}>
									{meta.icon}
								</div>
								<div className="min-w-0 flex-1">
									<div className="text-sm font-medium text-foreground truncate">{meta.label}</div>
									{event.description && (
										<div className="text-xs text-muted-foreground truncate">{event.description}</div>
									)}
									<div className="mt-1 flex flex-wrap gap-1">
										{chips.map((c, i) => (
											<Badge key={i} variant={c.variant as any} className="text-[10px] px-2 py-0.5 max-w-[14rem] truncate">
												{truncate(c.label, 22)}
											</Badge>
										))}
									</div>
								</div>
							</div>
							<div className="text-right flex-shrink-0">
								<div className="text-base font-semibold text-foreground">{event.count.toLocaleString()}</div>
							</div>
						</div>

						{event.common_properties && event.common_properties.length > 0 && (
							<div className="mb-2">
								<div className="text-[11px] font-medium text-muted-foreground mb-1">Common Properties</div>
								<div className="flex flex-wrap gap-1 sm:gap-2">
									{event.common_properties.map((prop, i) => (
										<Badge key={i} variant="outline" className="text-[10px] px-2 py-1">{prop}</Badge>
									))}
								</div>
							</div>
						)}

						{/* Details: collapsible JSON */}
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<div className="text-[11px] font-medium text-muted-foreground">Sample Properties</div>
								<div className="flex items-center gap-2">
									<Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => copyToClipboard(pretty(filtered))}>Copy</Button>
									<Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setExpanded(prev => ({ ...prev, [key]: !isOpen }))}>{isOpen ? 'Hide' : 'Show'} JSON</Button>
								</div>
							</div>
							{isOpen &&
								<pre className="text-xs bg-muted/50 p-2 sm:p-3 rounded border border-border overflow-x-auto"><code>{pretty(filtered)}</code></pre>
							}
						</div>
					</div>
				);
			})}
		</div>
	);
};

export default EventsDetails;
