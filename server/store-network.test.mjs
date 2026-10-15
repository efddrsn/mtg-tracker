import { describe, expect, it, vi } from 'vitest';
vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }));
import { lookup } from 'node:dns/promises';
import { publicStoreUrl } from './store-network.mjs';
describe('public storefront guard', () => {
  it('rejects credentials, non-HTTPS, literals, localhost and custom ports', async () => {
    for (const url of ['http://shop.com', 'https://127.0.0.1', 'https://[::1]', 'https://localhost', 'https://user:pass@shop.com', 'https://shop.com:3000']) {
      await expect(publicStoreUrl(url)).rejects.toThrow();
    }
  });
  it('rejects hostnames resolving to private or reserved networks', async () => {
    for (const address of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '172.20.0.1', '192.168.1.1', '100.64.0.1', '0.0.0.0', '224.1.1.1']) {
      lookup.mockResolvedValue([{ address, family: 4 }]);
      await expect(publicStoreUrl('https://shop.com')).rejects.toThrow();
    }
  });
  it('returns validated public addresses for connection pinning', async () => {
    lookup.mockResolvedValue([{ address: '104.21.1.1', family: 4 }]);
    expect((await publicStoreUrl('https://shop.com')).addresses[0].address).toBe('104.21.1.1');
  });
});
