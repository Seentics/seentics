import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { request } }));

import {
  addClientWebsite, agencyError, deleteClient, domainErrorMessage, errorMessage, fillPath, getDomain, getSetup, listWebsites, setClientFeatures, updateWebsite,
} from '../api';
import { isAgencyPlanRequired } from '../plan';

const fail = (status: number, code: string, message = code) =>
  Object.assign(new Error(message), { response: { status, data: { error: { code, message, request_id: 'r1' } } } });

beforeEach(() => request.mockReset());

describe('agency api client', () => {
  it('fills and encodes path parameters, and refuses a missing one', () => {
    expect(fillPath('/agency/clients/:id/websites', { id: 'a b' })).toBe('/agency/clients/a%20b/websites');
    expect(() => fillPath('/agency/clients/:id')).toThrow(/id/);
  });

  it('sends lists with only the filters that are set', async () => {
    request.mockResolvedValue({ data: { data: [], page: { next_cursor: null, has_more: false } } });
    await listWebsites({ unassigned: true, q: '' }, 'cur');
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET', url: '/agency/websites', params: { unassigned: true, cursor: 'cur', limit: 50 }, headers: undefined,
    }));
  });

  it('moves a website with client_id null, and deletes a client with confirm=true', async () => {
    request.mockResolvedValue({ data: { data: {} } });
    await updateWebsite('w1', { client_id: null });
    expect(request.mock.calls[0]![0]).toMatchObject({ method: 'PATCH', url: '/agency/websites/w1', data: { client_id: null } });
    request.mockResolvedValue({ data: '' });
    await deleteClient('c1');
    expect(request.mock.calls[1]![0]).toMatchObject({ method: 'DELETE', url: '/agency/clients/c1', params: { confirm: true } });
  });

  it('puts the whole features matrix and returns it', async () => {
    request.mockResolvedValue({ data: { data: { features: { overview: 'view' } } } });
    const out = await setClientFeatures('c1', { overview: 'view' } as never);
    expect(out).toEqual({ overview: 'view' });
    expect(request.mock.calls[0]![0]).toMatchObject({ method: 'PUT', url: '/agency/clients/c1/features', data: { features: { overview: 'view' } } });
  });

  it('counts setup progress from the server\'s { steps }', async () => {
    request.mockResolvedValue({ data: { data: { steps: [{ id: 'branding', done: true }, { id: 'first_client', done: false }] } } });
    expect(await getSetup()).toEqual({ steps: [{ id: 'branding', done: true }, { id: 'first_client', done: false }], completed: 1, total: 2 });
  });

  it('reads a client website\'s { website, install } as the site with its install', async () => {
    request.mockResolvedValue({ data: { data: { website: { id: 'w1', name: 'Shop' }, install: { website_id: 'w1' } } } });
    expect(await addClientWebsite('c1', { name: 'Shop', url: 'https://shop.test' })).toEqual({ id: 'w1', name: 'Shop', install: { website_id: 'w1' } });
    expect(request.mock.calls[0]![0]).toMatchObject({ method: 'POST', url: '/agency/clients/c1/websites' });
  });

  it('returns null when there is no domain', async () => {
    request.mockResolvedValue({ data: { data: null } });
    expect(await getDomain()).toBeNull();
  });

  it('reads the error envelope', () => {
    expect(agencyError(fail(422, 'validation_failed', 'name is required'))).toEqual({ status: 422, code: 'validation_failed', message: 'name is required', details: undefined });
    expect(errorMessage(fail(429, 'rate_limited'))).toMatch(/Too many requests/);
    expect(errorMessage(fail(409, 'idempotency_conflict'))).toMatch(/already sent/);
    expect(errorMessage(new Error('Network Error'))).toBe('Network Error');
    expect(domainErrorMessage(fail(503, 'provider_error'))).toMatch(/unavailable/);
    expect(domainErrorMessage(fail(409, 'conflict'))).toMatch(/already in use/);
    expect(domainErrorMessage(fail(502, 'provider_error'))).toMatch(/certificate provider/);
  });

  it('recognises agency_plan_required in the new envelope', () => {
    expect(isAgencyPlanRequired(fail(403, 'agency_plan_required'))).toBe(true);
    expect(isAgencyPlanRequired(fail(403, 'forbidden'))).toBe(false);
  });
});
