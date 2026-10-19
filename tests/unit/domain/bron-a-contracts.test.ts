import { describe, it, expect } from 'vitest';
import {
  Configuration,
  ConfigurationStep,
  ConfigurationStepValue,
  ConfigurationStepType,
  ArticleImplementation,
  ConfigurationError,
  HunterDouglasStart,
  CurtainV2Start
} from '@/domain/configurator/bron-a-contracts';

describe('Bron A Contracts AST & Type Structure Tests', () => {
  it('should define ConfigurationStepType enum matching LogicTrade ConfigurationService OpenAPI', () => {
    expect(ConfigurationStepType.Numeric).toBe(100);
    expect(ConfigurationStepType.Select).toBe(200);
    expect(ConfigurationStepType.Boolean).toBe(300);
  });

  it('should construct valid ConfigurationStep with possible values and chargeAmount', () => {
    const value: ConfigurationStepValue = {
      key: 'MONTAGE_TRUFIT',
      value: 'TruFit® (Plakprofiel op het glas)',
      chargeAmount: 68.50,
      recommendedChargeAmount: 79.00,
      purchaseChargeAmount: 42.00,
      show: true,
      attributes: {
        mountingType: 'adhesive_profile',
        drillFree: true
      }
    };

    const step: ConfigurationStep = {
      id: 'MONTAGE',
      description: 'Montagewijze',
      code: 'MTG',
      type: ConfigurationStepType.Select,
      sequence: 3,
      show: true,
      enabled: true,
      required: true,
      value: 'MONTAGE_TRUFIT',
      possibleValues: [value],
      selectedValue: value
    };

    expect(step.id).toBe('MONTAGE');
    expect(step.possibleValues?.[0].chargeAmount).toBe(68.50);
    expect(step.selectedValue?.key).toBe('MONTAGE_TRUFIT');
  });

  it('should construct complete Configuration session object matching Bron A', () => {
    const session: Configuration = {
      configurationGuid: '11112222-3333-4444-5555-666677778888',
      articleCode: 'A00052469',
      articleDescription: 'Duette® shade',
      quantity: 1,
      steps: [],
      implementations: [
        {
          articleCode: 'A00052469',
          articleDescription: 'Duette® shade 25mm maatwerk',
          quantity: 1,
          price: 861.02,
          vatPercentage: 21
        },
        {
          articleCode: 'TF-KIT-25',
          articleDescription: 'TruFit montageset aluminium',
          quantity: 1,
          price: 68.50,
          vatPercentage: 21
        }
      ],
      errors: []
    };

    expect(session.articleCode).toBe('A00052469');
    expect(session.implementations?.length).toBe(2);
    expect(session.implementations?.[1].price).toBe(68.50);
  });
});
