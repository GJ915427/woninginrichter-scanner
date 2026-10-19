import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, CreateProposalLineResponse } from '@/app/api/proposals/[id]/lines/route';

describe('POST /api/proposals/[id]/lines (BFF Endpoint LogicTrade Offertekoppeling)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Happy Path (HP-01): should validate payload and return 201 Created for Duette A00052469 in O26000735', async () => {
    const payload = {
      productId: 'A00052469',
      productCode: 'A00052469',
      productName: 'Duette® Shade 25mm SmartCord',
      configuration: {
        steps: [
          { id: 'BREEDTE', value: '1000' },
          { id: 'HOOGTE', value: '1500' },
          { id: 'MONTAGE', value: 'STANDAARD' },
          { id: 'BEDIENINGS_TYPE', value: 'STANDAARD' }
        ],
        errors: [],
        surcharges: { totalEur: 0, items: [] }
      },
      totalPriceEur: 249.50,
      notes: 'Maatwerkorder Duette woonkamer links'
    };

    const req = new Request('http://localhost:3000/api/proposals/O26000735/lines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'O26000735' }) });
    expect(res.status).toBe(201);

    const data = (await res.json()) as CreateProposalLineResponse;
    expect(data.success).toBe(true);
    expect(data.proposalId).toBe('O26000735');
    expect(data.totalPriceEur).toBe(249.50);
    expect(data.lineNumber).toBeGreaterThanOrEqual(1);
    expect(data.lineId).toBeTruthy();
    expect(typeof data.simulated).toBe('boolean');
  });

  it('Edge Case: should return 400 Bad Request when mandatory fields are missing', async () => {
    const invalidPayload = {
      productId: 'A00052469'
      // missing productCode, configuration, totalPriceEur
    };

    const req = new Request('http://localhost:3000/api/proposals/O26000735/lines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload)
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'O26000735' }) });
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Verplichte velden ontbreken');
  });

  it('Edge Case: should return 400 Bad Request when totalPriceEur is negative or not a finite number', async () => {
    const invalidPricePayload = {
      productId: 'A00052469',
      productCode: 'A00052469',
      productName: 'Duette',
      configuration: {
        steps: [],
        errors: [],
        surcharges: { totalEur: 0, items: [] }
      },
      totalPriceEur: -50.00
    };

    const req = new Request('http://localhost:3000/api/proposals/O26000735/lines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPricePayload)
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'O26000735' }) });
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Ongeldige totaalprijs');
  });

  it('Corner Case (CC-01): should reject configuration that contains blocking validation errors', async () => {
    const errorConfigPayload = {
      productId: 'A00052469',
      productCode: 'A00052469',
      productName: 'Duette TruFit Overbreedte',
      configuration: {
        steps: [
          { id: 'BREEDTE', value: '1350' },
          { id: 'MONTAGE', value: 'MONTAGE_TRUFIT' }
        ],
        errors: [
          {
            code: 'ERR_TRUFIT_WIDTH_EXCEEDED',
            message: 'TruFit montagesysteem ondersteunt een maximale breedte van 1280 mm',
            severity: 'error'
          }
        ],
        surcharges: { totalEur: 0, items: [] }
      },
      totalPriceEur: 199.00
    };

    const req = new Request('http://localhost:3000/api/proposals/O26000735/lines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorConfigPayload)
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'O26000735' }) });
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Configuratie bevat validatiefouten');
  });

  it('Corner Case: should support synchronous context.params for backwards compatibility', async () => {
    const payload = {
      productId: '0103960000',
      productCode: '0103960000',
      productName: 'Gordijn VLIET',
      configuration: {
        steps: [{ id: 'BREEDTE', value: '2000' }],
        errors: [],
        surcharges: { totalEur: 12.5, items: [] }
      },
      totalPriceEur: 125.00
    };

    const req = new Request('http://localhost:3000/api/proposals/114517/lines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const res = await POST(req, { params: { id: '114517' } as any });
    expect(res.status).toBe(201);

    const data = (await res.json()) as CreateProposalLineResponse;
    expect(data.success).toBe(true);
    expect(data.proposalId).toBe('114517');
  });
});
