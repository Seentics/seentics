import { DocPage } from '@/components/docs/DocsKit';
import { SdkGuideBody } from '@/components/docs/ObservabilityDocs';

export const metadata = {
  title: 'Go SDK · Seentics Observability docs',
  description: 'Add observe-go to a Go service for structured logs, traces, metrics, a net/http middleware and a log/slog handler.',
};

export default function Page() {
  return (
    <DocPage eyebrow="Observability" title="Go SDK" lead="Add observe-go to a Go service for structured logs, traces, metrics, a net/http middleware and a log/slog handler.">
      <SdkGuideBody id="go" />
    </DocPage>
  );
}
