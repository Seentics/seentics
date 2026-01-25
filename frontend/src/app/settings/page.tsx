'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getWebsites, Website } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { 
  Globe, 
  ExternalLink, 
  Settings, 
  BarChart3, 
  Trash2, 
  Search,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default function WebsitesManagement() {
  redirect('/settings/websites');
  return null;
}
