import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/building/route';

describe('BFF Building Route API Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 400 when pandId query param is missing', async () => {
    const request = new Request('http://localhost:8088/api/building');
    const response = await GET(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });
});
