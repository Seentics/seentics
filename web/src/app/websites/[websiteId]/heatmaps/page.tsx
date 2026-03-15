import { redirect } from 'next/navigation';

export default async function HeatmapsPage({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;
  redirect(`/websites/${websiteId}`);
}
