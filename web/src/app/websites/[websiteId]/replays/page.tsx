import ReplaysOverview from '@/components/replays/ReplaysOverview';

export default function ReplaysPage({ params }: { params: { websiteId: string } }) {
  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <ReplaysOverview websiteId={params.websiteId} />
    </div>
  );
}
