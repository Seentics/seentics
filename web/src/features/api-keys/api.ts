import api from '@/lib/api';
import type { ApiCatalogue } from './types';

/**
 * The public API reference.
 *
 * Fetched rather than hard-coded: the server owns the catalogue and a test there compares it
 * against the router, so a page built from it cannot document an endpoint that does not exist
 * or miss one that does. (Keys are account keys, in `features/agency`.)
 */

export const apiKeyKeys = {
  catalogue: ['api-catalogue'] as const,
};

export async function fetchApiCatalogue(): Promise<ApiCatalogue> {
  const res = await api.get('/raw/v1/catalogue');
  return res.data as ApiCatalogue;
}
