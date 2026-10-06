import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EpOnlineClient } from '@/data/ep-online/ep-online-client';

describe('EpOnlineClient Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should parse energy label and insulation characteristics when available', async () => {
    const mockResponse = {
      label: 'A',
      glazingType: 'HR++',
      roofInsulated: true,
      wallInsulated: true,
    };

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const client = new EpOnlineClient();
    const result = await client.getEnergyData('6247AD', 153, 'b');

    expect(result.label).toBe('A');
    expect(result.glazingType).toBe('HR++');
  });

  it('should gracefully return unknown fallback when EP-online returns 404', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    const client = new EpOnlineClient();
    const result = await client.getEnergyData('9999ZZ', 1);

    expect(result.label).toBe('ONBEKEND');
    expect(result.glazingType).toBe('ONBEKEND');
  });
});
