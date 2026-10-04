import { DocPage } from '@/components/docs/DocsKit';
import { SdkGuideBody } from '@/components/docs/ObservabilityDocs';

export const metadata = {
  title: 'Node.js SDK · Seentics Observability docs',
  description: 'Install @seentics/observe and send logs, traces and metrics from a Node.js or Bun service with one ingest key.',
};

export default function Page() {
  return (
    <DocPage eyebrow="Observability" title="Node.js SDK" lead="Install @seentics/observe and send logs, traces and metrics from a Node.js or Bun service with one ingest key.">
      <SdkGuideBody id="node" />
    </DocPage>
  );
}
