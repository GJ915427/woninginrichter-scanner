import { describe, it, expect } from 'vitest';
import {
  ConclaafRulesEngine,
  determineProductCategory
} from '@/domain/configurator/conclaaf-rules-engine';
import { CatalogCompatibilityRunner } from '@/domain/configurator/catalog-compatibility-runner';
import { SearchResultItem } from '@/types/product';
import { ConfigurationStepType } from '@/domain/configurator/bron-a-contracts';

describe('Catalog Compatibility & Category Census Unit Tests', () => {
  describe('Hierarchical Category SSOT & Semantic Collision Prevention (DEF-05)', () => {
    it('should classify Vloerlamp as algemeen and NOT as vloeren', () => {
      const item: SearchResultItem = {
        id: 35007,
        code: '35007ZWA',
        name: 'Vloerlamp movie tripot 3l Coco Maison',
        salesGroup: 'Banken',
        supplierName: 'Coco Maison',
        groups: ['Verlichting', 'Vloerlampen'],
        salesPrice: 199.00
      };
      expect(determineProductCategory(item)).toBe('algemeen');
    });

    it('should classify Rolgordijn and Vouwgordijn as raamdecoratie and NOT as gordijnen', () => {
      const rolgordijn: SearchResultItem = {
        id: 101,
        code: 'ROL01',
        name: 'Rolgordijn cassette XL',
        salesGroup: 'Raamdecoratie',
        supplierName: 'Luxaflex',
        groups: ['Raamdecoratie', 'Rolgordijnen']
      };
      const vouwgordijn: SearchResultItem = {
        id: 102,
        code: 'VOUW01',
        name: 'Vouwgordijn linnen collectie',
        salesGroup: 'Raamdecoratie',
        supplierName: 'Bece',
        groups: ['Raamdecoratie', 'Vouwgordijnen']
      };
      expect(determineProductCategory(rolgordijn)).toBe('raamdecoratie');
      expect(determineProductCategory(vouwgordijn)).toBe('raamdecoratie');
    });

    it('should classify Bank with "stof" in name as algemeen and NOT as gordijnen', () => {
      const bank: SearchResultItem = {
        id: 201,
        code: 'BNK01',
        name: 'Bank 3-zits in Stof creme Brioni',
        salesGroup: 'Banken',
        supplierName: 'Het Anker',
        groups: ['Zitmeubelen', 'Banken']
      };
      expect(determineProductCategory(bank)).toBe('algemeen');
    });

    it('should classify Gordijnen (nog koppelen) as gordijnen', () => {
      const gordijn: SearchResultItem = {
        id: 301,
        code: 'BRU80',
        name: 'Brush 80 brown',
        salesGroup: 'Gordijnen (nog koppelen)',
        supplierName: 'Kobe',
        groups: ['Gordijnstoffen']
      };
      expect(determineProductCategory(gordijn)).toBe('gordijnen');
    });

    it('should classify Vinyl, Karpetten and Naaldvilt as vloeren', () => {
      const vinyl: SearchResultItem = {
        id: 401,
        code: 'VIN01',
        name: 'Novilon Viva Vinyl',
        salesGroup: 'Vinyl (nog te koppelen)',
        supplierName: 'Forbo',
        groups: ['Vloeren', 'Vinyl']
      };
      const karpet: SearchResultItem = {
        id: 402,
        code: 'KAR01',
        name: 'Karpet Vintage Wol 200x300',
        salesGroup: 'Karpetten',
        supplierName: 'Brinker',
        groups: ['Vloerkleden']
      };
      const naaldvilt: SearchResultItem = {
        id: 403,
        code: 'NAALD01',
        name: 'Naaldvilt Project 400cm',
        salesGroup: 'Naaldvilt (nog te koppelen)',
        supplierName: 'Vebe',
        groups: ['Vloerbedekking']
      };

      expect(determineProductCategory(vinyl)).toBe('vloeren');
      expect(determineProductCategory(karpet)).toBe('vloeren');
      expect(determineProductCategory(naaldvilt)).toBe('vloeren');
    });

    it('should handle completely empty or null fields fail-closed as algemeen', () => {
      const corruptItem: any = {
        id: 999,
        code: null,
        name: null,
        salesGroup: null,
        groups: null
      };
      expect(determineProductCategory(corruptItem)).toBe('algemeen');
    });
  });

  describe('Four-Branch Category Step Architecture in ConclaafRulesEngine (DEF-01)', () => {
    it('should assign dedicated flooring steps to vloeren without raamdecoratie step bleeding', () => {
      const vloerItem: SearchResultItem = {
        id: 401,
        code: 'VIN01',
        name: 'Novilon Viva Vinyl',
        salesGroup: 'Vloeren',
        supplierName: 'Forbo',
        groups: ['Vloeren'],
        salesPrice: 42.50
      };

      const engine = new ConclaafRulesEngine(vloerItem);
      const config = engine.getConfiguration();

      expect(engine.getCategory()).toBe('vloeren');
      const stepIds = config.steps.map(s => s.id);

      // Dedicated vloer stappen
      expect(stepIds).toContain('OPPERVLAKTE');
      expect(stepIds).toContain('SNIJVERLIES');
      expect(stepIds).toContain('LEGWYZE');
      expect(stepIds).toContain('PLINTEN');

      // Geen raamdecoratie stappen
      expect(stepIds).not.toContain('VORM');
      expect(stepIds).not.toContain('BEDIENINGS_TYPE');
      expect(stepIds).not.toContain('MONTAGE');
      expect(stepIds).not.toContain('STOF_KLEUR');
      expect(stepIds).not.toContain('PROFIELKLEUR');
    });

    it('should assign dedicated furniture steps to algemeen without raamdecoratie step bleeding', () => {
      const meubelItem: SearchResultItem = {
        id: 35007,
        code: '35007ZWA',
        name: 'Vloerlamp movie tripot',
        salesGroup: 'Banken',
        supplierName: 'Coco Maison',
        groups: ['Verlichting'],
        salesPrice: 199.00
      };

      const engine = new ConclaafRulesEngine(meubelItem);
      const config = engine.getConfiguration();

      expect(engine.getCategory()).toBe('algemeen');
      const stepIds = config.steps.map(s => s.id);

      // Dedicated algemeen stappen
      expect(stepIds).toContain('AANTAL');
      expect(stepIds).toContain('UITVOERING');
      expect(stepIds).toContain('MONTAGE_SERVICE');

      // Geen raamdecoratie stappen
      expect(stepIds).not.toContain('BREEDTE');
      expect(stepIds).not.toContain('HOOGTE');
      expect(stepIds).not.toContain('VORM');
      expect(stepIds).not.toContain('MONTAGE');
      expect(stepIds).not.toContain('BEDIENINGS_TYPE');
      expect(stepIds).not.toContain('STOF_KLEUR');
    });
  });

  describe('CatalogCompatibilityRunner Batch Evaluation', () => {
    it('should process a heterogeneous batch of products and aggregate category counts', () => {
      const batch: SearchResultItem[] = [
        {
          id: 1,
          code: 'DU01',
          name: 'Duette shade',
          salesGroup: 'Raamdecoratie',
          supplierName: 'Luxaflex',
          salesPrice: 800
        },
        {
          id: 2,
          code: 'GOR01',
          name: 'Vliet gordijnstof',
          salesGroup: 'Gordijnstoffen',
          supplierName: 'Loft79',
          salesPrice: 900
        },
        {
          id: 3,
          code: 'VLR01',
          name: 'Moduleo PVC vloer',
          salesGroup: 'Vloeren',
          supplierName: 'Moduleo',
          salesPrice: 50
        },
        {
          id: 4,
          code: 'STO01',
          name: 'Eetkamerstoel Donna',
          salesGroup: 'Eetkamerstoelen',
          supplierName: 'Bodahl',
          salesPrice: 220
        }
      ];

      const runner = new CatalogCompatibilityRunner();
      const report = runner.evaluateBatch(batch);

      expect(report.totalEvaluated).toBe(4);
      expect(report.categoryCounts.raamdecoratie).toBe(1);
      expect(report.categoryCounts.gordijnen).toBe(1);
      expect(report.categoryCounts.vloeren).toBe(1);
      expect(report.categoryCounts.algemeen).toBe(1);
      expect(report.anomalyCount).toBe(0);
    });
  });
});
