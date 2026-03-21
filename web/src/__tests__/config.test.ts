import { describe, it, expect } from 'vitest';
import { config, getApiUrl, getFullUrl } from '@/lib/config';

describe('Config', () => {
  it('should have default values', () => {
    expect(config.apiVersion).toBe('v1');
    expect(config.version).toBeDefined();
  });

  it('getApiUrl should build correct URLs on server side', () => {
    // Server-side: uses apiBaseUrl
    const url = getApiUrl('/test');
    expect(url).toContain('/api/v1/test');
  });

  it('getFullUrl should build correct URLs', () => {
    const url = getFullUrl('/dashboard');
    expect(url).toContain('/dashboard');
  });
});
