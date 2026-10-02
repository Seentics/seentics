'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useState } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiKeysPanel } from '@/components/developers/ApiKeysPanel';
import { ApiReferencePanel } from '@/components/developers/ApiReferencePanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { Input } from '@/components/ui/input';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { cn } from '@/lib/utils';
import { KeyRound, Terminal } from 'lucide-react';
import { CodeBlock } from '@/components/ui-blocks/CodeBlock';

/**
 * API keys and the public API reference now come from shared panels.
 *
 * What used to live here documented `Authorization: Bearer`, a hard-coded host, and four
 * scopes the backend has never accepted — all of it drifting because nothing tied it to
 * the server. Both panels are now driven by the API itself.
 */

export default function DevelopersPage() {
  const params = { websiteId: usePathSegment(1) ?? '' };
  const websiteId = params?.websiteId as string;

  return (
    <div className="mx-auto w-full max-w-[1200px] p-4 md:p-6 lg:p-8">
      <DashboardPageHeader
        websiteId={websiteId}
        title="Developers"
        description="Keys and endpoints for reading this site's data from your own tools."
      />

      <Tabs defaultValue="api-keys">
        <TabsList className="mb-6">
          <TabsTrigger value="api-keys" className="gap-1.5">
            <KeyRound className="h-3.5 w-3.5" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="reference" className="gap-1.5">
            <Terminal className="h-3.5 w-3.5" />
            API Reference
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys">
          <ApiKeysPanel websiteId={websiteId} />
        </TabsContent>

        <TabsContent value="reference">
          <ApiReferencePanel websiteId={websiteId} />
        </TabsContent>

      </Tabs>
    </div>
  );
}
