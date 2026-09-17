'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SettingsPage() {
  const params = { websiteId: usePathSegment(1) ?? '' };
  const router = useRouter();
  const websiteId = params?.websiteId as string;

  useEffect(() => {
    router.replace(`/websites/${websiteId}/settings/websites`);
  }, [websiteId, router]);

  return null;
}
