'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PrivacySettingsComponent } from '@/components/settings/PrivacySettingsComponent';
import { EditGuard, ReadOnlyNote } from '@/features/client-mode/ClientMode';
import { ShieldCheck } from 'lucide-react';
import { ReportPage } from '@/components/ui/linear-list';
import { isEnterprise } from '@/lib/features';

export default function PrivacyPage() {
    const params = { websiteId: usePathSegment(1) ?? '' };
    const websiteId = params?.websiteId as string;
    const router = useRouter();

    useEffect(() => {
        if (!isEnterprise) {
            router.replace(`/websites/${websiteId}`);
        }
    }, [router, websiteId]);

    if (!isEnterprise) return null;

    return (
        <ReportPage
          icon={<ShieldCheck />}
          title="Privacy & Compliance"
          description="Configure data protection and GDPR compliance for your website."
          websiteId={websiteId}
          bodyClassName="space-y-4"
        >

            <ReadOnlyNote feature="privacy" />
            <EditGuard feature="privacy" mode="disable">
                <PrivacySettingsComponent websiteId={websiteId} />
            </EditGuard>
        </ReportPage>
    );
}
