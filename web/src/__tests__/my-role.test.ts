import { describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => get(...a) } }));

describe('getMyRole', () => {
  it('reads the role from the server\'s { data: { role } } answer', async () => {
    const { getMyRole } = await import('@/features/websites/api');
    get.mockResolvedValueOnce({ data: { data: { role: 'member' } } });
    expect(await getMyRole('11111111-1111-4111-8111-111111111111')).toBe('member');
  });

  it('is no role at all when the request fails, so nothing that changes data is offered', async () => {
    const { getMyRole } = await import('@/features/websites/api');
    get.mockRejectedValueOnce(new Error('403'));
    expect(await getMyRole('11111111-1111-4111-8111-111111111111')).toBe('');
  });
});
