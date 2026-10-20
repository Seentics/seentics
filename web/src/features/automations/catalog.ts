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
  Filter,
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
import { automationsEn, type AutomationsMessages } from '@/lib/i18n/messages/automations-en';

/** Each trigger's icon. Names come from the `automations.catalog` messages, by the same key. */
export const TRIGGERS: Record<string, { icon: React.ElementType }> = {
  page_view:    { icon: Globe },
  click:        { icon: MousePointer },
  scroll_depth: { icon: TrendingDown },
  time_on_page: { icon: Clock },
  exit_intent:  { icon: LogOut },
  inactivity:   { icon: Coffee },
  rage_click:   { icon: Zap },
  form_abandon: { icon: AlertTriangle },
  js_error:     { icon: AlertTriangle },
  tab_hidden:   { icon: EyeOff },
  tab_visible:  { icon: Eye },
  custom_event: { icon: Zap },
  identify:     { icon: UserCheck },
  funnel:       { icon: Filter },
  goal_reached: { icon: Target },
};

/**
 * Each action's icon. The table's chip uses the short name (`catalog.actions`), the detail
 * view the full one (`catalog.actionsLong`) where they differ.
 */
export const ACTIONS: Record<string, { icon: React.ElementType }> = {
  show_modal:          { icon: MessageSquare },
  show_toast:          { icon: Bell },
  show_banner:         { icon: Megaphone },
  highlight_element:   { icon: Highlighter },
  show_tooltip:        { icon: Info },
  personalize_content: { icon: Feather },
  redirect:            { icon: ExternalLink },
  tag_session:         { icon: Tag },
  webhook:             { icon: Webhook },
  // Legacy action types still present on older rows.
  email:               { icon: Zap },
  banner:              { icon: Megaphone },
  modal:               { icon: MessageSquare },
  notification:        { icon: Bell },
  hide_element:        { icon: Eye },
  script:              { icon: Zap },
};

type CatalogMessages = AutomationsMessages['catalog'];

/**
 * Lookups with a sensible answer for a key the catalog does not know.
 *
 * An automation can carry a trigger this build has never heard of — an older definition,
 * or a newer one after a rollback — and showing the raw key beats rendering nothing.
 */
export function triggerLabel(key: string, t: CatalogMessages = automationsEn.catalog): string {
  return (t.triggers as Record<string, string>)[key] ?? key;
}

/** The detail view's full name, falling back to the table's short one. */
export function actionLabel(key: string, long = false, t: CatalogMessages = automationsEn.catalog): string {
  const short = (t.actions as Record<string, string>)[key];
  if (!short) return key;
  return long ? (t.actionsLong as Record<string, string>)[key] ?? short : short;
}

export function triggerIcon(key: string): React.ElementType | undefined {
  return TRIGGERS[key]?.icon;
}

export function actionIcon(key: string): React.ElementType | undefined {
  return ACTIONS[key]?.icon;
}
