'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
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
import { Code2, KeyRound, Layers, BookOpen, Copy, Check, Zap, Terminal } from 'lucide-react';
import { CodeBlock } from '@/components/ui-blocks/CodeBlock';

/**
 * API keys and the public API reference now come from shared panels.
 *
 * What used to live here documented `Authorization: Bearer`, a hard-coded host, and four
 * scopes the backend has never accepted — all of it drifting because nothing tied it to
 * the server. Both panels are now driven by the API itself.
 */

// ─── UI Blocks Tab ────────────────────────────────────────────────────────────

import { UIBlocksTab, DocsTab } from '@/components/developers/developer-tabs';

export default function DevelopersPage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;

  return (
    <div className="mx-auto w-full max-w-[1200px] p-4 md:p-6 lg:p-8">
      <DashboardPageHeader
        websiteId={websiteId}
        title="Developers"
        description="Keys, endpoints and SDKs for reading this site's data from your own tools."
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
          <TabsTrigger value="sdks" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            SDKs
          </TabsTrigger>
          <TabsTrigger value="ui-blocks" className="gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            UI Blocks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys">
          <ApiKeysPanel websiteId={websiteId} />
        </TabsContent>

        <TabsContent value="reference">
          <ApiReferencePanel websiteId={websiteId} />
        </TabsContent>

        <TabsContent value="ui-blocks">
          <UIBlocksTab websiteId={websiteId} />
        </TabsContent>

        <TabsContent value="sdks">
          <DocsTab websiteId={websiteId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
