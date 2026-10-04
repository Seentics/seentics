import { DocPage } from '@/components/docs/DocsKit';
import { SdkGuideBody } from '@/components/docs/ObservabilityDocs';

export const metadata = {
  title: 'Python SDK · Seentics Observability docs',
  description: 'Install seentics-observe to send logs, traces and metrics from a Python service.',
};

export default function Page() {
  return (
    <DocPage eyebrow="Observability" title="Python SDK" lead="Install seentics-observe to send logs, traces and metrics from a Python service.">
      <SdkGuideBody id="python" />
    </DocPage>
  );
}
