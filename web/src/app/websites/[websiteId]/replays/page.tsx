import ReplaysOverview from '@/components/replays/ReplaysOverview';

export default function ReplaysPage({ params }: { params: { websiteId: string } }) {
  return (
    <div className="container mx-auto py-8 px-4 lg:px-8">
      <ReplaysOverview websiteId={params.websiteId} />
    </div>
  );
}
