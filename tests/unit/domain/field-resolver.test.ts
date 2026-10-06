import { describe, it, expect } from 'vitest';
import {
  detectProductCategory,
  resolveConfiguratorSchema
} from '@/domain/configurator/field-resolver';
import { SearchResultItem } from '@/types/product';

describe('Field Resolver Domain Unit Tests (TDD RED)', () => {
  describe('Product Category Detection', () => {
    it('should classify Duette and Plissé products as raamdecoratie', () => {
      const duetteItem: SearchResultItem = {
        id: 219609,
        code: 'A00052469',
        name: 'Duette® shade',
        unit: 'stuks',
        salesPrice: 0,
        salesGroup: 'Raamdecoratie',
        supplierName: 'Luxaflex',
        supplierId: 82653,
        groups: ['Koppelingen Raamdecoratie', 'Luxaflex', 'Duette® shade'],
        vatCode: 'BTW Hoog'
      };

      const category = detectProductCategory(duetteItem);
      expect(category).toBe('raamdecoratie');
    });

    it('should classify curtain fabrics and "Gordijnen (nog koppelen)" as gordijnen', () => {
      const curtainItem: SearchResultItem = {
        id: 33242,
        code: 'A00033242',
        name: 'Algemeen artikel Luxaflex',
        unit: 'stuks',
        salesPrice: 0,
        salesGroup: 'Gordijnen (nog koppelen)',
        supplierName: 'Luxaflex',
        supplierId: 82653,
        groups: ['Luxaflex - Gordijnen'],
        vatCode: 'BTW Hoog'
      };

      const category = detectProductCategory(curtainItem);
      expect(category).toBe('gordijnen');
    });

    it('should classify flooring, carpet and PVC products as vloeren', () => {
      const flooringItem: SearchResultItem = {
        id: 99100,
        code: 'A00099100',
        name: 'Ambiant PVC Spigato Visgraat',
        unit: 'm2',
        salesPrice: 49.95,
        salesGroup: 'Vloeren',
        supplierName: 'Ambiant',
        supplierId: 10400,
        groups: ['PVC Vloeren', 'Dryback'],
        vatCode: 'BTW Hoog'
      };

      const category = detectProductCategory(flooringItem);
      expect(category).toBe('vloeren');
    });

    it('should fall back to algemeen for uncategorized products', () => {
      const generalItem: SearchResultItem = {
        id: 888,
        code: 'DIVERS01',
        name: 'Montageset schroeven',
        unit: 'stuks',
        salesPrice: 12.5,
        salesGroup: 'Diversen',
        supplierName: 'Onbekend',
        supplierId: null,
        groups: [],
        vatCode: 'BTW Hoog'
      };

      const category = detectProductCategory(generalItem);
      expect(category).toBe('algemeen');
    });
  });

  describe('Dynamic Schema Generation by Category', () => {
    it('should generate raamdecoratie schema with width, height, mounting and operation', () => {
      const duetteItem: SearchResultItem = {
        id: 219609,
        code: 'A00052469',
        name: 'Duette® shade',
        unit: 'stuks',
        salesPrice: 0,
        salesGroup: 'Raamdecoratie',
        supplierName: 'Luxaflex',
        supplierId: 82653,
        groups: ['Luxaflex', 'Duette® shade'],
        vatCode: 'BTW Hoog'
      };

      const schema = resolveConfiguratorSchema(duetteItem);

      expect(schema.category).toBe('raamdecoratie');
      expect(schema.categoryLabel).toBe('Raamdecoratie / Duette & Plissé');

      const fieldKeys = schema.fields.map(f => f.key);
      expect(fieldKeys).toContain('breedte');
      expect(fieldKeys).toContain('hoogte');
      expect(fieldKeys).toContain('montagewijze');
      expect(fieldKeys).toContain('bediening');

      // Cruciaal: gordijnvelden mogen absoluut niet aanwezig zijn
      expect(fieldKeys).not.toContain('railbreedte');
      expect(fieldKeys).not.toContain('plooitype');

      const widthField = schema.fields.find(f => f.key === 'breedte');
      expect(widthField?.unit).toBe('mm');
      expect(widthField?.type).toBe('number');
      expect(widthField?.required).toBe(true);

      const mountingField = schema.fields.find(f => f.key === 'montagewijze');
      expect(mountingField?.type).toBe('select');
      expect(mountingField?.options?.map(o => o.value)).toEqual(['in_de_dag', 'op_de_dag']);
    });

    it('should generate gordijnen schema with railbreedte, maakhoogte and plooitype, without Top Down/Bottom Up', () => {
      const curtainItem: SearchResultItem = {
        id: 33242,
        code: 'A00033242',
        name: 'Gordijnstof Velours Grijs',
        unit: 'm1',
        salesPrice: 65,
        salesGroup: 'Gordijnen',
        supplierName: 'Kobe',
        supplierId: 4400,
        groups: ['Gordijnstoffen'],
        vatCode: 'BTW Hoog'
      };

      const schema = resolveConfiguratorSchema(curtainItem);

      expect(schema.category).toBe('gordijnen');
      expect(schema.categoryLabel).toBe('Gordijnen & Gordijnstoffen');

      const fieldKeys = schema.fields.map(f => f.key);
      expect(fieldKeys).toContain('railbreedte');
      expect(fieldKeys).toContain('maakhoogte');
      expect(fieldKeys).toContain('plooitype');

      // Cruciaal: raamdecoratie velden mogen nooit gevraagd worden bij gordijnen
      expect(fieldKeys).not.toContain('breedte');
      expect(fieldKeys).not.toContain('montagewijze');
      expect(fieldKeys).not.toContain('bediening');

      const pleatField = schema.fields.find(f => f.key === 'plooitype');
      expect(pleatField?.type).toBe('select');
      expect(pleatField?.options?.map(o => o.label)).toContain('Enkele plooi');
      expect(pleatField?.options?.map(o => o.label)).toContain('Dubbele plooi (vlinderplooi)');
      expect(pleatField?.options?.map(o => o.label)).toContain('Wave plooi');
    });

    it('should generate vloeren schema with oppervlakte (m²) and snijverlies (%)', () => {
      const floorItem: SearchResultItem = {
        id: 99100,
        code: 'A00099100',
        name: 'PVC Vloer Eiken Naturel',
        unit: 'm2',
        salesPrice: 42,
        salesGroup: 'Vloeren',
        supplierName: 'Moduleo',
        supplierId: 7800,
        groups: ['PVC'],
        vatCode: 'BTW Hoog'
      };

      const schema = resolveConfiguratorSchema(floorItem);

      expect(schema.category).toBe('vloeren');
      expect(schema.categoryLabel).toBe('Vloeren (Tapijt, PVC, Laminaat)');

      const fieldKeys = schema.fields.map(f => f.key);
      expect(fieldKeys).toContain('oppervlakte');
      expect(fieldKeys).toContain('snijverlies');

      const areaField = schema.fields.find(f => f.key === 'oppervlakte');
      expect(areaField?.unit).toBe('m²');
      expect(areaField?.required).toBe(true);

      const wasteField = schema.fields.find(f => f.key === 'snijverlies');
      expect(wasteField?.unit).toBe('%');
      expect(wasteField?.defaultValue).toBe(10);
    });

    it('should generate algemeen fallback schema for other products', () => {
      const miscItem: SearchResultItem = {
        id: 111,
        code: 'MISC01',
        name: 'Onderhoudsspray',
        unit: 'stuks',
        salesPrice: 9.95,
        salesGroup: 'Accessoires',
        supplierName: 'HQ',
        supplierId: 100,
        groups: [],
        vatCode: 'BTW Hoog'
      };

      const schema = resolveConfiguratorSchema(miscItem);

      expect(schema.category).toBe('algemeen');
      const fieldKeys = schema.fields.map(f => f.key);
      expect(fieldKeys).toContain('aantal');
      expect(fieldKeys).toContain('opmerking');
    });
  });
});
