'use client';

import React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import AutomationBuilderContainer from '@/components/builder/WorkflowBuilder';

export default function AutomationBuilderPage() {
    return <AutomationBuilderContainer />;
}
