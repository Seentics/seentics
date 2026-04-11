import { redirect } from 'next/navigation';

export default async function DevelopersRedirectPage({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  redirect(`/websites/${websiteId}/settings/developers`);
}
