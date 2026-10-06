import { beforeAll, beforeEach, expect, it, mock } from 'bun:test';
import bcrypt from 'bcryptjs';
import { fakeDbModule, queueSelectRows, resetDb, updates } from '../../../app/tests/helpers/fake-db';
mock.module('../../../db', fakeDbModule);
let verify: typeof import('../services/api-key-verification.service').verifyWebsiteApiKey;
beforeAll(async () => { verify = (await import('../services/api-key-verification.service')).verifyWebsiteApiKey; });
beforeEach(resetDb);
it('verifies every request but writes its last-used timestamp only once per minute', async () => {
  const key = `st_${crypto.randomUUID()}`, websiteId = crypto.randomUUID();
  const row = { id: crypto.randomUUID(), websiteId, keyPrefix: key.slice(0, 16), keyHash: await bcrypt.hash(key, 4), scopes: ['analytics:read'] };
  queueSelectRows([row]);
  const results = await Promise.all(Array.from({ length: 20 }, () => verify(key, websiteId)));
  expect(results.every(result => result?.apiKeyId === row.id)).toBe(true);
  expect(updates).toHaveLength(1);
  expect(await verify(`${key}-wrong`, websiteId)).toBeNull();
  expect(await verify(key, crypto.randomUUID())).toBeNull();
  expect(updates).toHaveLength(1);
});
