import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FormSubmissions } from '@/components/automations/submissions/FormSubmissions';
import { FormDestinations } from '@/components/automations/FormDestinations';
import { SubmissionRow } from '@/components/automations/submissions/SubmissionRow';
import type { Submission } from '@/features/leads/types';
import { DeliveryLog } from '@/components/integrations/DeliveryLog';
import { DestinationCard } from '@/components/integrations/DestinationCard';
import { demoConnections, demoDeliveries } from '@/lib/demo/integrations';
import { defaultLeadForm } from '@/lib/lead-form';

vi.mock('@/lib/path-segment', () => ({ usePathSegment: () => 'demo' }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

afterEach(cleanup);

const wrap = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

describe('FormSubmissions (demo)', () => {
  const form = { hasForm: true, hasRewards: true, destinations: undefined };

  it('shows exactly four stat cards, the submissions, and where each was sent', async () => {
    wrap(<FormSubmissions websiteId="demo" automationId="demo-auto-5" form={form} />);
    expect(await screen.findByText('ava.martin@example.com')).toBeInTheDocument();
    for (const label of ['Submissions', 'Last 7 days', 'Last 30 days', 'Prizes won']) {
      expect(screen.getAllByText(label, { exact: true }).length).toBeGreaterThan(0);
    }
    expect(screen.getByText('SPIN20')).toBeInTheDocument();
    expect(screen.getAllByText(/Leads to Google Sheets: delivered/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Newsletter audience: retrying/i)).toBeInTheDocument();
  });

  it('swaps the fourth card for the top variant on a form with no prize', async () => {
    wrap(<FormSubmissions websiteId="demo" automationId="demo-auto-6" form={{ ...form, hasRewards: false }} />);
    expect(await screen.findByText('Top variant')).toBeInTheDocument();
    expect(screen.queryByText('Prizes won')).not.toBeInTheDocument();
  });

  it('searches, and says so when nothing matches', async () => {
    wrap(<FormSubmissions websiteId="demo" automationId="demo-auto-5" form={form} />);
    await screen.findByText('ava.martin@example.com');
    fireEvent.change(screen.getByLabelText('Search submissions'), { target: { value: 'zzz' } });
    expect(await screen.findByText('No submissions match')).toBeInTheDocument();
  });

  it('never offers to delete on the demo site', async () => {
    wrap(<FormSubmissions websiteId="demo" automationId="demo-auto-5" form={form} />);
    await screen.findByText('ava.martin@example.com');
    expect(screen.queryByLabelText(/Delete submission/)).not.toBeInTheDocument();
  });

  it('explains where submissions are when nothing receives them', async () => {
    // The demo's destinations all exist; routing to an id that does not makes the warning appear.
    wrap(<FormSubmissions websiteId="demo" automationId="demo-auto-5" form={{ ...form, destinations: ['gone'] }} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/kept here for 90 days but sent nowhere/);
  });
});

describe('FormDestinations', () => {
  it('lists the site destinations when choosing, and edits the form', async () => {
    const onChange = vi.fn();
    wrap(<FormDestinations form={{ ...defaultLeadForm(), destinations: [demoConnections()[0]!.id] }} onChange={onChange} />);
    const boxes = await screen.findAllByRole('checkbox');
    expect(boxes).toHaveLength(3);
    expect(boxes[0]).toBeChecked();
    expect(boxes[1]).not.toBeChecked();
    fireEvent.click(boxes[1]!);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ destinations: [demoConnections()[0]!.id, demoConnections()[1]!.id] }));
  });

  it('defaults to every destination, and switches to a chosen list on request', async () => {
    const onChange = vi.fn();
    wrap(<FormDestinations form={defaultLeadForm()} onChange={onChange} />);
    expect(await screen.findByText(/Destinations you add later are included/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Choose destinations' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ destinations: demoConnections().map((c) => c.id) }));
  });
});

describe('DeliveryLog', () => {
  it('offers Retry only on a failed delivery, and says when a pending one is next tried', () => {
    const onRetry = vi.fn();
    render(<DeliveryLog deliveries={demoDeliveries()} onRetry={onRetry} now={Date.parse('2025-03-31T12:00:00.000Z')} />);
    const failed = demoDeliveries({ status: 'failed' }).length;
    expect(screen.getAllByRole('button', { name: /Retry/ })).toHaveLength(failed);
    expect(screen.getByText(/next try in 2m/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Retry/ })[0]!);
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('shows no actions to a viewer', () => {
    render(<DeliveryLog deliveries={demoDeliveries()} />);
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument();
  });

  it('has an empty state', () => {
    render(<DeliveryLog deliveries={[]} />);
    expect(screen.getByText(/Nothing sent yet/)).toBeInTheDocument();
  });
});

describe('DestinationCard', () => {
  const [healthy, retrying, paused] = demoConnections();
  const noop = () => {};
  const card = (c = healthy!, canEdit = true) =>
    render(<DestinationCard connection={c} provider={undefined} canEdit={canEdit} onEdit={noop} onTest={noop} onToggle={noop} onRemove={noop} />);

  it('shows the name, status and the credential only as a hint', () => {
    card();
    expect(screen.getByText('Leads to Google Sheets')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('…/8f3a2c')).toBeInTheDocument();
  });

  it('shows how many submissions are waiting, and why a paused one stopped', () => {
    card(retrying);
    expect(screen.getByText('Retrying')).toBeInTheDocument();
    cleanup();
    card(paused);
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText(/Paused after repeated failures/)).toBeInTheDocument();
    expect(alert).toHaveTextContent('410');
  });

  it('is read-only for a viewer', () => {
    card(healthy, false);
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});

describe('SubmissionRow', () => {
  const sub: Submission = {
    id: 's1', email: 'a@example.com', name: 'A', phone: '', consent: true, fields: {}, prize: null, variant: null,
    page_url: 'https://example.com/', referrer: '', created_at: '2026-10-01T00:00:00Z',
    deliveries: [
      { id: 'd-failed', connection_id: 'c1', connection_name: 'Slack', provider: 'zapier', status: 'failed', attempt_count: 6, error: 'gone', completed_at: null },
      { id: 'd-ok', connection_id: 'c2', connection_name: 'CRM', provider: 'zapier', status: 'success', attempt_count: 1, error: null, completed_at: null },
    ],
  };

  it('retries a failed delivery by its own id, and only a failed one', () => {
    const onRetry = vi.fn();
    render(<ul><SubmissionRow submission={sub} canDelete={false} onDelete={() => {}} onRetry={onRetry} /></ul>);
    expect(screen.getAllByRole('button', { name: /Retry sending/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Retry sending to Slack' }));
    expect(onRetry).toHaveBeenCalledWith('d-failed');
  });

  it('offers no retry to someone who cannot change anything', () => {
    render(<ul><SubmissionRow submission={sub} canDelete={false} onDelete={() => {}} /></ul>);
    expect(screen.queryByRole('button', { name: /Retry sending/ })).not.toBeInTheDocument();
  });
});
