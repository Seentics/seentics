import { redirect } from 'next/navigation';

export default async function AutomationBuilderPage({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;
  redirect(`/websites/${websiteId}`);
}
