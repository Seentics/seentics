'use client';

import { useParams } from 'next/navigation';
import { AIModeWorkspace } from '@/components/ai/AIModeWorkspace';

export default function AIModePage() {
  const params = useParams();
  return <AIModeWorkspace websiteId={params?.websiteId as string} />;
}
