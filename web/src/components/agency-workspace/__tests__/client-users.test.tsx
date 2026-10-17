import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

const toasts = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }));

vi.mock('@/lib/api', async () => ({ default: { request: (await import('./harness')).mockRequest } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/agency/clients/c1' }));
vi.mock('sonner', () => ({ toast: toasts }));

import { list, renderWithClient, resetApi, route, sentTo } from './harness';
import { ClientUsersPanel } from '../ClientUsersPanel';

const BRANDING = { brand_name: 'Meridian', logo_url: '', primary_color: '#7c3aed', support_email: '', footer_text: '', hide_seentics: false, slug: 'meridian' as string | null };
const user = (id: string, email: string, status: 'invited' | 'active' | 'disabled', name = '') => ({
  id, email, name, status, invited_at: '2026-10-01T00:00:00Z', last_seen_at: status === 'active' ? '2026-10-15T00:00:00Z' : null,
});

let users: ReturnType<typeof user>[] = [];

beforeEach(() => {
  resetApi();
  vi.clearAllMocks();
  users = [user('u1', 'jess@acme.test', 'active', 'Jess'), user('u2', 'sam@acme.test', 'invited'), user('u3', 'old@acme.test', 'disabled')];
  route('GET', '/agency/clients/c1/users', () => list(users));
  route('GET', '/agency/branding', { data: BRANDING });
});

const panel = async () => {
  renderWithClient(<ClientUsersPanel clientId="c1" />);
  const el = await screen.findByTestId('client-users-panel');
  await within(el).findByText('jess@acme.test');
  return el;
};

describe('client users panel', () => {
  it('lists users with their status, and the sign-in link to copy', async () => {
    const el = await panel();
    expect(within(el).getByText('Jess')).toBeTruthy();
    expect(within(el).getByText('Active')).toBeTruthy();
    expect(within(el).getByText('Invited')).toBeTruthy();
    expect(within(el).getByText('Disabled')).toBeTruthy();
    expect((within(el).getByLabelText('Client sign-in link') as HTMLInputElement).value).toBe('https://seentics.com/signin?agency=meridian');
    expect(within(el).getByRole('button', { name: 'Copy sign-in link' })).toBeTruthy();
    // A disabled user gets no link.
    expect(within(el).queryByRole('button', { name: 'Resend link to old@acme.test' })).toBeNull();
    expect(sentTo('GET', '/agency/clients/c1/users')[0]!.params).toMatchObject({ limit: 100 });
  });

  it('hands out /signin on the agency’s own domain once it is active', async () => {
    route('GET', '/agency/domain', { data: { hostname: 'reports.meridian.test', state: 'active', dashboard_url: 'https://reports.meridian.test' } });
    const el = await panel();
    await waitFor(() => expect((within(el).getByLabelText('Client sign-in link') as HTMLInputElement).value).toBe('https://reports.meridian.test/signin'));
  });

  it('keeps the seentics.com address while the domain is not active', async () => {
    route('GET', '/agency/domain', { data: { hostname: 'reports.meridian.test', state: 'pending_dns', dashboard_url: null } });
    const el = await panel();
    expect((within(el).getByLabelText('Client sign-in link') as HTMLInputElement).value).toBe('https://seentics.com/signin?agency=meridian');
  });

  it('asks for a sign-in name in Branding & domain when there is none', async () => {
    route('GET', '/agency/branding', { data: { ...BRANDING, slug: null } });
    const el = await panel();
    const note = await within(el).findByTestId('signin-slug-missing');
    expect(within(note).getByRole('link', { name: 'Branding & domain' })).toHaveAttribute('href', '/agency/branding');
    expect(within(el).queryByLabelText('Client sign-in link')).toBeNull();
  });

  it('invites someone by email and name', async () => {
    route('POST', '/agency/clients/c1/users', req => {
      const created = user('u4', (req.data as { email: string }).email, 'invited', (req.data as { name?: string }).name);
      users = [...users, created];
      return { data: created };
    });
    const el = await panel();
    fireEvent.change(within(el).getByLabelText('Email'), { target: { value: 'new@acme.test' } });
    fireEvent.change(within(el).getByLabelText(/Name/), { target: { value: 'New Person' } });
    fireEvent.click(within(el).getByRole('button', { name: 'Invite' }));
    await waitFor(() => expect(sentTo('POST', '/agency/clients/c1/users')).toHaveLength(1));
    const sent = sentTo('POST', '/agency/clients/c1/users')[0]!;
    expect(sent.data).toEqual({ email: 'new@acme.test', name: 'New Person' });
    expect(sent.headers?.['Idempotency-Key']).toBeTruthy();
    expect(await within(el).findByText('Invite sent to new@acme.test')).toBeTruthy();
    expect(toasts.success).toHaveBeenCalledWith('Invite sent');
    expect(await within(el).findByText('New Person')).toBeTruthy();
  });

  it('refuses an invalid email without sending', async () => {
    const el = await panel();
    fireEvent.change(within(el).getByLabelText('Email'), { target: { value: 'nope' } });
    fireEvent.click(within(el).getByRole('button', { name: 'Invite' }));
    expect(await within(el).findByText('Enter a valid email address.')).toBeTruthy();
    expect(sentTo('POST', '/agency/clients/c1/users')).toHaveLength(0);
  });

  it('resends a sign-in link', async () => {
    route('POST', '/agency/clients/c1/users/u2/send-link', { data: { sent: true } });
    const el = await panel();
    fireEvent.click(within(el).getByRole('button', { name: 'Resend link to sam@acme.test' }));
    await waitFor(() => expect(sentTo('POST', '/agency/clients/c1/users/u2/send-link')).toHaveLength(1));
    expect(sentTo('POST', '/agency/clients/c1/users/u2/send-link')[0]!.headers?.['Idempotency-Key']).toBeTruthy();
    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith('Sign-in link sent'));
  });

  it('disables and enables a user', async () => {
    route('PATCH', '/agency/clients/c1/users/u1', req => ({ data: { ...users[0], ...(req.data as object) } }));
    route('PATCH', '/agency/clients/c1/users/u3', req => ({ data: { ...users[2], ...(req.data as object) } }));
    const el = await panel();
    fireEvent.click(within(el).getByRole('button', { name: 'Disable jess@acme.test' }));
    await waitFor(() => expect(sentTo('PATCH', '/agency/clients/c1/users/u1')).toHaveLength(1));
    expect(sentTo('PATCH', '/agency/clients/c1/users/u1')[0]!.data).toEqual({ status: 'disabled' });
    fireEvent.click(within(el).getByRole('button', { name: 'Enable old@acme.test' }));
    await waitFor(() => expect(sentTo('PATCH', '/agency/clients/c1/users/u3')).toHaveLength(1));
    expect(sentTo('PATCH', '/agency/clients/c1/users/u3')[0]!.data).toEqual({ status: 'active' });
  });

  it('removes a user after confirming', async () => {
    route('DELETE', '/agency/clients/c1/users/u2', () => { users = users.filter(u => u.id !== 'u2'); return null; });
    const el = await panel();
    fireEvent.click(within(el).getByRole('button', { name: 'Remove sam@acme.test' }));
    const dialog = await screen.findByRole('alertdialog').catch(() => screen.findByRole('dialog'));
    expect(dialog).toHaveTextContent('Remove sam@acme.test?');
    expect(sentTo('DELETE', '/agency/clients/c1/users/u2')).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(sentTo('DELETE', '/agency/clients/c1/users/u2')).toHaveLength(1));
    await waitFor(() => expect(within(el).queryByText('sam@acme.test')).toBeNull());
  });

  it('shows the API’s error when an invite fails', async () => {
    const { HttpError } = await import('./harness');
    route('POST', '/agency/clients/c1/users', () => new HttpError(422, 'validation_failed', 'That email is already a member.'));
    const el = await panel();
    fireEvent.change(within(el).getByLabelText('Email'), { target: { value: 'jess@acme.test' } });
    fireEvent.click(within(el).getByRole('button', { name: 'Invite' }));
    expect(await within(el).findByText('That email is already a member.')).toBeTruthy();
    expect(toasts.success).not.toHaveBeenCalled();
  });
});
