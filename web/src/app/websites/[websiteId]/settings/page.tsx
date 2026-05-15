'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SettingsPage() {
  const params = useParams();
  const router = useRouter();
  const websiteId = params?.websiteId as string;

  useEffect(() => {
    router.replace(`/websites/${websiteId}/settings/websites`);
  }, [websiteId, router]);

  return null;
}
