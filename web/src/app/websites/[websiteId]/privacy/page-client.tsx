'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PrivacySettingsComponent } from '@/components/settings/PrivacySettingsComponent';
import { EditGuard, ReadOnlyNote } from '@/features/client-mode/ClientMode';
import { ReportPage } from '@/components/ui/linear-list';
import { isEnterprise } from '@/lib/features';
import { useT } from '@/lib/i18n';

export default function PrivacyPage() {
    const params = { websiteId: usePathSegment(1) ?? '' };
    const websiteId = params?.websiteId as string;
    const router = useRouter();
    const t = useT().settings.privacyPage;

    useEffect(() => {
        if (!isEnterprise) {
            router.replace(`/websites/${websiteId}`);
        }
    }, [router, websiteId]);

    if (!isEnterprise) return null;

    return (
        <ReportPage
          title={t.title}
          description={t.description}
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
