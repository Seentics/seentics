'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getWebsites } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { AddWebsiteModal } from '@/components/websites/AddWebsiteModal';
import { Loader2 } from 'lucide-react';

export default function WebsitesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    const redirectToWebsite = async () => {
      if (!user) {
        // Not logged in, redirect to login
        router.push('/login');
        return;
      }

      try {
        const websites = await getWebsites();
        
        if (websites.length > 0) {
          // Redirect to first website
          router.push(`/websites/${websites[0].id}`);
        } else {
          // No websites, show add modal
          setIsLoading(false);
          setShowAddModal(true);
        }
      } catch (error) {
        console.error('Error fetching websites:', error);
        // On error, show add modal
        setIsLoading(false);
        setShowAddModal(true);
      }
    };

    redirectToWebsite();
  }, [user, router]);

  const handleWebsiteAdded = (websiteId: string) => {
    // Redirect to the newly added website
    router.push(`/websites/${websiteId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading your websites...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Welcome to Seentics</h1>
          <p className="text-muted-foreground mb-4">Add your first website to get started</p>
        </div>
      </div>
      
      <AddWebsiteModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSuccess={handleWebsiteAdded}
      />
    </>
  );
}