import { describe, expect, it } from 'vitest';
import {
  OrderIntakeService,
  mapLogicTradeOrderToRawInput,
} from '@/domain/orders/order-intake-service';

describe('Fase 2A: Order vs Quote intake classificatie', () => {
  it('classificeert /orders payload { id: 117282, number: "V26002086" } met { isQuote: false } als directe order (fsm_step 5, zonder quotation_number)', () => {
    const raw = mapLogicTradeOrderToRawInput(
      {
        id: 117282,
        number: 'V26002086',
        status: 'In behandeling',
        customerName: 'De Vries Wonen',
        city: 'Utrecht',
        totalAmount: 1450.5,
      },
      [
        {
          id: 901,
          lineNumber: 1,
          productCode: 'PRD-100',
          description: 'Overgordijn linnen',
          quantity: 2,
          unit: 'stuks',
          unitPrice: 725.25,
          totalPrice: 1450.5,
        },
      ],
      { isQuote: false }
    );

    expect(raw.id).toBe('117282');
    expect(raw.order_number).toBe('V26002086');
    expect(raw.quotation_number).toBeUndefined();
    expect(raw.fsm_step).toBe(5);
  });

  it('classificeert /quotes payload met { isQuote: true } en "Concept" status als offerte (fsm_step 2 en quotation_number gevuld)', () => {
    const raw = mapLogicTradeOrderToRawInput(
      {
        id: 99001,
        number: 'O26000501',
        status: 'Concept',
        customerName: 'Bakker Interieur',
      },
      [],
      { isQuote: true }
    );

    expect(raw.id).toBe('O26000501');
    expect(raw.order_number).toBe('O26000501');
    expect(raw.quotation_number).toBe('O26000501');
    expect(raw.fsm_step).toBe(2);
  });

  it('behoudt order_number en quotation_number in OrderIntakeService({ skipClientLookup: true }) zonder database-lookup', async () => {
    const service = new OrderIntakeService({ skipClientLookup: true });
    const raw = mapLogicTradeOrderToRawInput(
      {
        id: 117282,
        number: 'V26002086',
        status: 'In behandeling',
        customerName: 'De Vries Wonen',
      },
      [
        {
          id: 902,
          lineNumber: 1,
          description: 'Tekstregel zonder cataloguslookup',
          quantity: 1,
          unit: 'stuks',
          unitPrice: 100,
          totalPrice: 100,
        },
      ],
      { isQuote: false }
    );

    const bundle = await service.processOrderIntake(raw);

    expect(bundle.order.id).toBe('117282');
    expect(bundle.order.order_number).toBe('V26002086');
    expect(bundle.order.quotation_number).toBeUndefined();
    expect(bundle.order.fsm_step).toBe(5);
    expect(bundle.lines).toHaveLength(1);
    expect(bundle.lines[0].product_code).toBe('TEKST');
  });
});
