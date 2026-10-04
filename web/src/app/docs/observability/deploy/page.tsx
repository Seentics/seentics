import { DocPage } from '@/components/docs/DocsKit';
import { NamingSection } from '@/components/docs/ObservabilityDocs';

export const metadata = {
  title: 'Run it on a VM, Docker or Kubernetes · Seentics Observability docs',
  description: 'Name your services and servers so one ingest key shows each one separately — on a bare VM, Docker, Docker Compose or Kubernetes.',
};

export default function Page() {
  return (
    <DocPage
      eyebrow="Observability"
      title="Services, servers and deployment"
      lead="One ingest key serves your whole project. Here is what to set so each service and server appears on its own — on a bare VM, in Docker, Docker Compose or Kubernetes."
    >
      <NamingSection />
    </DocPage>
  );
}
