import ReplaysOverview from '@/components/replays/ReplaysOverview';

export default async function ReplaysPage({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;
  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <ReplaysOverview websiteId={websiteId} />
    </div>
  );
}
