/**
 * The trigger and action vocabulary, as data.
 *
 * Two lookup maps that decide what an automation's steps are called and which icon each
 * gets. Out of the page because the builder, the list and any summary all have to agree
 * on these labels, and three copies would drift.
 */
import type React from 'react';
import {
  AlertTriangle,
  Bell,
  Clock,
  Coffee,
  ExternalLink,
  Eye,
  EyeOff,
  Feather,
  Globe,
  Highlighter,
  Info,
  LogOut,
  Megaphone,
  MessageSquare,
  MousePointer,
  Tag,
  Target,
  TrendingDown,
  UserCheck,
  Webhook,
  Zap
} from 'lucide-react';

export const TRIGGERS: Record<string, { label: string; icon: React.ElementType }> = {
  page_view:    { label: 'Page View',        icon: Globe },
  click:        { label: 'Element Click',    icon: MousePointer },
  scroll_depth: { label: 'Scroll Depth',     icon: TrendingDown },
  time_on_page: { label: 'Time on Page',     icon: Clock },
  exit_intent:  { label: 'Exit Intent',      icon: LogOut },
  inactivity:   { label: 'Inactivity',       icon: Coffee },
  rage_click:   { label: 'Rage Click',       icon: Zap },
  form_abandon: { label: 'Form Abandonment', icon: AlertTriangle },
  js_error:     { label: 'JS Error',         icon: AlertTriangle },
  tab_hidden:   { label: 'Tab Hidden',       icon: EyeOff },
  tab_visible:  { label: 'Tab Visible',      icon: Eye },
  custom_event: { label: 'Custom Event',     icon: Zap },
  identify:     { label: 'Identify',         icon: UserCheck },
  goal_reached: { label: 'Goal Reached',     icon: Target },
};

export const ACTIONS: Record<string, { label: string; icon: React.ElementType }> = {
  show_modal:          { label: 'Show Modal',          icon: MessageSquare },
  show_toast:          { label: 'Show Toast',          icon: Bell },
  show_banner:         { label: 'Show Banner',         icon: Megaphone },
  highlight_element:   { label: 'Highlight',           icon: Highlighter },
  show_tooltip:        { label: 'Show Tooltip',        icon: Info },
  personalize_content: { label: 'Personalize',         icon: Feather },
  redirect:            { label: 'Redirect',            icon: ExternalLink },
  tag_session:         { label: 'Tag Session',         icon: Tag },
  webhook:             { label: 'Webhook',             icon: Webhook },
  // Legacy action types still present on older rows.
  email:               { label: 'Email',               icon: Zap },
  banner:              { label: 'Banner',              icon: Megaphone },
  modal:               { label: 'Modal',               icon: MessageSquare },
  notification:        { label: 'Notification',        icon: Bell },
  hide_element:        { label: 'Hide Element',        icon: Eye },
  script:              { label: 'Script',              icon: Zap },
};

/** Success-rate colour. The old thresholds had no dark variants, so `text-green-600`
    on a dark table row was close to unreadable. */
