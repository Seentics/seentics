import { redirect } from 'next/navigation';

export default async function AutomationDetailsPage({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;
  redirect(`/websites/${websiteId}`);
}
