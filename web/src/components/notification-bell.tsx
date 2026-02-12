'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Check, Trash2, MailOpen, AlertCircle, Info, Zap } from 'lucide-react';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  getUserNotifications, 
  markNotificationRead, 
  markAllNotificationsRead,
  UserNotification 
} from '@/lib/notifications-api';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

export function NotificationBell() {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      const data = await getUserNotifications();
      setNotifications(data || []);
      setUnreadCount((data || []).filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Refresh every minute
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark all read:', error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'alert': return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'automation': return <Zap className="h-4 w-4 text-orange-500" />;
      case 'info': return <Info className="h-4 w-4 text-blue-500" />;
      default: return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-primary text-white border-2 border-background animate-in zoom-in-50 duration-300">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-border/40 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300" align="end">
        <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/20">
          <h4 className="font-black text-sm uppercase tracking-widest">Notifications</h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-auto p-0 text-xs font-bold text-primary hover:bg-transparent"
              onClick={handleMarkAllRead}
            >
              Mark all as read
            </Button>
          )}
        </div>
        <Separator className="opacity-50" />
        <ScrollArea className="h-[350px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground italic">
              <MailOpen className="h-10 w-10 mb-4 opacity-20" />
              <p className="text-sm font-medium">All caught up!</p>
              <p className="text-xs">No new notifications.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((n) => (
                <div 
                  key={n.id} 
                  className={`p-4 flex gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer group relative ${!n.is_read ? 'bg-primary/5 dark:bg-primary/10' : ''}`}
                  onClick={() => !n.is_read && handleMarkRead(n.id)}
                >
                  <div className="mt-1 flex-shrink-0">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${!n.is_read ? 'bg-primary/10' : 'bg-slate-100 dark:bg-slate-800'}`}>
                      {getIcon(n.type)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-tight mb-1 ${!n.is_read ? 'font-bold' : 'font-medium text-slate-600 dark:text-slate-400'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                    <p className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-tight">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.is_read && (
                    <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-primary" />
                  )}
                  {n.link && (
                    <Link href={n.link} className="absolute inset-0 z-10" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <Separator className="opacity-50" />
        <Button variant="ghost" className="w-full h-11 rounded-none text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800/50">
          View all notifications
        </Button>
      </PopoverContent>
    </Popover>
  );
}
